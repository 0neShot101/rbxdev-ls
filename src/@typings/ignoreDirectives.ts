import type { Comment } from '@typings/ast';

export interface IgnoreState {
  readonly ignoredLines: Set<number>;
}

const DIRECTIVE_IGNORE = '@rbxls-ignore';
const DIRECTIVE_IGNORE_LINE = '@rbxls-ignore-line';
const DIRECTIVE_DISABLE = '@rbxls-disable';
const DIRECTIVE_DISABLE_NEXT_LINE = '@rbxls-disable-next-line';
const DIRECTIVE_ENABLE = '@rbxls-enable';

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

/** Parses an array of comments to build a set of line numbers that should be ignored for diagnostics. */
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

/** Checks if a specific line should be ignored for diagnostics based on the parsed ignore state. */
export const isLineIgnored = (state: IgnoreState, line: number): boolean => state.ignoredLines.has(line);
