/**
 * Ignore Directives Parser
 * Parses special comment directives to suppress diagnostics on specific lines.
 *
 * Supported directives:
 * - `--@rbxls-ignore` - ignore errors on the next line
 * - `--@rbxls-ignore-line` - ignore errors on the current line
 * - `--@rbxls-disable` - disable all errors until `--@rbxls-enable`
 * - `--@rbxls-disable-next-line` - same as ignore (ignore the next line)
 * - `--@rbxls-enable` - re-enable errors after a disable directive
 */

import type { Comment } from '@parser/ast';

/**
 * Represents the state of ignored lines after parsing ignore directives.
 */
export interface IgnoreState {
  /** A set of line numbers that should be excluded from diagnostic reporting. */
  readonly ignoredLines: Set<number>;
}

const DIRECTIVE_IGNORE = '@rbxls-ignore';
const DIRECTIVE_IGNORE_LINE = '@rbxls-ignore-line';
const DIRECTIVE_DISABLE = '@rbxls-disable';
const DIRECTIVE_DISABLE_NEXT_LINE = '@rbxls-disable-next-line';
const DIRECTIVE_ENABLE = '@rbxls-enable';

/**
 * Extracts the directive type from a comment if a recognized directive is present.
 * Checks for directives prefixed with `--` and returns the matching directive constant.
 * @param comment - The AST comment node to extract a directive from.
 * @returns The directive string constant if found, or undefined if no directive is present.
 */
const extractDirective = (comment: Comment): string | undefined => {
  const value = comment.value.trim();

  if (value.startsWith('--')) {
    const content = value.slice(2).trim();

    if (content.startsWith(DIRECTIVE_IGNORE_LINE)) return DIRECTIVE_IGNORE_LINE;
    if (content.startsWith(DIRECTIVE_IGNORE)) return DIRECTIVE_IGNORE;
    if (content.startsWith(DIRECTIVE_DISABLE_NEXT_LINE)) return DIRECTIVE_DISABLE_NEXT_LINE;
    if (content.startsWith(DIRECTIVE_DISABLE)) return DIRECTIVE_DISABLE;
    if (content.startsWith(DIRECTIVE_ENABLE)) return DIRECTIVE_ENABLE;
  }

  return undefined;
};

/**
 * Parses an array of comments to build a set of line numbers that should be ignored for diagnostics.
 * Processes ignore, ignore-line, disable, disable-next-line, and enable directives to determine
 * which lines should have their diagnostics suppressed.
 * @param comments - The array of AST comment nodes to parse for directives.
 * @param totalLines - The total number of lines in the source file (used for unclosed disable blocks).
 * @returns An IgnoreState object containing the set of line numbers to ignore.
 */
export const parseIgnoreDirectives = (comments: ReadonlyArray<Comment>, totalLines: number): IgnoreState => {
  const ignoredLines = new Set<number>();
  let disableStartLine: number | undefined;

  const sortedComments = [...comments].sort((a, b) => a.range.start.line - b.range.start.line);

  for (const comment of sortedComments) {
    const directive = extractDirective(comment);
    if (directive === undefined) continue;

    const commentLine = comment.range.start.line;

    switch (directive) {
      case DIRECTIVE_IGNORE:
      case DIRECTIVE_DISABLE_NEXT_LINE:
        ignoredLines.add(commentLine + 1);
        break;

      case DIRECTIVE_IGNORE_LINE:
        ignoredLines.add(commentLine);
        break;

      case DIRECTIVE_DISABLE:
        disableStartLine = commentLine;
        break;

      case DIRECTIVE_ENABLE:
        if (disableStartLine !== undefined) {
          for (let line = disableStartLine; line <= commentLine; line++) {
            ignoredLines.add(line);
          }
          disableStartLine = undefined;
        }
        break;
    }
  }

  if (disableStartLine !== undefined) {
    for (let line = disableStartLine; line <= totalLines; line++) {
      ignoredLines.add(line);
    }
  }

  return { ignoredLines };
};

/**
 * Checks if a specific line should be ignored for diagnostics based on the parsed ignore state.
 * @param state - The IgnoreState containing the set of ignored line numbers.
 * @param line - The line number to check (1-indexed).
 * @returns True if the line should be ignored, false otherwise.
 */
export const isLineIgnored = (state: IgnoreState, line: number): boolean => state.ignoredLines.has(line);
