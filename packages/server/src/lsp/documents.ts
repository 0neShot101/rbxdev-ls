import { buildGlobalEnvironment } from '@definitions/globals';
import { parse } from '@parser/parser';
import { checkProgram, type RequireResolver, type TypeCheckResult, type TypeDiagnostic } from '@typings/checker';
import { isLineIgnored, parseIgnoreDirectives } from '@typings/ignoreDirectives';
import type { LuauType, PropertyType } from '@typings/types';
import { AnyType, createFunctionType, createTableType } from '@typings/types';
import { buildModuleIndex, searchExports } from '@workspace/moduleIndex';
import { loadRojoState } from '@workspace/rojo';
import { loadSourcemapState } from '@workspace/sourcemap';

import type { Comment } from '@typings/ast';
import type { DocumentManager, ParsedDocument } from '@typings/lsp';
import type { TypeCheckMode } from '@typings/subtyping';
import type { ModuleExport, ModuleInfo, RojoState } from '@typings/workspace';
import type { TextDocument } from 'vscode-languageserver-textdocument';

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

/** Creates a new DocumentManager instance. */
export const createDocumentManager = (): DocumentManager => {
  const globalEnv = buildGlobalEnvironment();
  const documents = new Map<string, ParsedDocument>();

  let cachedClassMap: Map<string, import('@typings/types').ClassType> | undefined;
  const getClassMap = (): Map<string, import('@typings/types').ClassType> => {
    if (cachedClassMap === undefined) {
      cachedClassMap = new Map();
      for (const [name, type] of globalEnv.robloxClasses) if (type.kind === 'Class') cachedClassMap.set(name, type);
    }
    return cachedClassMap;
  };

  const parseDocument = (doc: TextDocument): ParsedDocument => {
    const uri = doc.uri;
    const version = doc.version;
    const content = doc.getText();

    const parseResult = parse(content);
    const ast = parseResult.ast;

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

    const mode = detectTypeCheckMode(ast.comments);

    if (mode !== 'nocheck') {
      const requireResolver: RequireResolver = (pathParts: ReadonlyArray<string>): LuauType | undefined => {
        const stripSuffix = (name: string): string => name.replace(/\.(client|server)$/, '');

        for (const [, info] of moduleIndex) {
          const dmPath = info.dataModelPath;
          if (dmPath.length < pathParts.length) continue;

          const offset = dmPath.length - pathParts.length;
          let matches = true;
          for (let i = 0; i < pathParts.length; i++) {
            const expected = pathParts[i] ?? '';
            const actual = dmPath[offset + i] ?? '';
            if (
              actual !== expected &&
              actual !== stripSuffix(expected) &&
              stripSuffix(actual) !== stripSuffix(expected)
            ) {
              matches = false;
              break;
            }
          }

          if (matches && info.exports.length > 0) {
            const properties = new Map<string, PropertyType>();
            for (const exp of info.exports) {
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
          }
        }
        return undefined;
      };

      typeCheckResult = checkProgram(ast, {
        'classes': getClassMap(),
        'dataTypes': globalEnv.robloxDataTypes,
        'mode': mode,
        requireResolver,
      });

      if (parseErrors.length === 0) typeErrors = typeCheckResult.diagnostics.slice();
    }

    const previousDoc = documents.get(uri);
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

    documents.set(uri, parsed);
    return parsed;
  };

  const getDocument = (uri: string): ParsedDocument | undefined => documents.get(uri);

  const removeDocument = (uri: string): void => {
    documents.delete(uri);
  };

  let rojoState: RojoState | undefined;
  let moduleIndex: Map<string, ModuleInfo> = new Map();
  let workspacePath: string | undefined;

  const initializeWorkspace = (path: string): void => {
    workspacePath = path;
    const sourcemapState = loadSourcemapState(path);
    rojoState = sourcemapState.dataModel !== undefined ? sourcemapState : loadRojoState(path);
    moduleIndex = buildModuleIndex(rojoState, path);
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
    getDocument,
    removeDocument,
    initializeWorkspace,
    reloadWorkspace,
    getRojoState,
    getModuleIndex,
    searchModuleExports,
  };
};
