import { buildGlobalEnvironment } from '@definitions/globals';
import { parse } from '@parser/parser';
import { checkProgram, type TypeCheckResult, type TypeDiagnostic } from '@typings/checker';
import { isLineIgnored, parseIgnoreDirectives } from '@typings/ignoreDirectives';
import { buildModuleIndex, searchExports } from '@workspace/moduleIndex';
import { loadRojoState } from '@workspace/rojo';

import type { Comment } from '@typings/ast';
import type { DocumentManager, ParsedDocument } from '@typings/lsp';
import type { TypeCheckMode } from '@typings/subtyping';
import type { ModuleExport, ModuleInfo, RojoState } from '@typings/workspace';
import type { TextDocument } from 'vscode-languageserver-textdocument';

const countLines = (content: string): number => {
  let count = 1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') count++;
  }
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
      for (const [name, type] of globalEnv.robloxClasses) {
        if (type.kind === 'Class') cachedClassMap.set(name, type);
      }
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
      typeCheckResult = checkProgram(ast, {
        'classes': getClassMap(),
        'dataTypes': globalEnv.robloxDataTypes,
        'mode': mode,
      });

      if (parseErrors.length === 0) {
        typeErrors = typeCheckResult.diagnostics.slice();
      }
    }

    const previousDoc = documents.get(uri);
    if (
      typeCheckResult !== undefined &&
      typeCheckResult.allSymbols.size === 0 &&
      previousDoc?.typeCheckResult !== undefined &&
      previousDoc.typeCheckResult.allSymbols.size > 0
    ) {
      typeCheckResult = previousDoc.typeCheckResult;
    }

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

  const initializeWorkspace = (workspacePath: string): void => {
    rojoState = loadRojoState(workspacePath);
    moduleIndex = buildModuleIndex(rojoState, workspacePath);
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
    getRojoState,
    getModuleIndex,
    searchModuleExports,
  };
};
