import { CompletionItemKind, CompletionItemTag, InsertTextFormat, MarkupKind } from 'vscode-languageserver';

import { resolveTypeReference } from '@lsp/handlers/completion/expression';
import { formatFunctionDetail, formatFunctionSnippet, typeToCompletionKind } from '@lsp/handlers/completion/format';
import { getVisibleLocals } from '@lsp/handlers/lexical';

import type { DocumentManager, ParsedDocument } from '@typings/lsp';
import type { LuauType } from '@typings/types';
import type { CompletionItem, Position } from 'vscode-languageserver';

/** Suggests global symbols. */
export const getGlobalCompletions = (documentManager: DocumentManager, prefix: string): CompletionItem[] => {
  const items: CompletionItem[] = [];
  const env = documentManager.globalEnv.env;

  for (const [name, symbol] of env.globalScope.symbols) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const item: CompletionItem = {
      'label': name,
      'kind': typeToCompletionKind(symbol.type),
    };

    if (symbol.type.kind === 'Function') {
      item.detail = formatFunctionDetail(symbol.type);
      item.insertText = formatFunctionSnippet(name, symbol.type);
      item.insertTextFormat = InsertTextFormat.Snippet;
    }

    item.data = { 'resolve': 'global', 'name': name };

    if (symbol.docComment?.deprecated !== undefined) item.tags = [CompletionItemTag.Deprecated];

    items.push(item);
  }

  return items;
};

const LUAU_SNIPPETS: ReadonlyArray<{
  label: string;
  insertText: string;
  detail: string;
  documentation: string;
}> = [
  {
    'label': 'function',
    'insertText': 'function ${1:name}(${2:args})\n\t$0\nend',
    'detail': 'Function declaration',
    'documentation': 'Creates a new function with name and arguments.',
  },
  {
    'label': 'local function',
    'insertText': 'local function ${1:name}(${2:args})\n\t$0\nend',
    'detail': 'Local function declaration',
    'documentation': 'Creates a new local function.',
  },
  {
    'label': 'if',
    'insertText': 'if ${1:condition} then\n\t$0\nend',
    'detail': 'If statement',
    'documentation': 'Creates an if statement block.',
  },
  {
    'label': 'if else',
    'insertText': 'if ${1:condition} then\n\t$2\nelse\n\t$0\nend',
    'detail': 'If-else statement',
    'documentation': 'Creates an if-else statement block.',
  },
  {
    'label': 'if elseif',
    'insertText': 'if ${1:condition} then\n\t$2\nelseif ${3:condition} then\n\t$0\nend',
    'detail': 'If-elseif statement',
    'documentation': 'Creates an if-elseif statement block.',
  },
  {
    'label': 'for',
    'insertText': 'for ${1:i} = ${2:1}, ${3:10} do\n\t$0\nend',
    'detail': 'Numeric for loop',
    'documentation': 'Creates a numeric for loop.',
  },
  {
    'label': 'for in',
    'insertText': 'for ${1:key}, ${2:value} in ${3:pairs}(${4:table}) do\n\t$0\nend',
    'detail': 'Generic for loop',
    'documentation': 'Creates a generic for loop with pairs/ipairs.',
  },
  {
    'label': 'for ipairs',
    'insertText': 'for ${1:index}, ${2:value} in ipairs(${3:array}) do\n\t$0\nend',
    'detail': 'For loop with ipairs',
    'documentation': 'Iterate over array indices.',
  },
  {
    'label': 'for pairs',
    'insertText': 'for ${1:key}, ${2:value} in pairs(${3:table}) do\n\t$0\nend',
    'detail': 'For loop with pairs',
    'documentation': 'Iterate over table key-value pairs.',
  },
  {
    'label': 'while',
    'insertText': 'while ${1:condition} do\n\t$0\nend',
    'detail': 'While loop',
    'documentation': 'Creates a while loop.',
  },
  {
    'label': 'repeat',
    'insertText': 'repeat\n\t$0\nuntil ${1:condition}',
    'detail': 'Repeat-until loop',
    'documentation': 'Creates a repeat-until loop.',
  },
  {
    'label': 'do',
    'insertText': 'do\n\t$0\nend',
    'detail': 'Do block',
    'documentation': 'Creates a do-end block for scoping.',
  },
  {
    'label': 'return',
    'insertText': 'return $0',
    'detail': 'Return statement',
    'documentation': 'Returns value(s) from function.',
  },
  {
    'label': 'local',
    'insertText': 'local ${1:name} = $0',
    'detail': 'Local variable',
    'documentation': 'Declares a local variable.',
  },
  {
    'label': 'then',
    'insertText': 'then\n\t$0\nend',
    'detail': 'Then block',
    'documentation': 'Completes an if statement.',
  },
  {
    'label': 'connect',
    'insertText': 'Connect(function(${1:args})\n\t$0\nend)',
    'detail': 'Connect to event',
    'documentation': 'Connects a callback function to an event.',
  },
  {
    'label': 'task.spawn',
    'insertText': 'task.spawn(function()\n\t$0\nend)',
    'detail': 'Spawn new thread',
    'documentation': 'Spawns a new thread to run code.',
  },
  {
    'label': 'task.delay',
    'insertText': 'task.delay(${1:seconds}, function()\n\t$0\nend)',
    'detail': 'Delayed execution',
    'documentation': 'Runs code after a delay.',
  },
  {
    'label': 'pcall',
    'insertText': 'local ${1:success}, ${2:result} = pcall(function()\n\t$0\nend)',
    'detail': 'Protected call',
    'documentation': 'Wraps code in a protected call to catch errors.',
  },
  {
    'label': 'xpcall',
    'insertText': 'local ${1:success}, ${2:result} = xpcall(function()\n\t$3\nend, function(${4:err})\n\t$0\nend)',
    'detail': 'Extended protected call',
    'documentation': 'Protected call with custom error handler.',
  },
  {
    'label': 'module',
    'insertText': 'local ${1:Module} = {}\n\nfunction ${1:Module}.${2:init}()\n\t$0\nend\n\nreturn ${1:Module}',
    'detail': 'Module template',
    'documentation': 'Creates a basic ModuleScript template.',
  },
  {
    'label': 'class',
    'insertText':
      'local ${1:ClassName} = {}\n${1:ClassName}.__index = ${1:ClassName}\n\nfunction ${1:ClassName}.new(${2:args})\n\tlocal self = setmetatable({}, ${1:ClassName})\n\t$0\n\treturn self\nend\n\nreturn ${1:ClassName}',
    'detail': 'OOP class template',
    'documentation': 'Creates an OOP-style class with constructor.',
  },
];

/** Suggests Luau statement snippets. */
export const getSnippetCompletions = (prefix: string): CompletionItem[] => {
  const items: CompletionItem[] = [];

  for (const snippet of LUAU_SNIPPETS) {
    if (prefix !== '' && snippet.label.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    items.push({
      'label': snippet.label,
      'kind': CompletionItemKind.Snippet,
      'detail': snippet.detail,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': snippet.documentation,
      },
      'insertText': snippet.insertText,
      'insertTextFormat': InsertTextFormat.Snippet,
      'sortText': `1_${snippet.label}`,
    });
  }

  return items;
};

/** Suggests document-local symbols visible at the cursor, falling back to every checked non-global symbol. */
export const getLocalSymbolCompletions = (
  document: ParsedDocument | undefined,
  prefix: string,
  documentManager: DocumentManager,
  position: Position,
): CompletionItem[] => {
  if (document === undefined || document.typeCheckResult === undefined) return [];

  const items: CompletionItem[] = [];
  const environment = document.typeCheckResult.environment;
  const hasLexical = environment.localBindings !== undefined;
  const visible = new Map<string, LuauType>();

  if (hasLexical) for (const [name, symbol] of getVisibleLocals(document, position)) visible.set(name, symbol.type);

  const symbols = hasLexical ? visible : document.typeCheckResult.allSymbols;

  for (const [name, symbolType] of symbols) {
    if (
      hasLexical === false &&
      documentManager.globalEnv.env.globalScope.symbols.has(name) &&
      environment.globalScope.symbols.get(name)?.kind === 'Global'
    )
      continue;
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const resolved = resolveTypeReference(symbolType, documentManager);
    const item: CompletionItem = {
      'label': name,
      'kind': typeToCompletionKind(resolved),
      'detail': resolved.kind === 'Function' ? formatFunctionDetail(resolved) : resolved.kind,
      'sortText': `0${name}`,
    };

    if (resolved.kind === 'Function') {
      item.insertText = formatFunctionSnippet(name, resolved);
      item.insertTextFormat = InsertTextFormat.Snippet;
    }

    items.push(item);
  }

  return items;
};

/** Suggests local type aliases, Roblox classes, data types and primitives after a type annotation colon. */
export const getTypeAnnotationCompletions = (
  beforeCursor: string,
  document: ParsedDocument | undefined,
  documentManager: DocumentManager,
): CompletionItem[] | undefined => {
  const typeAnnotMatch = beforeCursor.match(/\w\s*:\s+(\w*)$/) ?? beforeCursor.match(/\)\s*:\s*(\w*)$/);
  if (typeAnnotMatch === null) return undefined;

  const prefix = typeAnnotMatch[1] ?? '';
  const items: CompletionItem[] = [];
  const addedNames = new Set<string>();

  const addType = (name: string, detail: string, sortPrefix: string): void => {
    if (addedNames.has(name)) return;
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) return;
    addedNames.add(name);
    items.push({
      'label': name,
      'kind': CompletionItemKind.TypeParameter,
      'detail': detail,
      'sortText': `${sortPrefix}${name}`,
    });
  };

  if (document?.typeCheckResult !== undefined) {
    const walkScope = (scope: typeof document.typeCheckResult.environment.globalScope): void => {
      for (const [name] of scope.types) addType(name, 'type alias', '0_');
      if (scope.parent !== undefined) walkScope(scope.parent);
    };
    walkScope(document.typeCheckResult.environment.globalScope);
  }

  for (const [name] of documentManager.globalEnv.robloxClasses) addType(name, 'Roblox class', '1_');
  for (const [name] of documentManager.globalEnv.robloxDataTypes) addType(name, 'Roblox type', '1_');

  const builtinTypes = ['string', 'number', 'boolean', 'nil', 'any', 'never', 'unknown', 'thread', 'buffer'];
  for (const name of builtinTypes) addType(name, 'primitive', '2_');

  return items.length > 0 ? items : undefined;
};
