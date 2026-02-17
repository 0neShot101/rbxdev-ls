import type { DocComment, DocField, DocParam, DocReturn } from '@typings/parser';

const isDocComment = (commentValue: string): boolean => commentValue.startsWith('---');

const parseDocLine = (line: string): { tag: string | undefined; content: string } => {
  const trimmed = line.replace(/^---\s*/, '');

  if (trimmed.startsWith('@')) {
    const tagMatch = trimmed.match(/^@(\w+)\s*(.*)/);
    if (tagMatch !== null) {
      return { 'tag': tagMatch[1], 'content': tagMatch[2] ?? '' };
    }
  }

  return { 'tag': undefined, 'content': trimmed };
};

const parseParamTag = (content: string): DocParam => {
  const simpleMatch = content.match(/^(\w+)\s+([^\s]+(?:\s*\|\s*[^\s]+)*)\s*(.*)?$/);
  if (simpleMatch !== null) {
    return {
      'name': simpleMatch[1] ?? '',
      'type': simpleMatch[2]?.trim(),
      'description': simpleMatch[3]?.trim() || undefined,
    };
  }

  const nameMatch = content.match(/^(\w+)\s*(.*)?$/);
  if (nameMatch !== null) {
    return {
      'name': nameMatch[1] ?? '',
      'type': undefined,
      'description': nameMatch[2]?.trim() || undefined,
    };
  }

  return { 'name': content.trim(), 'type': undefined, 'description': undefined };
};

const parseReturnTag = (content: string): DocReturn => {
  const match = content.match(/^([^\s]+(?:\s*\|\s*[^\s]+)*)\s*(.*)?$/);
  if (match !== null) {
    return {
      'type': match[1]?.trim(),
      'description': match[2]?.trim() || undefined,
    };
  }
  return { 'type': undefined, 'description': content.trim() || undefined };
};

const parseFieldTag = (content: string): DocField => {
  const match = content.match(/^(\w+)\s+(\S+)?\s*(.*)?$/);
  if (match !== null) {
    return {
      'name': match[1] ?? '',
      'type': match[2],
      'description': match[3] || undefined,
    };
  }
  return { 'name': content.trim(), 'type': undefined, 'description': undefined };
};

/** Parses a documentation comment string into a structured DocComment object. */
export const parseDocComment = (commentValue: string): DocComment | undefined => {
  if (isDocComment(commentValue) === false) return undefined;

  const lines = commentValue.split('\n');
  const descriptionLines: string[] = [];
  const params: DocParam[] = [];
  const returns: DocReturn[] = [];
  const fields: DocField[] = [];
  let typeAnnotation: string | undefined;
  let className: string | undefined;
  let deprecated: string | undefined;

  for (const line of lines) {
    const { tag, content } = parseDocLine(line);

    if (tag === undefined) {
      if (content.trim() !== '') {
        descriptionLines.push(content);
      }
    } else {
      switch (tag) {
        case 'param':
          params.push(parseParamTag(content));
          break;
        case 'return':
          returns.push(parseReturnTag(content));
          break;
        case 'type':
          typeAnnotation = content.trim() || undefined;
          break;
        case 'class':
          className = content.trim() || undefined;
          break;
        case 'field':
          fields.push(parseFieldTag(content));
          break;
        case 'deprecated':
          deprecated = content.trim() || 'Deprecated';
          break;
      }
    }
  }

  return {
    'description': descriptionLines.length > 0 ? descriptionLines.join('\n') : undefined,
    params,
    returns,
    'type': typeAnnotation,
    'class': className,
    fields,
    deprecated,
    'raw': commentValue,
  };
};

/** Collects and combines multiple documentation comment strings into a single DocComment. */
export const collectDocComments = (commentValues: ReadonlyArray<string>): DocComment | undefined => {
  const docComments: string[] = [];

  for (const comment of commentValues) {
    if (isDocComment(comment)) {
      docComments.push(comment);
    }
  }

  if (docComments.length === 0) return undefined;

  const combined = docComments.join('\n');
  return parseDocComment(combined);
};

/** Formats a DocComment object as a human-readable string for display. */
export const formatDocCommentForDisplay = (doc: DocComment): string => {
  const lines: string[] = [];

  if (doc.deprecated !== undefined) {
    lines.push(`**@deprecated** ${doc.deprecated}`);
    lines.push('');
  }

  if (doc.description !== undefined) {
    lines.push(doc.description);
    lines.push('');
  }

  if (doc.params.length > 0) {
    for (const param of doc.params) {
      const typeStr = param.type !== undefined ? `: ${param.type}` : '';
      const descStr = param.description !== undefined ? ` - ${param.description}` : '';
      lines.push(`@param \`${param.name}\`${typeStr}${descStr}`);
    }
  }

  if (doc.returns.length > 0) {
    for (const ret of doc.returns) {
      const typeStr = ret.type !== undefined ? `${ret.type}` : '';
      const descStr = ret.description !== undefined ? ` - ${ret.description}` : '';
      lines.push(`@return ${typeStr}${descStr}`);
    }
  }

  return lines.join('\n');
};
