/**
 * LuaDoc/EmmyLua Documentation Comment Parser
 *
 * Parses documentation comments in the format:
 * --- Description of the function
 * ---@param name type Description of parameter
 * ---@return type Description of return value
 * ---@type type
 * ---@class ClassName
 * ---@field name type Description
 * ---@deprecated Use otherFunction instead
 */

/**
 * Represents a documented function parameter from a @param tag.
 */
export interface DocParam {
  /** The name of the parameter */
  readonly name: string;
  /** The type annotation for the parameter, if specified */
  readonly type: string | undefined;
  /** The description of the parameter, if provided */
  readonly description: string | undefined;
}

/**
 * Represents a documented return value from a @return tag.
 */
export interface DocReturn {
  /** The type annotation for the return value, if specified */
  readonly type: string | undefined;
  /** The description of the return value, if provided */
  readonly description: string | undefined;
}

/**
 * Represents a documented class or table field from a @field tag.
 */
export interface DocField {
  /** The name of the field */
  readonly name: string;
  /** The type annotation for the field, if specified */
  readonly type: string | undefined;
  /** The description of the field, if provided */
  readonly description: string | undefined;
}

/**
 * Represents a parsed documentation comment containing all extracted documentation tags.
 */
export interface DocComment {
  /** The main description text of the documentation comment */
  readonly description: string | undefined;
  /** Array of documented parameters from @param tags */
  readonly params: ReadonlyArray<DocParam>;
  /** Array of documented return values from @return tags */
  readonly returns: ReadonlyArray<DocReturn>;
  /** The type annotation from a @type tag, if present */
  readonly type: string | undefined;
  /** The class name from a @class tag, if present */
  readonly class: string | undefined;
  /** Array of documented fields from @field tags */
  readonly fields: ReadonlyArray<DocField>;
  /** The deprecation message from a @deprecated tag, if present */
  readonly deprecated: string | undefined;
  /** The raw, unparsed documentation comment text */
  readonly raw: string;
}

/**
 * Checks whether a comment string is a documentation comment (starts with ---).
 * @param commentValue The comment string to check
 * @returns True if the comment is a documentation comment, false otherwise
 */
const isDocComment = (commentValue: string): boolean => commentValue.startsWith('---');

/**
 * Parses a single line of a documentation comment, extracting the tag (if present) and content.
 * @param line The documentation line to parse (including the --- prefix)
 * @returns An object containing the tag name (if any) and the remaining content
 */
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

/**
 * Parses the content of a @param tag into a DocParam object.
 * Expected format: name type Description
 * @param content The content string after the @param tag
 * @returns A DocParam object with extracted name, type, and description
 */
const parseParamTag = (content: string): DocParam => {
  // Try to match: name type Description
  // Type can contain | for unions, ? for optionals, and () for function types
  const simpleMatch = content.match(/^(\w+)\s+([^\s]+(?:\s*\|\s*[^\s]+)*)\s*(.*)?$/);
  if (simpleMatch !== null) {
    return {
      'name': simpleMatch[1] ?? '',
      'type': simpleMatch[2]?.trim(),
      'description': simpleMatch[3]?.trim() || undefined,
    };
  }

  // Fallback: just name
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

/**
 * Parses the content of a @return tag into a DocReturn object.
 * Expected format: type Description
 * @param content The content string after the @return tag
 * @returns A DocReturn object with extracted type and description
 */
const parseReturnTag = (content: string): DocReturn => {
  // Try to match type with possible union types (type1|type2)
  const match = content.match(/^([^\s]+(?:\s*\|\s*[^\s]+)*)\s*(.*)?$/);
  if (match !== null) {
    return {
      'type': match[1]?.trim(),
      'description': match[2]?.trim() || undefined,
    };
  }
  return { 'type': undefined, 'description': content.trim() || undefined };
};

/**
 * Parses the content of a @field tag into a DocField object.
 * Expected format: name type Description
 * @param content The content string after the @field tag
 * @returns A DocField object with extracted name, type, and description
 */
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

/**
 * Parses a documentation comment string into a structured DocComment object.
 * Extracts description text and all recognized tags (@param, @return, @type, @class, @field, @deprecated).
 * @param commentValue The raw documentation comment string to parse
 * @returns A DocComment object containing all parsed information, or undefined if not a valid doc comment
 */
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

/**
 * Collects and combines multiple documentation comment strings into a single DocComment.
 * Filters for valid doc comments and joins them before parsing.
 * @param commentValues An array of comment strings to process
 * @returns A combined DocComment object, or undefined if no valid doc comments are found
 */
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

/**
 * Formats a DocComment object as a human-readable string for display (e.g., in hover information).
 * Includes deprecation warnings, description, parameters, and return values.
 * @param doc The DocComment object to format
 * @returns A formatted string representation of the documentation
 */
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
