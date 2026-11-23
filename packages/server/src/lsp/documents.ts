import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import { checkProgram } from '@analyzer/checker';
import { defineSymbol } from '@analyzer/environment';
import { isLineIgnored, parseIgnoreDirectives } from '@analyzer/ignoreDirectives';
import { AnyType, createFunctionType, createTableType } from '@analyzer/values';
import { buildGlobalEnvironment } from '@definitions/globals';
import { loadWorkspaceGlobals } from '@definitions/loader';
import { parse } from '@parser/parser';
import { buildModuleIndex, extractModuleExports, resolveLocalModulePath, searchExports } from '@workspace/moduleIndex';
import { loadRojoState } from '@workspace/rojo';
import { loadSourcemapState } from '@workspace/sourcemap';
import { isString } from '@utils/guards';

import type { TextDocument } from 'vscode-languageserver-textdocument';

import type { Chunk, Comment } from '@typings/ast';
import type { RequiredModule, RequireResolver, TypeCheckResult, TypeDiagnostic } from '@typings/checker';
import type { LoadedDefinitions } from '@typings/definitions';
import type { DocumentManager, ParsedDocument } from '@typings/lsp';
import type { TypeCheckMode } from '@typings/subtyping';
import type { LuauType, PropertyType } from '@typings/types';
import type { ModuleExport, ModuleInfo, RojoState } from '@typings/workspace';

/** Maximum number of cached documents */
const MAX_CACHE_SIZE = 100;

const countLines = (content: string): number => {
  let count = 1;
  for (let i = 0; i < content.length; i++) if (content[i] === '\n') count++;
  return count;
};

const detectTypeCheckMode = (comments: ReadonlyArray<Comment>): TypeCheckMode => {
  for (const comment of comments) {
    if (comment.range.start.line > 5) break;

    const text = comment.value.trim();
    if (text === '--!strict' || text === '!strict') return 'strict';
    if (text === '--!nonstrict' || text === '!nonstrict') return 'nonstrict';
    if (text === '--!nocheck' || text === '!nocheck') return 'nocheck';
  }

  return 'nonstrict';
};

const getFilePath = (uri: string): string | undefined => {
  if (!uri.startsWith('file:')) return undefined;
  try {
    return fileURLToPath(uri);
  } catch {
    return undefined;
  }
};

const fileKey = (filePath: string): string => (process.platform === 'win32' ? filePath.toLowerCase() : filePath);

const readModuleAst = (filePath: string): Chunk | undefined => {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }
  return parse(content).ast;
};

const stripScriptSuffix = (name: string): string => name.replace(/\.(client|server)$/, '');

const findDataModelModule = (
  modules: ReadonlyMap<string, ModuleInfo>,
  pathParts: ReadonlyArray<string>,
): ModuleInfo | undefined => {
  let emptyMatch: ModuleInfo | undefined;
  for (const info of modules.values()) {
    const dmPath = info.dataModelPath;
    const offset = dmPath.length - pathParts.length;
    if (offset < 0) continue;
    const matches = pathParts.every((part, i) => {
      const actual = dmPath[offset + i] ?? '';
      return actual === part || stripScriptSuffix(actual) === stripScriptSuffix(part);
    });
    if (matches) {
      if (info.exports.length > 0) return info;
      emptyMatch ??= info;
    }
  }
  return emptyMatch;
};

const moduleValueType = (exports: ReadonlyArray<ModuleExport>): LuauType => {
  if (exports.length === 0) return AnyType;
  const properties = new Map<string, PropertyType>();
  for (const exp of exports) {
    let propType: LuauType = AnyType;
    if (exp.kind === 'function')
      if (exp.signature !== undefined)
        propType = createFunctionType(
          exp.signature.params.map(p => ({ 'name': p.name, 'type': p.type, 'optional': p.optional })),
          exp.signature.returnType,
          { 'isVariadic': exp.signature.isVariadic },
        );
      else propType = createFunctionType([], AnyType);
    else if (exp.kind === 'table') propType = createTableType(new Map());
    properties.set(exp.name, { 'type': propType, 'readonly': true, 'optional': false });
  }
  return createTableType(properties);
};

/** Creates a new DocumentManager instance, building its global environment from the supplied or bundled definitions. */
export const createDocumentManager = (definitions?: LoadedDefinitions): DocumentManager => {
  const globalEnv = buildGlobalEnvironment(definitions);
  const documents = new Map<string, ParsedDocument>();
  const documentCache = new Map<string, ParsedDocument>();
  const openFileAsts = new Map<string, Chunk>();

  const moduleDependencies = new Map<string, ReadonlySet<string>>();
  let invalidatedConsumers: Set<string> | undefined;

  const invalidateModuleConsumers = (key: string, sourceUri: string): void => {
    for (const [uri, dependencies] of moduleDependencies)
      if (uri !== sourceUri && dependencies.has(key)) {
        documentCache.delete(uri);
        (invalidatedConsumers ??= new Set()).add(uri);
      }
  };

  const takeInvalidatedModuleConsumers = (): ReadonlySet<string> | undefined => {
    const consumers = invalidatedConsumers;
    invalidatedConsumers = undefined;
    return consumers;
  };

  const createRequireResolver = (
    rootAst: Chunk,
    rootFilePath: string | undefined,
    dependencies: Set<string>,
  ): RequireResolver => {
    const rootKey = rootFilePath === undefined ? undefined : fileKey(rootFilePath);
    let resolvedModules: Map<string, RequiredModule> | undefined;

    const fromFile = (sourcePath: string | undefined): RequireResolver => request => {
      const fileRequest = isString(request);
      const info = fileRequest ? undefined : findDataModelModule(moduleIndex, request);
      const filePath = fileRequest
        ? sourcePath === undefined || request.length === 0
          ? undefined
          : resolveLocalModulePath(request, sourcePath, candidate => {
              const key = fileKey(candidate);
              dependencies.add(key);
              return openFileAsts.has(key);
            })
        : info?.filePath;
      if (filePath === undefined) return undefined;

      const key = fileKey(filePath);
      dependencies.add(key);
      const cacheKey = info === undefined ? `file:${key}` : key;
      const cached = resolvedModules?.get(cacheKey);
      if (cached !== undefined) return cached;

      const openAst = key === rootKey ? rootAst : openFileAsts.get(key);
      /** The export inventory is not a runtime type for arbitrary file modules. */
      const valueType =
        info === undefined
          ? AnyType
          : moduleValueType(
              openAst === undefined ? info.exports : extractModuleExports(openAst, filePath, info.dataModelPath),
            );

      let checked = false;
      let exportedTypes: TypeCheckResult['exportedTypes'];
      const required: RequiredModule = {
        valueType,
        'getExportedTypes': () => {
          /** A back edge cannot use a namespace whose analysis is still in progress. */
          if (checked || key === rootKey) return exportedTypes;
          checked = true;
          const ast = openAst ?? readModuleAst(filePath);
          if (ast !== undefined && ast.body.some(stmt => stmt.kind === 'ExportStatement'))
            exportedTypes = checkProgram(ast, {
              'globals': globalEnv,
              'mode': detectTypeCheckMode(ast.comments),
              'requireResolver': fromFile(filePath),
            }).exportedTypes;
          return exportedTypes;
        },
      };
      resolvedModules ??= new Map();
      resolvedModules.set(cacheKey, required);
      return required;
    };

    return fromFile(rootFilePath);
  };

  const parseDocument = (doc: TextDocument): ParsedDocument => {
    const uri = doc.uri;
    const version = doc.version;
    const content = doc.getText();

    /** An unchanged version with identical text reuses the previous analysis; the comparison is exact. */
    const cached = documentCache.get(uri);
    if (cached !== undefined && cached.version === version && cached.content === content) {
      documents.set(uri, cached);
      return cached;
    }

    const parseResult = parse(content);
    const ast = parseResult.ast;
    const filePath = getFilePath(uri);
    const previousDoc = documents.get(uri);
    if (filePath !== undefined && previousDoc?.content !== content) {
      const key = fileKey(filePath);
      openFileAsts.set(key, ast);
      invalidateModuleConsumers(key, uri);
    }

    const lastStatement = ast.body[ast.body.length - 1];
    const totalLines = lastStatement !== undefined ? lastStatement.range.end.line : countLines(content);
    const ignoreState = parseIgnoreDirectives(ast.comments, totalLines);

    const parseErrors: TypeDiagnostic[] = parseResult.errors
      .filter(e => isLineIgnored(ignoreState, e.range.start.line) === false)
      .map(e => ({
        'message': e.message,
        'range': e.range,
        'severity': 'error' as const,
        'code': 'P001',
      }));

    let typeCheckResult: TypeCheckResult | undefined;
    let typeErrors: TypeDiagnostic[] = [];
    let resolveRequire: RequireResolver | undefined;
    let dependencies: Set<string> | undefined;

    const mode = detectTypeCheckMode(ast.comments);

    if (mode !== 'nocheck') {
      typeCheckResult = checkProgram(ast, {
        'globals': globalEnv,
        'mode': mode,
        'requireResolver': request => {
          if (resolveRequire === undefined) {
            dependencies = new Set();
            resolveRequire = createRequireResolver(ast, filePath, dependencies);
          }
          return resolveRequire(request);
        },
      });

      if (parseErrors.length === 0) typeErrors = typeCheckResult.diagnostics.slice();
    }

    if (
      typeCheckResult !== undefined &&
      typeCheckResult.allSymbols.size === 0 &&
      previousDoc?.typeCheckResult !== undefined &&
      previousDoc.typeCheckResult.allSymbols.size > 0
    )
      typeCheckResult = previousDoc.typeCheckResult;

    const parsed: ParsedDocument = {
      uri,
      version,
      content,
      ast,
      parseErrors,
      typeErrors,
      typeCheckResult,
    };

    if (dependencies === undefined) moduleDependencies.delete(uri);
    else moduleDependencies.set(uri, dependencies);
    invalidatedConsumers?.delete(uri);
    documentCache.set(uri, parsed);
    if (documentCache.size > MAX_CACHE_SIZE) {
      /** Over the limit, the oldest half of the cache is evicted. */
      const keys = [...documentCache.keys()].slice(0, Math.floor(MAX_CACHE_SIZE / 2));
      for (const key of keys) documentCache.delete(key);
    }

    documents.set(uri, parsed);
    return parsed;
  };

  const getDocument = (uri: string): ParsedDocument | undefined => documents.get(uri);

  const removeDocument = (uri: string): void => {
    documents.delete(uri);
    documentCache.delete(uri);
    moduleDependencies.delete(uri);
    invalidatedConsumers?.delete(uri);
    const filePath = getFilePath(uri);
    if (filePath === undefined) return;
    const key = fileKey(filePath);
    if (openFileAsts.delete(key)) invalidateModuleConsumers(key, uri);
  };

  let rojoState: RojoState | undefined;
  let moduleIndex: Map<string, ModuleInfo> = new Map();
  let workspacePath: string | undefined;
  let configuredGlobals: string[] | undefined;

  const initializeWorkspace = (path: string): void => {
    workspacePath = path;
    const globals = globalEnv.env.globalScope.symbols;
    if (configuredGlobals !== undefined) for (const name of configuredGlobals) globals.delete(name);
    configuredGlobals = undefined;
    const names = loadWorkspaceGlobals(path);
    if (names !== undefined)
      for (const name of names)
        if (globals.has(name) === false) {
          defineSymbol(globalEnv.env, name, AnyType, 'Global', false);
          (configuredGlobals ??= []).push(name);
        }
    const sourcemapState = loadSourcemapState(path);
    rojoState = sourcemapState.dataModel !== undefined ? sourcemapState : loadRojoState(path);
    moduleIndex = buildModuleIndex(rojoState, path);
    documentCache.clear();
  };

  const reloadWorkspace = (): void => {
    if (workspacePath !== undefined) initializeWorkspace(workspacePath);
  };

  const getRojoState = (): RojoState | undefined => rojoState;

  const getModuleIndex = (): Map<string, ModuleInfo> => moduleIndex;

  const searchModuleExports = (query: string): ModuleExport[] => searchExports(moduleIndex, query);

  return {
    globalEnv,
    documents,
    parseDocument,
    takeInvalidatedModuleConsumers,
    getDocument,
    removeDocument,
    initializeWorkspace,
    reloadWorkspace,
    getRojoState,
    getModuleIndex,
    searchModuleExports,
  };
};
