/**
 * Document Manager
 * Manages parsed documents and their analysis state
 */

import { buildGlobalEnvironment, type GlobalEnvironment } from '@definitions/globals';
import { parse } from '@parser/parser';
import { checkProgram, type TypeCheckResult, type TypeDiagnostic } from '@typings/checker';
import { isLineIgnored, parseIgnoreDirectives } from '@typings/ignoreDirectives';
import { buildModuleIndex, searchExports, type ModuleExport, type ModuleInfo } from '@workspace/moduleIndex';
import { loadRojoState, type RojoState } from '@workspace/rojo';

import type { Chunk, Comment } from '@parser/ast';
import type { TypeCheckMode } from '@typings/subtyping';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Counts the number of lines in a string by counting newline characters.
 * More efficient than splitting the string into an array.
 * @param content - The string content to count lines in
 * @returns The number of lines (minimum 1)
 */
const countLines = (content: string): number => {
  let count = 1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') count++;
  }
  return count;
};

/**
 * Detects the type check mode from comments at the start of the file.
 * Supports: --!strict, --!nonstrict, --!nocheck
 * @param comments - The array of comments from the parsed AST
 * @returns The TypeCheckMode ('strict', 'nonstrict', or 'nocheck'), defaulting to 'nonstrict'
 */
const detectTypeCheckMode = (comments: ReadonlyArray<Comment>): TypeCheckMode => {
  for (const comment of comments) {
    // Only check comments at the start of the file (first few lines)
    if (comment.range.start.line > 5) break;

    // Comment value may include -- prefix, so check for both formats
    const text = comment.value.trim();
    if (text === '--!strict' || text === '!strict') return 'strict';
    if (text === '--!nonstrict' || text === '!nonstrict') return 'nonstrict';
    if (text === '--!nocheck' || text === '!nocheck') return 'nocheck';
  }

  // Default to nonstrict mode
  return 'nonstrict';
};

/**
 * Represents a parsed and type-checked document.
 */
export interface ParsedDocument {
  /** The document URI (file path) */
  readonly uri: string;
  /** The document version number for change tracking */
  readonly version: number;
  /** The raw text content of the document */
  readonly content: string;
  /** The parsed AST chunk, or undefined if parsing failed catastrophically */
  readonly ast: Chunk | undefined;
  /** Array of parse errors as diagnostics */
  readonly parseErrors: ReadonlyArray<TypeDiagnostic>;
  /** Array of type checking errors as diagnostics */
  readonly typeErrors: ReadonlyArray<TypeDiagnostic>;
  /** The full type check result including environment and symbols, or undefined if not type checked */
  readonly typeCheckResult: TypeCheckResult | undefined;
}

/**
 * Manages document parsing, type checking, and workspace state.
 */
export interface DocumentManager {
  /** The global environment containing Roblox classes, enums, and built-in types */
  readonly globalEnv: GlobalEnvironment;
  /** Map of document URIs to their parsed representations */
  readonly documents: Map<string, ParsedDocument>;
  /**
   * Parses and type-checks a document, storing the result.
   * @param doc - The TextDocument to parse
   * @returns The parsed document with AST and diagnostics
   */
  parseDocument: (doc: TextDocument) => ParsedDocument;
  /**
   * Retrieves a previously parsed document by URI.
   * @param uri - The document URI to look up
   * @returns The parsed document or undefined if not found
   */
  getDocument: (uri: string) => ParsedDocument | undefined;
  /**
   * Removes a document from the cache.
   * @param uri - The document URI to remove
   */
  removeDocument: (uri: string) => void;
  /**
   * Initializes workspace state including Rojo project and module index.
   * @param workspacePath - The filesystem path to the workspace root
   */
  initializeWorkspace: (workspacePath: string) => void;
  /**
   * Gets the current Rojo state.
   * @returns The Rojo state or undefined if not initialized
   */
  getRojoState: () => RojoState | undefined;
  /**
   * Gets the module index mapping module paths to their info.
   * @returns Map of module paths to ModuleInfo
   */
  getModuleIndex: () => Map<string, ModuleInfo>;
  /**
   * Searches for module exports matching a query string.
   * @param query - The search query to match against export names
   * @returns Array of matching ModuleExport objects
   */
  searchModuleExports: (query: string) => ModuleExport[];
}

/**
 * Creates a new DocumentManager instance.
 * Initializes the global environment and provides methods for document management.
 * @returns A new DocumentManager instance
 */
export const createDocumentManager = (): DocumentManager => {
  const globalEnv = buildGlobalEnvironment();
  const documents = new Map<string, ParsedDocument>();

  /**
   * Gets the cached class map from the global environment.
   * Lazily builds the map on first access.
   * @returns Map of class names to their ClassType definitions
   */
  let cachedClassMap: Map<string, import('@typings/types').ClassType> | undefined;
  const getClassMap = (): Map<string, import('@typings/types').ClassType> => {
    if (cachedClassMap === undefined) {
      cachedClassMap = new Map();
      for (const [name, type] of globalEnv.robloxClasses) {
        if (type.kind === 'Class') {
          cachedClassMap.set(name, type);
        }
      }
    }
    return cachedClassMap;
  };

  /**
   * Parses a document and performs type checking.
   * @param doc - The TextDocument to parse
   * @returns The parsed document with AST, errors, and type check results
   */
  const parseDocument = (doc: TextDocument): ParsedDocument => {
    const uri = doc.uri;
    const version = doc.version;
    const content = doc.getText();

    // Parse the document
    const parseResult = parse(content);
    const ast = parseResult.ast;

    // Parse ignore directives from comments
    const lastStatement = ast.body[ast.body.length - 1];
    // Fast line count - just count newlines instead of splitting
    const totalLines = lastStatement !== undefined ? lastStatement.range.end.line : countLines(content);
    const ignoreState = parseIgnoreDirectives(ast.comments, totalLines);

    // Filter parse errors based on ignore directives
    const parseErrors: TypeDiagnostic[] = parseResult.errors
      .filter(e => isLineIgnored(ignoreState, e.range.start.line) === false)
      .map(e => ({
        'message': e.message,
        'range': e.range,
        'severity': 'error' as const,
        'code': 'P001',
      }));

    // Always run type checking on the error-recovery AST so allSymbols is populated
    // for the completion handler. Only report type diagnostics when parse is clean.
    let typeCheckResult: TypeCheckResult | undefined;
    let typeErrors: TypeDiagnostic[] = [];

    const mode = detectTypeCheckMode(ast.comments);

    if (mode !== 'nocheck') {
      typeCheckResult = checkProgram(ast, { 'classes': getClassMap(), 'dataTypes': globalEnv.robloxDataTypes, 'mode': mode });

      // Only surface type diagnostics when there are no parse errors
      // to avoid cascading false positives from error-recovery regions
      if (parseErrors.length === 0) {
        typeErrors = typeCheckResult.diagnostics.slice();
      }
    }

    // If the current run produced no symbols (catastrophic failure), keep the previous result
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

  /**
   * Retrieves a previously parsed document by URI.
   * @param uri - The document URI to look up
   * @returns The parsed document or undefined if not found
   */
  const getDocument = (uri: string): ParsedDocument | undefined => documents.get(uri);

  /**
   * Removes a document from the cache.
   * @param uri - The document URI to remove
   * @returns void
   */
  const removeDocument = (uri: string): void => {
    documents.delete(uri);
  };

  let rojoState: RojoState | undefined;
  let moduleIndex: Map<string, ModuleInfo> = new Map();

  /**
   * Initializes the workspace by loading Rojo state and building the module index.
   * @param workspacePath - The filesystem path to the workspace root
   * @returns void
   */
  const initializeWorkspace = (workspacePath: string): void => {
    rojoState = loadRojoState(workspacePath);
    moduleIndex = buildModuleIndex(rojoState, workspacePath);
  };

  /**
   * Gets the current Rojo state.
   * @returns The Rojo state or undefined if not initialized
   */
  const getRojoState = (): RojoState | undefined => rojoState;

  /**
   * Gets the module index mapping module paths to their info.
   * @returns Map of module paths to ModuleInfo
   */
  const getModuleIndex = (): Map<string, ModuleInfo> => moduleIndex;

  /**
   * Searches for module exports matching a query string.
   * @param query - The search query to match against export names
   * @returns Array of matching ModuleExport objects
   */
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
