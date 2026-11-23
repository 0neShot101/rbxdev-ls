import type { TextDocument } from 'vscode-languageserver-textdocument';
import type {
  CodeAction,
  CodeActionParams,
  CompletionItem,
  CompletionList,
  Connection,
  Hover,
  MessageConnection,
  Position,
  Range,
  SignatureHelp,
  TextDocuments,
} from 'vscode-languageserver/node';

/** In-memory language-server session driven by a JSON-RPC client over real streams. */
export interface LspHarness {
  readonly client: MessageConnection;
  /** Server connection that handlers register on before `start`. */
  readonly connection: Connection;
  /** Documents synchronised from client notifications. */
  readonly documents: TextDocuments<TextDocument>;
  /** Starts both connections and completes the initialize handshake. */
  readonly start: () => Promise<void>;
  /** Opens a Luau document on the server and returns its URI. */
  readonly open: (text: string) => Promise<string>;
  /** Requests completions, failing unless the server answers with a completion list. */
  readonly complete: (uri: string, position: Position) => Promise<CompletionList>;
  /** Requests deferred documentation for a completion item. */
  readonly resolve: (item: CompletionItem) => Promise<CompletionItem>;
  /** Requests code actions, keeping only full code actions (not bare commands). */
  readonly codeActions: (params: CodeActionParams) => Promise<ReadonlyArray<CodeAction>>;
  /** Requests hover information. */
  readonly hover: (uri: string, position: Position) => Promise<Hover | null>;
  /** Requests signature help at a call site. */
  readonly signature: (uri: string, position: Position) => Promise<SignatureHelp | null>;
  /** Requests encoded semantic tokens for a line range, treating a null response as no tokens. */
  readonly semanticTokensRange: (uri: string, range: Range) => Promise<ReadonlyArray<number>>;
  /** Closes both connections and their streams. */
  readonly dispose: () => void;
}
