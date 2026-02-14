/**
 * Hover Handler
 * Provides hover information for symbols
 */

import { getCommonChildType } from '@definitions/commonChildren';
import { type ExecutorBridge } from '@executor';
import { formatDocCommentForDisplay, type DocComment } from '@parser/docComment';
import { typeToString } from '@typings/types';
import { MarkupKind } from 'vscode-languageserver';

import type { DocumentManager } from '@lsp/documents';
import type { Scope } from '@typings/environment';
import type { ClassMethod, ClassProperty, ClassType, FunctionType, LuauType, TableType } from '@typings/types';
import type { Connection, Hover, HoverParams } from 'vscode-languageserver';

/**
 * Represents deprecation status and message for a symbol.
 * @param deprecated - Whether the symbol is deprecated
 * @param message - Optional deprecation message explaining why or suggesting alternatives
 */
interface DeprecationInfo {
  deprecated: boolean;
  message: string | undefined;
}

/**
 * Formats a function type into a readable Lua function signature string.
 * @param name - The name of the function
 * @param func - The function type containing parameters and return type
 * @returns A formatted function signature string like "function name(param: type): returnType"
 */
const formatFunctionSignature = (name: string, func: FunctionType): string => {
  const params = func.params
    .map(p => {
      const paramName = p.name ?? 'arg';
      const optional = p.optional ? '?' : '';
      return `${paramName}${optional}: ${typeToString(p.type)}`;
    })
    .join(', ');

  const returnType = typeToString(func.returnType);
  return `function ${name}(${params}): ${returnType}`;
};

/**
 * Formats a function with optional deprecation information for display.
 * @param name - The name of the function
 * @param func - The function type containing parameters and return type
 * @param deprecation - Optional deprecation information to include in the output
 * @returns A formatted string containing the function signature and deprecation notice if applicable
 */
const formatFunctionDoc = (name: string, func: FunctionType, deprecation?: DeprecationInfo): string => {
  let result = formatFunctionSignature(name, func);

  if (deprecation?.deprecated === true) {
    result += '\n```\n\n**@deprecated**';
    if (deprecation.message !== undefined) {
      result += ` ${deprecation.message}`;
    }
    result += '\n\n```lua';
  }

  return result;
};

/**
 * Formats a complete function documentation with signature, description,
 * parameters, return type, and examples.
 * @param name - The name of the function
 * @param func - The function type containing all documentation data
 * @returns A comprehensive markdown-formatted documentation string
 */
const formatFunctionDocFull = (name: string, func: FunctionType): string => {
  const lines: string[] = [];

  lines.push('```lua');
  lines.push(formatFunctionSignature(name, func));
  lines.push('```');

  if (func.description !== undefined) {
    lines.push('');
    lines.push(func.description);
  }

  if (func.params.length > 0) {
    lines.push('');
    lines.push('**Parameters:**');
    for (const param of func.params) {
      const paramName = param.name ?? 'arg';
      const optional = param.optional ? ' *(optional)*' : '';
      lines.push(`- \`${paramName}\`: \`${typeToString(param.type)}\`${optional}`);
    }
  }

  const returnTypeStr = typeToString(func.returnType);
  if (returnTypeStr !== 'nil' && returnTypeStr !== 'void') {
    lines.push('');
    lines.push(`**Returns:** \`${returnTypeStr}\``);
  }

  if (func.example !== undefined) {
    lines.push('');
    lines.push('**Example:**');
    lines.push('```lua');
    lines.push(func.example);
    lines.push('```');
  }

  return lines.join('\n');
};

/**
 * Formats a class type into a readable class documentation string.
 * Includes the class name, superclass if present, and property/method counts.
 * @param cls - The class type to format
 * @returns A formatted string representing the class structure
 */
const formatClassDoc = (cls: ClassType): string => {
  const lines = [`class ${cls.name}`];

  if (cls.superclass !== undefined) {
    lines[0] += ` extends ${cls.superclass.name}`;
  }

  const propCount = cls.properties.size;
  const methodCount = cls.methods.size;

  if (propCount > 0 || methodCount > 0) {
    lines.push(`  ${propCount} properties, ${methodCount} methods`);
  }

  return lines.join('\n');
};

/**
 * Formats a table type into a documentation string showing its members.
 * For tables with many members, shows only the count. For small tables,
 * lists the member names.
 * @param name - The name of the table/library
 * @param table - The table type containing properties
 * @returns A formatted string showing the table structure or member count
 */
const formatTableDoc = (name: string, table: TableType): string => {
  const memberCount = table.properties.size;

  // For libraries with many members, just show the count
  if (memberCount > 10) {
    return `${name}: library (${memberCount} members)`;
  }

  return `local ${name}: ${typeToString(table)}`;
};

/**
 * Formats any Luau type into a documentation string, dispatching to
 * specialized formatters for functions, classes, and tables.
 * @param name - The name of the symbol
 * @param type - The Luau type to format
 * @param deprecation - Optional deprecation information to include
 * @returns A formatted type documentation string
 */
const formatTypeDoc = (name: string, type: LuauType, deprecation?: DeprecationInfo): string => {
  if (type.kind === 'Function') return formatFunctionDoc(name, type, deprecation);

  if (type.kind === 'Class') return formatClassDoc(type);

  if (type.kind === 'Table') return formatTableDoc(name, type);

  let result = `local ${name}: ${typeToString(type)}`;

  if (deprecation?.deprecated === true) {
    result += '\n```\n\n**@deprecated**';
    if (deprecation.message !== undefined) {
      result += ` ${deprecation.message}`;
    }
    result += '\n\n```lua';
  }

  return result;
};

/**
 * Formats a Luau type with full documentation, including descriptions
 * and examples when available.
 * @param name - The name of the symbol
 * @param type - The Luau type to format
 * @returns A complete markdown-formatted documentation string wrapped in code blocks
 */
const formatTypeDocFull = (name: string, type: LuauType): string => {
  if (type.kind === 'Function' && (type.description !== undefined || type.example !== undefined)) {
    return formatFunctionDocFull(name, type);
  }

  return '```lua\n' + formatTypeDoc(name, type) + '\n```';
};

/**
 * Formats a symbol with its type and associated doc comment.
 * Combines the type documentation with any parsed doc comments.
 * @param name - The name of the symbol
 * @param type - The Luau type of the symbol
 * @param docComment - Optional parsed documentation comment
 * @returns A markdown string containing both type info and documentation
 */
const formatSymbolWithDocComment = (name: string, type: LuauType, docComment: DocComment | undefined): string => {
  const codeBlock = formatTypeDoc(name, type);
  let markdown = '```lua\n' + codeBlock + '\n```';

  if (docComment !== undefined) {
    const docMarkdown = formatDocCommentForDisplay(docComment);
    if (docMarkdown.length > 0) {
      markdown += '\n\n---\n\n' + docMarkdown;
    }
  }

  return markdown;
};

/**
 * Formats a class method for display, including deprecation status.
 * @param name - The name of the method
 * @param method - The class method containing the function type and deprecation info
 * @returns A formatted method documentation string
 */
const formatMethodDoc = (name: string, method: ClassMethod): string =>
  formatFunctionDoc(name, method.func, {
    'deprecated': method.deprecated === true,
    'message': method.deprecationMessage,
  });

/**
 * Formats a class property for display, including deprecation status.
 * @param name - The name of the property
 * @param prop - The class property containing the type and deprecation info
 * @returns A formatted property documentation string
 */
const formatPropertyDoc = (name: string, prop: ClassProperty): string =>
  formatTypeDoc(name, prop.type, {
    'deprecated': prop.deprecated === true,
    'message': prop.deprecationMessage,
  });

/**
 * Extracts the word at a given cursor position by finding word boundaries.
 * @param content - The full document content as a string
 * @param line - The zero-indexed line number
 * @param character - The zero-indexed character position within the line
 * @returns The word at the position, or undefined if no word found
 */
const getWordAtPosition = (content: string, line: number, character: number): string | undefined => {
  const lines = content.split('\n');
  const lineContent = lines[line];
  if (lineContent === undefined) return undefined;

  // Find word boundaries
  let start = character;
  let end = character;

  while (start > 0 && /\w/.test(lineContent[start - 1] ?? '')) {
    start--;
  }

  while (end < lineContent.length && /\w/.test(lineContent[end] ?? '')) {
    end++;
  }

  if (start === end) return undefined;

  return lineContent.slice(start, end);
};

/**
 * Information about a member access expression (dot or colon notation).
 * @param objectName - The name of the object being accessed
 * @param memberName - The name of the member being accessed
 * @param isMethod - Whether this is a method call (colon notation) or property access (dot notation)
 */
interface MemberAccessInfo {
  objectName: string;
  memberName: string;
  isMethod: boolean;
}

/**
 * Detects if the cursor is on a member access expression and extracts
 * the object name, member name, and access type.
 * Handles complex expressions like GetService calls.
 * @param content - The full document content as a string
 * @param line - The zero-indexed line number
 * @param character - The zero-indexed character position within the line
 * @returns Member access information, or undefined if not on a member access
 */
const getMemberAccessAtPosition = (content: string, line: number, character: number): MemberAccessInfo | undefined => {
  const lines = content.split('\n');
  const lineContent = lines[line];
  if (lineContent === undefined) return undefined;

  // Find the word under cursor first
  let start = character;
  let end = character;

  while (start > 0 && /\w/.test(lineContent[start - 1] ?? '')) start--;
  while (end < lineContent.length && /\w/.test(lineContent[end] ?? '')) end++;

  if (start === end) return undefined;
  const memberName = lineContent.slice(start, end);

  // Check if there's a . or : before the word
  let accessorPos = start - 1;
  while (accessorPos >= 0 && /\s/.test(lineContent[accessorPos] ?? '')) accessorPos--;

  if (accessorPos < 0) return undefined;
  const accessor = lineContent[accessorPos];
  if (accessor !== '.' && accessor !== ':') return undefined;

  // Find the object name before the accessor
  let objEnd = accessorPos;
  let objStart = objEnd - 1;
  while (objStart >= 0 && /\s/.test(lineContent[objStart] ?? '')) objStart--;
  objEnd = objStart + 1;

  // Check if we hit a closing quote/paren (from GetService call)
  const charBeforeAccessor = lineContent[objStart];
  if (charBeforeAccessor === ')' || charBeforeAccessor === "'" || charBeforeAccessor === '"') {
    // Look for GetService pattern and extract the service name as the "object"
    const beforeAccessor = lineContent.slice(0, accessorPos);
    const getServiceMatch = beforeAccessor.match(/:GetService\s*[(['"](["']?)(\w+)\1[)\]'"]\s*$/);
    if (getServiceMatch !== null && getServiceMatch[2] !== undefined) {
      // The service name becomes the "object" - map it to its class type
      const serviceName = getServiceMatch[2];
      return {
        'objectName': serviceName,
        memberName,
        'isMethod': accessor === ':',
      };
    }
    return undefined;
  }

  while (objStart > 0 && /\w/.test(lineContent[objStart - 1] ?? '')) objStart--;

  if (objStart === objEnd) return undefined;
  const objectName = lineContent.slice(objStart, objEnd);

  return {
    objectName,
    memberName,
    'isMethod': accessor === ':',
  };
};

/**
 * Result type for class member lookups. Can be a property, method,
 * common child instance, or undefined if not found.
 */
type ClassMemberLookupResult =
  | { kind: 'property'; prop: ClassProperty }
  | { kind: 'method'; method: ClassMethod }
  | { kind: 'commonChild'; childName: string; childTypeName: string }
  | undefined;

/**
 * Looks up a member (property, method, or common child) in a class and its
 * superclass chain.
 * @param cls - The class type to search in
 * @param memberName - The name of the member to find
 * @param getSuperclassName - Optional function to resolve superclass names for common child lookup
 * @returns The found member information, or undefined if not found
 */
const lookupClassMember = (
  cls: ClassType,
  memberName: string,
  getSuperclassName?: (className: string) => string | undefined,
): ClassMemberLookupResult => {
  let current: ClassType | undefined = cls;
  while (current !== undefined) {
    const prop = current.properties.get(memberName);
    if (prop !== undefined) return { 'kind': 'property', prop };
    const method = current.methods.get(memberName);
    if (method !== undefined) return { 'kind': 'method', method };
    current = current.superclass;
  }

  // Check common children if no property/method found
  if (getSuperclassName !== undefined) {
    const commonChildType = getCommonChildType(cls.name, memberName, getSuperclassName);
    if (commonChildType !== undefined) {
      return { 'kind': 'commonChild', 'childName': memberName, 'childTypeName': commonChildType };
    }
  }

  return undefined;
};

/**
 * Extracts the full member access chain from a position in the document.
 * Returns the path segments if this is a game/workspace access, otherwise undefined.
 * Handles patterns like:
 *   - game.Workspace.Part.Name
 *   - game:GetService("Players").LocalPlayer.Name
 *   - game:GetService'Players'.LocalPlayer.Name
 *   - workspace.Part.Name
 * @param content - The document content
 * @param line - The line number
 * @param character - The character position
 * @returns Array of path segments or undefined
 */
const extractGamePath = (content: string, line: number, character: number): ReadonlyArray<string> | undefined => {
  const lines = content.split('\n');
  const lineContent = lines[line];
  if (lineContent === undefined) return undefined;

  // Find word boundaries to get end of current word
  let end = character;
  while (end < lineContent.length && /\w/.test(lineContent[end] ?? '')) end++;

  // Walk backwards from end to find the full chain
  const segments: string[] = [];
  let pos = end;

  while (pos > 0) {
    // Find word before current position
    let wordEnd = pos;
    while (wordEnd > 0 && /\s/.test(lineContent[wordEnd - 1] ?? '')) wordEnd--;

    let wordStart = wordEnd;
    while (wordStart > 0 && /\w/.test(lineContent[wordStart - 1] ?? '')) wordStart--;

    // Check if we hit a GetService call instead of a word
    if (wordStart === wordEnd) {
      // Check for closing quote/paren from GetService
      const charAtPos = lineContent[wordEnd - 1];
      if (charAtPos === ')' || charAtPos === "'" || charAtPos === '"') {
        const beforePos = lineContent.slice(0, wordEnd);
        const getServiceMatch = beforePos.match(/game\s*:\s*GetService\s*[(['"](["']?)(\w+)\1[)\]'"]\s*$/);
        if (getServiceMatch !== null && getServiceMatch[2] !== undefined) {
          segments.unshift(getServiceMatch[2]);
          segments.unshift('game');
        }
      }
      break;
    }

    const word = lineContent.slice(wordStart, wordEnd);
    segments.unshift(word);

    // Check for accessor before this word
    let accessorPos = wordStart - 1;
    while (accessorPos >= 0 && /\s/.test(lineContent[accessorPos] ?? '')) accessorPos--;

    if (accessorPos < 0) break;
    const accessor = lineContent[accessorPos];

    // Handle closing parenthesis/bracket from GetService call
    if (accessor === ')' || accessor === "'" || accessor === '"') {
      // Look for GetService pattern: :GetService("ServiceName") or :GetService'ServiceName'
      const beforeAccessor = lineContent.slice(0, accessorPos + 1);
      const getServiceMatch = beforeAccessor.match(/game\s*:\s*GetService\s*[(['"](["']?)(\w+)\1[)\]'"]\s*$/);

      if (getServiceMatch !== null && getServiceMatch[2] !== undefined) {
        // Insert the service name and 'game' at the beginning
        segments.unshift(getServiceMatch[2]);
        segments.unshift('game');
        break;
      }
      break;
    }

    if (accessor !== '.' && accessor !== ':') break;

    pos = accessorPos;
  }

  // Check if this is a game/workspace path
  if (segments.length === 0) return undefined;
  const first = segments[0];
  if (first === 'game') return segments.slice(1);
  if (first === 'workspace') return ['Workspace', ...segments.slice(1)];

  // Check if it starts with a service name directly (from GetService resolution)
  const knownServices = [
    'Players',
    'Workspace',
    'ReplicatedStorage',
    'ReplicatedFirst',
    'ServerStorage',
    'ServerScriptService',
    'StarterGui',
    'StarterPack',
    'StarterPlayer',
    'Lighting',
    'SoundService',
    'Chat',
    'Teams',
    'TeleportService',
    'UserInputService',
    'RunService',
    'Debris',
    'TweenService',
  ];
  if (first !== undefined && knownServices.includes(first)) {
    return segments;
  }

  return undefined;
};

/**
 * Registers the hover handler with the LSP connection.
 * Provides type information and documentation when the user hovers
 * over identifiers, member accesses, and type references.
 * @param connection - The LSP connection to register the handler on
 * @param documentManager - The document manager for accessing parsed documents and global environment
 * @param executorBridge - The executor bridge for fetching live property values
 * @returns void
 */
export const setupHoverHandler = (
  connection: Connection,
  documentManager: DocumentManager,
  executorBridge: ExecutorBridge,
): void => {
  connection.onHover(async (params: HoverParams): Promise<Hover | null> => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined) return null;

    const word = getWordAtPosition(document.content, params.position.line, params.position.character);
    if (word === undefined) return null;

    // Skip keyword usage of 'type' in type alias declarations (type Foo = ...)
    if (word === 'type') {
      const lines = document.content.split('\n');
      const lineContent = lines[params.position.line];
      if (lineContent !== undefined && /^\s*type\s+\w/.test(lineContent)) return null;
    }

    // Check for member access (e.g., object.member or object:method)
    const memberAccess = getMemberAccessAtPosition(document.content, params.position.line, params.position.character);

    if (memberAccess !== undefined) {
      // Try to fetch live value first if connected (works regardless of static type info)
      let liveValueMarkdown = '';
      if (executorBridge.isConnected) {
        const gamePath = extractGamePath(document.content, params.position.line, params.position.character);
        if (gamePath !== undefined && gamePath.length > 0) {
          const instancePath = gamePath.slice(0, -1);
          if (instancePath.length > 0) {
            try {
              const result = await executorBridge.requestProperties(instancePath, [memberAccess.memberName]);
              if (result.success && result.properties !== undefined && result.properties.length > 0) {
                const liveValue = result.properties[0];
                if (liveValue !== undefined) {
                  liveValueMarkdown = `\n\n**Live Value:** \`${liveValue.value}\``;
                }
              }
            } catch {
              // Timeout or error - continue with static info
            }
          }
        }
      }

      // Try to find the object's type and look up the member
      const objectClass = documentManager.globalEnv.robloxClasses.get(memberAccess.objectName);
      if (objectClass !== undefined && objectClass.kind === 'Class') {
        const getSuperclassName = (className: string): string | undefined => {
          const cls = documentManager.globalEnv.robloxClasses.get(className);
          if (cls !== undefined && cls.kind === 'Class' && cls.superclass !== undefined) {
            return cls.superclass.name;
          }
          return undefined;
        };

        const member = lookupClassMember(objectClass, memberAccess.memberName, getSuperclassName);
        if (member !== undefined) {
          if (member.kind === 'method') {
            return {
              'contents': {
                'kind': MarkupKind.Markdown,
                'value':
                  '```lua\n' + formatMethodDoc(memberAccess.memberName, member.method) + '\n```' + liveValueMarkdown,
              },
            };
          }
          if (member.kind === 'property') {
            const markdown = '```lua\n' + formatPropertyDoc(memberAccess.memberName, member.prop) + '\n```';
            return {
              'contents': {
                'kind': MarkupKind.Markdown,
                'value': markdown + liveValueMarkdown,
              },
            };
          }
          if (member.kind === 'commonChild') {
            return {
              'contents': {
                'kind': MarkupKind.Markdown,
                'value':
                  '```lua\n' +
                  `(child) ${member.childName}: ${member.childTypeName}` +
                  '\n```\n\n' +
                  `Common child instance of type \`${member.childTypeName}\`\n\n` +
                  `Accessed via \`FindFirstChild("${member.childName}")\` or direct indexing.` +
                  liveValueMarkdown,
              },
            };
          }
        }
      }

      // Check DataTypes (Vector3, CFrame, Color3, UDim2, etc.)
      const dataType = documentManager.globalEnv.robloxDataTypes.get(memberAccess.objectName);
      if (dataType !== undefined && dataType.kind === 'Table') {
        const memberProp = dataType.properties.get(memberAccess.memberName);
        if (memberProp !== undefined) {
          return {
            'contents': {
              'kind': MarkupKind.Markdown,
              'value': formatTypeDocFull(memberAccess.memberName, memberProp.type) + liveValueMarkdown,
            },
          };
        }
      }

      // Check global symbols that are tables (standard libraries like math, string, table, and constructors like Vector3, CFrame, etc.)
      const globalSymbol = documentManager.globalEnv.env.globalScope.symbols.get(memberAccess.objectName);
      if (globalSymbol !== undefined && globalSymbol.type.kind === 'Table') {
        const memberProp = globalSymbol.type.properties.get(memberAccess.memberName);
        if (memberProp !== undefined) {
          return {
            'contents': {
              'kind': MarkupKind.Markdown,
              'value': formatTypeDocFull(memberAccess.memberName, memberProp.type) + liveValueMarkdown,
            },
          };
        }
      }

      // If we have a live value but no static type info, show just the live value
      if (liveValueMarkdown.length > 0) {
        return {
          'contents': {
            'kind': MarkupKind.Markdown,
            'value': `\`\`\`lua\n${memberAccess.objectName}.${memberAccess.memberName}\n\`\`\`` + liveValueMarkdown,
          },
        };
      }
    }

    // Check global symbols
    const symbol = documentManager.globalEnv.env.globalScope.symbols.get(word);
    if (symbol !== undefined) {
      return {
        'contents': {
          'kind': MarkupKind.Markdown,
          'value': formatTypeDocFull(word, symbol.type),
        },
      };
    }

    // Check Roblox classes
    const classType = documentManager.globalEnv.robloxClasses.get(word);
    if (classType !== undefined && classType.kind === 'Class') {
      return {
        'contents': {
          'kind': MarkupKind.Markdown,
          'value': '```lua\n' + formatClassDoc(classType) + '\n```',
        },
      };
    }

    // Check DataTypes (Vector3, CFrame, Color3, UDim2, etc.)
    const dataType = documentManager.globalEnv.robloxDataTypes.get(word);
    if (dataType !== undefined && dataType.kind === 'Table') {
      const memberCount = dataType.properties.size;
      return {
        'contents': {
          'kind': MarkupKind.Markdown,
          'value': `\`\`\`lua\n${word}: DataType (${memberCount} members)\n\`\`\``,
        },
      };
    }

    // Check Roblox enums
    const enumType = documentManager.globalEnv.robloxEnums.get(word);
    if (enumType !== undefined) {
      return {
        'contents': {
          'kind': MarkupKind.Markdown,
          'value': '```lua\nEnum.' + word + '\n```',
        },
      };
    }

    // Check local symbols in type check result
    if (document.typeCheckResult !== undefined) {
      // Search in all scopes starting from current scope going up to global
      let scope: Scope | undefined = document.typeCheckResult.environment.currentScope;
      while (scope !== undefined) {
        const localSymbol = scope.symbols.get(word);
        if (localSymbol !== undefined) {
          return {
            'contents': {
              'kind': MarkupKind.Markdown,
              'value': formatSymbolWithDocComment(word, localSymbol.type, localSymbol.docComment),
            },
          };
        }
        scope = scope.parent;
      }

      // Also check global scope explicitly in case traversal missed it
      const globalSymbol = document.typeCheckResult.environment.globalScope.symbols.get(word);
      if (globalSymbol !== undefined) {
        return {
          'contents': {
            'kind': MarkupKind.Markdown,
            'value': formatSymbolWithDocComment(word, globalSymbol.type, globalSymbol.docComment),
          },
        };
      }
    }

    return null;
  });
};
