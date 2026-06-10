import { getCommonChildType } from '@definitions/commonChildren';
import { formatDocCommentForDisplay } from '@parser/docComment';
import type { ExecutorBridge } from '@typings/bridge';
import type { DocComment } from '@typings/parser';
import { typeToString } from '@typings/types';
import { MarkupKind } from 'vscode-languageserver';

import type { Scope } from '@typings/environment';
import type { ClassMemberLookupResult, DeprecationInfo, MemberAccessInfo } from '@typings/handlers';
import type { DocumentManager, ParsedDocument } from '@typings/lsp';
import type { ClassMethod, ClassProperty, ClassType, FunctionType, LuauType, TableType } from '@typings/types';
import type { Connection, Hover, HoverParams } from 'vscode-languageserver';

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
 * Formats a function type as a markdown hover documentation string.
 * @param name - The function name.
 * @param func - The function type definition.
 * @param deprecation - Optional deprecation info to include.
 * @returns A markdown-formatted documentation string.
 */
export const formatFunctionDoc = (name: string, func: FunctionType, deprecation?: DeprecationInfo): string => {
  let result = formatFunctionSignature(name, func);

  if (deprecation?.deprecated === true) {
    result += '\n```\n\n**@deprecated**';
    if (deprecation.message !== undefined) result += ` ${deprecation.message}`;
    result += '\n\n```lua';
  }

  return result;
};

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
 * Formats a Roblox class type as a markdown hover documentation string.
 * @param cls - The class type definition.
 * @returns A markdown-formatted documentation string with class hierarchy info.
 */
export const formatClassDoc = (cls: ClassType): string => {
  const lines = [`class ${cls.name}`];

  if (cls.superclass !== undefined) lines[0] += ` extends ${cls.superclass.name}`;

  const propCount = cls.properties.size;
  const methodCount = cls.methods.size;

  if (propCount > 0 || methodCount > 0) lines.push(`  ${propCount} properties, ${methodCount} methods`);

  return lines.join('\n');
};

const formatTableDoc = (name: string, table: TableType): string => {
  const memberCount = table.properties.size;

  if (memberCount > 10) return `${name}: library (${memberCount} members)`;

  return `local ${name}: ${typeToString(table)}`;
};

/**
 * Formats any Luau type as a markdown hover documentation string, dispatching by kind.
 * @param name - The symbol name.
 * @param type - The Luau type to format.
 * @param deprecation - Optional deprecation info to include.
 * @returns A markdown-formatted documentation string.
 */
export const formatTypeDoc = (name: string, type: LuauType, deprecation?: DeprecationInfo): string => {
  if (type.kind === 'Function') return formatFunctionDoc(name, type, deprecation);

  if (type.kind === 'Class') return formatClassDoc(type);

  if (type.kind === 'Table') return formatTableDoc(name, type);

  let result = `local ${name}: ${typeToString(type)}`;

  if (deprecation?.deprecated === true) {
    result += '\n```\n\n**@deprecated**';
    if (deprecation.message !== undefined) result += ` ${deprecation.message}`;
    result += '\n\n```lua';
  }

  return result;
};

const formatTypeDocFull = (name: string, type: LuauType): string => {
  if (type.kind === 'Function' && (type.description !== undefined || type.example !== undefined))
    return formatFunctionDocFull(name, type);

  return '```lua\n' + formatTypeDoc(name, type) + '\n```';
};

const formatSymbolWithDocComment = (name: string, type: LuauType, docComment: DocComment | undefined): string => {
  const codeBlock = formatTypeDoc(name, type);
  let markdown = '```lua\n' + codeBlock + '\n```';

  if (docComment !== undefined) {
    const docMarkdown = formatDocCommentForDisplay(docComment);
    if (docMarkdown.length > 0) markdown += '\n\n---\n\n' + docMarkdown;
  }

  return markdown;
};

/**
 * Formats a class method as a markdown hover documentation string.
 * @param name - The method name.
 * @param method - The class method definition.
 * @returns A markdown-formatted documentation string.
 */
export const formatMethodDoc = (name: string, method: ClassMethod): string =>
  formatFunctionDoc(name, method.func, {
    'deprecated': method.deprecated === true,
    'message': method.deprecationMessage,
  });

/**
 * Formats a class property as a markdown hover documentation string.
 * @param name - The property name.
 * @param prop - The class property definition.
 * @returns A markdown-formatted documentation string.
 */
export const formatPropertyDoc = (name: string, prop: ClassProperty): string =>
  formatTypeDoc(name, prop.type, {
    'deprecated': prop.deprecated === true,
    'message': prop.deprecationMessage,
  });

/**
 * Extracts the identifier word at a given position in the document text.
 * @param content - The full document text.
 * @param line - The zero-based line number.
 * @param character - The zero-based character offset.
 * @returns The word at the position, or undefined if none found.
 */
export const getWordAtPosition = (content: string, line: number, character: number): string | undefined => {
  const lines = content.split('\n');
  const lineContent = lines[line];
  if (lineContent === undefined) return undefined;

  let start = character;
  let end = character;

  while (start > 0 && /\w/.test(lineContent[start - 1] ?? '')) start--;
  while (end < lineContent.length && /\w/.test(lineContent[end] ?? '')) end++;

  if (start === end) return undefined;

  return lineContent.slice(start, end);
};

/**
 * Extracts a member access expression (e.g. "object.member") at a given position.
 * @param content - The full document text.
 * @param line - The zero-based line number.
 * @param character - The zero-based character offset.
 */
export const getMemberAccessAtPosition = (
  content: string,
  line: number,
  character: number,
): MemberAccessInfo | undefined => {
  const lines = content.split('\n');
  const lineContent = lines[line];
  if (lineContent === undefined) return undefined;

  let start = character;
  let end = character;

  while (start > 0 && /\w/.test(lineContent[start - 1] ?? '')) start--;
  while (end < lineContent.length && /\w/.test(lineContent[end] ?? '')) end++;

  if (start === end) return undefined;
  const memberName = lineContent.slice(start, end);

  let accessorPos = start - 1;
  while (accessorPos >= 0 && /\s/.test(lineContent[accessorPos] ?? '')) accessorPos--;

  if (accessorPos < 0) return undefined;
  const accessor = lineContent[accessorPos];
  if (accessor !== '.' && accessor !== ':') return undefined;

  let objEnd = accessorPos;
  let objStart = objEnd - 1;
  while (objStart >= 0 && /\s/.test(lineContent[objStart] ?? '')) objStart--;
  objEnd = objStart + 1;

  const charBeforeAccessor = lineContent[objStart];
  if (charBeforeAccessor === ')' || charBeforeAccessor === "'" || charBeforeAccessor === '"') {
    const beforeAccessor = lineContent.slice(0, accessorPos);
    const getServiceMatch = beforeAccessor.match(/:GetService\s*[(['"](["']?)(\w+)\1[)\]'"]\s*$/);
    if (getServiceMatch !== null && getServiceMatch[2] !== undefined) {
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

  if (getSuperclassName !== undefined) {
    const commonChildType = getCommonChildType(cls.name, memberName, getSuperclassName);
    if (commonChildType !== undefined)
      return { 'kind': 'commonChild', 'childName': memberName, 'childTypeName': commonChildType };
  }

  return undefined;
};

const extractGamePath = (content: string, line: number, character: number): ReadonlyArray<string> | undefined => {
  const lines = content.split('\n');
  const lineContent = lines[line];
  if (lineContent === undefined) return undefined;

  let end = character;
  while (end < lineContent.length && /\w/.test(lineContent[end] ?? '')) end++;

  const segments: string[] = [];
  let pos = end;

  while (pos > 0) {
    let wordEnd = pos;
    while (wordEnd > 0 && /\s/.test(lineContent[wordEnd - 1] ?? '')) wordEnd--;

    let wordStart = wordEnd;
    while (wordStart > 0 && /\w/.test(lineContent[wordStart - 1] ?? '')) wordStart--;

    if (wordStart === wordEnd) {
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

    let accessorPos = wordStart - 1;
    while (accessorPos >= 0 && /\s/.test(lineContent[accessorPos] ?? '')) accessorPos--;

    if (accessorPos < 0) break;
    const accessor = lineContent[accessorPos];

    if (accessor === ')' || accessor === "'" || accessor === '"') {
      const beforeAccessor = lineContent.slice(0, accessorPos + 1);
      const getServiceMatch = beforeAccessor.match(/game\s*:\s*GetService\s*[(['"](["']?)(\w+)\1[)\]'"]\s*$/);

      if (getServiceMatch !== null && getServiceMatch[2] !== undefined) {
        segments.unshift(getServiceMatch[2]);
        segments.unshift('game');
        break;
      }
      break;
    }

    if (accessor !== '.' && accessor !== ':') break;

    pos = accessorPos;
  }

  if (segments.length === 0) return undefined;
  const first = segments[0];
  if (first === 'game') return segments.slice(1);
  if (first === 'workspace') return ['Workspace', ...segments.slice(1)];

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
  if (first !== undefined && knownServices.includes(first)) return segments;

  return undefined;
};

/**
 * Walks a document's local scopes and file-level scope for a symbol named
 * `name` and returns its type if found. Used by the hover handler to find
 * user-defined locals like module-bound tables and typed variables.
 */
export const resolveSymbolTypeInDocument = (document: ParsedDocument, name: string): LuauType | undefined => {
  if (document.typeCheckResult === undefined) return undefined;
  const env = document.typeCheckResult.environment;

  let walkScope: Scope | undefined = env.currentScope;
  while (walkScope !== undefined) {
    const localSymbol = walkScope.symbols.get(name);
    if (localSymbol !== undefined) return localSymbol.type;
    walkScope = walkScope.parent;
  }

  const fileSymbol = env.globalScope.symbols.get(name);
  return fileSymbol?.type;
};

/**
 * Formats a member access hover for an already-resolved object type.
 * Supports user tables (module exports via require resolver) and typed
 * locals that carry a Class type. Returns the markdown body (without
 * Roblox "Live Value" suffixes) or undefined if the member isn't found.
 */
export const formatMemberHoverForType = (
  objectType: LuauType,
  memberName: string,
  resolveClass: (className: string) => ClassType | undefined,
): string | undefined => {
  if (objectType.kind === 'Table') {
    const memberProp = objectType.properties.get(memberName);
    if (memberProp === undefined) return undefined;
    return formatTypeDocFull(memberName, memberProp.type);
  }

  if (objectType.kind === 'Class') {
    const getSuperclassName = (className: string): string | undefined => {
      const cls = resolveClass(className);
      if (cls !== undefined && cls.kind === 'Class' && cls.superclass !== undefined) return cls.superclass.name;
      return undefined;
    };
    const member = lookupClassMember(objectType, memberName, getSuperclassName);
    if (member === undefined) return undefined;
    if (member.kind === 'method') return '```lua\n' + formatMethodDoc(memberName, member.method) + '\n```';
    if (member.kind === 'property') return '```lua\n' + formatPropertyDoc(memberName, member.prop) + '\n```';
    return undefined;
  }

  return undefined;
};

/** Registers the hover handler with the LSP connection. */
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

    if (word === 'type') {
      const lines = document.content.split('\n');
      const lineContent = lines[params.position.line];
      if (lineContent !== undefined && /^\s*type\s+\w/.test(lineContent)) return null;
    }

    const memberAccess = getMemberAccessAtPosition(document.content, params.position.line, params.position.character);

    if (memberAccess !== undefined) {
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
                if (liveValue !== undefined) liveValueMarkdown = `\n\n**Live Value:** \`${liveValue.value}\``;
              }
            } catch {
              /* noop */
            }
          }
        }
      }

      const objectClass = documentManager.globalEnv.robloxClasses.get(memberAccess.objectName);
      if (objectClass !== undefined && objectClass.kind === 'Class') {
        const getSuperclassName = (className: string): string | undefined => {
          const cls = documentManager.globalEnv.robloxClasses.get(className);
          if (cls !== undefined && cls.kind === 'Class' && cls.superclass !== undefined) return cls.superclass.name;
          return undefined;
        };

        const member = lookupClassMember(objectClass, memberAccess.memberName, getSuperclassName);
        if (member !== undefined) {
          if (member.kind === 'method')
            return {
              'contents': {
                'kind': MarkupKind.Markdown,
                'value':
                  '```lua\n' + formatMethodDoc(memberAccess.memberName, member.method) + '\n```' + liveValueMarkdown,
              },
            };
          if (member.kind === 'property') {
            const markdown = '```lua\n' + formatPropertyDoc(memberAccess.memberName, member.prop) + '\n```';
            return {
              'contents': {
                'kind': MarkupKind.Markdown,
                'value': markdown + liveValueMarkdown,
              },
            };
          }
          if (member.kind === 'commonChild')
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

      const dataType = documentManager.globalEnv.robloxDataTypes.get(memberAccess.objectName);
      if (dataType !== undefined && dataType.kind === 'Table') {
        const memberProp = dataType.properties.get(memberAccess.memberName);
        if (memberProp !== undefined)
          return {
            'contents': {
              'kind': MarkupKind.Markdown,
              'value': formatTypeDocFull(memberAccess.memberName, memberProp.type) + liveValueMarkdown,
            },
          };
      }

      const globalSymbol = documentManager.globalEnv.env.globalScope.symbols.get(memberAccess.objectName);
      if (globalSymbol !== undefined && globalSymbol.type.kind === 'Table') {
        const memberProp = globalSymbol.type.properties.get(memberAccess.memberName);
        if (memberProp !== undefined)
          return {
            'contents': {
              'kind': MarkupKind.Markdown,
              'value': formatTypeDocFull(memberAccess.memberName, memberProp.type) + liveValueMarkdown,
            },
          };
      }

      const localObjectType = resolveSymbolTypeInDocument(document, memberAccess.objectName);
      if (localObjectType !== undefined) {
        const resolveClass = (className: string): ClassType | undefined => {
          const cls = documentManager.globalEnv.robloxClasses.get(className);
          return cls !== undefined && cls.kind === 'Class' ? cls : undefined;
        };
        const markdown = formatMemberHoverForType(localObjectType, memberAccess.memberName, resolveClass);
        if (markdown !== undefined)
          return {
            'contents': {
              'kind': MarkupKind.Markdown,
              'value': markdown + liveValueMarkdown,
            },
          };
      }

      if (liveValueMarkdown.length > 0)
        return {
          'contents': {
            'kind': MarkupKind.Markdown,
            'value': `\`\`\`lua\n${memberAccess.objectName}.${memberAccess.memberName}\n\`\`\`` + liveValueMarkdown,
          },
        };
    }

    const symbol = documentManager.globalEnv.env.globalScope.symbols.get(word);
    if (symbol !== undefined)
      return {
        'contents': {
          'kind': MarkupKind.Markdown,
          'value': formatTypeDocFull(word, symbol.type),
        },
      };

    const classType = documentManager.globalEnv.robloxClasses.get(word);
    if (classType !== undefined && classType.kind === 'Class')
      return {
        'contents': {
          'kind': MarkupKind.Markdown,
          'value': '```lua\n' + formatClassDoc(classType) + '\n```',
        },
      };

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

    const enumType = documentManager.globalEnv.robloxEnums.get(word);
    if (enumType !== undefined)
      return {
        'contents': {
          'kind': MarkupKind.Markdown,
          'value': '```lua\nEnum.' + word + '\n```',
        },
      };

    if (document.typeCheckResult !== undefined) {
      let scope: Scope | undefined = document.typeCheckResult.environment.currentScope;
      while (scope !== undefined) {
        const localSymbol = scope.symbols.get(word);
        if (localSymbol !== undefined)
          return {
            'contents': {
              'kind': MarkupKind.Markdown,
              'value': formatSymbolWithDocComment(word, localSymbol.type, localSymbol.docComment),
            },
          };
        scope = scope.parent;
      }

      const globalSymbol = document.typeCheckResult.environment.globalScope.symbols.get(word);
      if (globalSymbol !== undefined)
        return {
          'contents': {
            'kind': MarkupKind.Markdown,
            'value': formatSymbolWithDocComment(word, globalSymbol.type, globalSymbol.docComment),
          },
        };
    }

    return null;
  });
};
