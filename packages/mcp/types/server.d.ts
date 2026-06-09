export interface McpTextContent {
  type: 'text';
  text: string;
}

export interface ToolResult {
  content: McpTextContent[];
  isError?: boolean;
}

export interface GameTreeNode {
  name: string;
  className: string;
  hasChildren?: boolean;
  children?: GameTreeNode[];
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  stack?: string;
}

export interface ExecutorBridgeLike {
  execute(code: string): Promise<unknown>;
}

export interface McpServerLike {
  connect(transport: unknown): Promise<void>;
  server: unknown;
}

export declare const textResult: (text: string) => ToolResult;
export declare const errorResult: (text: string) => ToolResult;
export declare const requirePath: (path: unknown) => ToolResult | undefined;
export declare const formatGameTreeNode: (node: GameTreeNode, indent?: number) => string;
export declare const serializeGameTreeNode: (
  node: GameTreeNode,
) => { name: string; className: string; hasChildren?: boolean; children?: unknown[] };
export declare const formatLogEntry: (entry: LogEntry) => string;
export declare const formatServicesTree: (services: ReadonlyMap<string, GameTreeNode>) => string;
export declare const tools: unknown[];
export declare const createMcpServer: (
  injectedBridge?: ExecutorBridgeLike,
) => { server: McpServerLike; bridge: ExecutorBridgeLike };
export declare const startMcpServer: () => Promise<void>;
