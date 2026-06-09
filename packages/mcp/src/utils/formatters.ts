import type { GameTreeNode, LogEntry } from 'rbxdev-server';

/**
 * Formats a game tree node as an indented human-readable text tree.
 * @param node - The game tree node to format.
 * @param indent - The current indentation depth (defaults to 0).
 * @returns A multi-line string representing the node and its children.
 */
export const formatGameTreeNode = (node: GameTreeNode, indent: number = 0): string => {
  const prefix = '  '.repeat(indent);
  let result = `${prefix}${node.name} (${node.className})`;

  if (node.hasChildren === true && (node.children === undefined || node.children.length === 0)) result += ' [+]';

  if (node.children !== undefined && node.children.length > 0) {
    result += '\n';
    result += node.children.map(child => formatGameTreeNode(child, indent + 1)).join('\n');
  }

  return result;
};

/**
 * Serializes a game tree node to a plain JSON-safe object for structured output.
 * @param node - The game tree node to serialize.
 * @returns A plain object with name, className, and optional children.
 */
export const serializeGameTreeNode = (
  node: GameTreeNode,
): { name: string; className: string; hasChildren?: boolean; children?: unknown[] } => ({
  'name': node.name,
  'className': node.className,
  ...(node.hasChildren === true ? { 'hasChildren': true } : {}),
  ...(node.children !== undefined ? { 'children': node.children.map(serializeGameTreeNode) } : {}),
});

/**
 * Formats a log entry as a timestamped string with level and message.
 * @param entry - The log entry to format.
 * @returns A formatted string like "12:34:56.789 [WARN] message".
 */
export const formatLogEntry = (entry: LogEntry): string => {
  const time = new Date(entry.timestamp).toISOString().slice(11, 23);
  return `${time} [${entry.level.toUpperCase()}] ${entry.message}${entry.stack !== undefined ? `\n${entry.stack}` : ''}`;
};

/**
 * Formats all service nodes into a single text tree string.
 * @param services - The map of service name to game tree node.
 * @returns A newline-separated string of all formatted service trees.
 */
export const formatServicesTree = (services: ReadonlyMap<string, GameTreeNode>): string => {
  const lines: string[] = [];
  for (const [, node] of services) lines.push(formatGameTreeNode(node));
  return lines.join('\n');
};
