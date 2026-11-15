import type { ExecutorBridge } from '@typings/bridge';
import type { DocumentManager, ParsedDocument } from '@typings/lsp';

/** One segment of a dotted, method or call expression chain parsed during completion type resolution. */
export type ExprPart =
  | { kind: 'property'; name: string }
  | { kind: 'method'; name: string; args: string }
  | { kind: 'call'; args: string };

/** Inputs of member-access completion for one completion request. */
export interface MemberContext {
  /** Analyzed document state; absent before the document has been parsed. */
  readonly document: ParsedDocument | undefined;
  /** Full live text of the document. */
  readonly content: string;
  /** Text of the cursor line before the cursor. */
  readonly beforeCursor: string;
  /** URI of the document being completed. */
  readonly uri: string;
  /** Document manager supplying definitions and the workspace module index. */
  readonly documentManager: DocumentManager;
  /** Executor bridge supplying live game state and runtime module inspection. */
  readonly executorBridge: ExecutorBridge;
  /** Completion trace callback. */
  readonly log: (message: string) => void;
}
