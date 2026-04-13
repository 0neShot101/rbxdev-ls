import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Connection, TextDocuments } from 'vscode-languageserver/node';
import type { Chunk } from '@typings/ast';
import type { ExecutorBridge } from '@typings/bridge';
import type { TypeCheckResult, TypeDiagnostic } from '@typings/checker';
import type { GlobalEnvironment } from '@typings/definitions';
import type { ModuleExport, ModuleInfo, RojoState } from '@typings/workspace';

export type ConnectionInstance = Connection;

export interface ParsedDocument {
  readonly uri: string;
  readonly version: number;
  readonly content: string;
  readonly ast: Chunk | undefined;
  readonly parseErrors: ReadonlyArray<TypeDiagnostic>;
  readonly typeErrors: ReadonlyArray<TypeDiagnostic>;
  readonly typeCheckResult: TypeCheckResult | undefined;
}

export interface DocumentManager {
  readonly globalEnv: GlobalEnvironment;
  readonly documents: Map<string, ParsedDocument>;
  parseDocument: (doc: TextDocument) => ParsedDocument;
  getDocument: (uri: string) => ParsedDocument | undefined;
  removeDocument: (uri: string) => void;
  initializeWorkspace: (workspacePath: string) => void;
  reloadWorkspace: () => void;
  getRojoState: () => RojoState | undefined;
  getModuleIndex: () => Map<string, ModuleInfo>;
  searchModuleExports: (query: string) => ModuleExport[];
}

export interface ServerState {
  readonly connection: ConnectionInstance;
  readonly documents: TextDocuments<TextDocument>;
  readonly documentManager: DocumentManager;
  readonly executorBridge: ExecutorBridge;
  readonly initialized: boolean;
}
