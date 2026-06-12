import { walk } from '@parser/visitor';
import { SemanticTokenModifiers, SemanticTokensBuilder, SemanticTokenTypes } from 'vscode-languageserver';

import type { Chunk, Identifier } from '@typings/ast';
import type { TokenInfo } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type {
  Connection,
  SemanticTokens,
  SemanticTokensLegend,
  SemanticTokensParams,
  SemanticTokensRangeParams,
} from 'vscode-languageserver';

const TOKEN_TYPES = [
  SemanticTokenTypes.namespace,
  SemanticTokenTypes.type,
  SemanticTokenTypes.class,
  SemanticTokenTypes.enum,
  SemanticTokenTypes.enumMember,
  SemanticTokenTypes.function,
  SemanticTokenTypes.method,
  SemanticTokenTypes.parameter,
  SemanticTokenTypes.variable,
  SemanticTokenTypes.property,
  SemanticTokenTypes.keyword,
  SemanticTokenTypes.string,
  SemanticTokenTypes.number,
  SemanticTokenTypes.operator,
  SemanticTokenTypes.comment,
];

const TOKEN_MODIFIERS = [
  SemanticTokenModifiers.declaration,
  SemanticTokenModifiers.definition,
  SemanticTokenModifiers.readonly,
  SemanticTokenModifiers.deprecated,
  SemanticTokenModifiers.modification,
  SemanticTokenModifiers.documentation,
  SemanticTokenModifiers.defaultLibrary,
];

/** The semantic token legend mapping token types and modifiers to their numeric indices. */
export const semanticTokensLegend: SemanticTokensLegend = {
  'tokenTypes': TOKEN_TYPES,
  'tokenModifiers': TOKEN_MODIFIERS,
};

const TOKEN_TYPE_TYPE = 1;
const TOKEN_TYPE_CLASS = 2;
const TOKEN_TYPE_ENUM = 3;
const TOKEN_TYPE_ENUM_MEMBER = 4;
const TOKEN_TYPE_FUNCTION = 5;
const TOKEN_TYPE_METHOD = 6;
const TOKEN_TYPE_PARAMETER = 7;
const TOKEN_TYPE_VARIABLE = 8;
const TOKEN_TYPE_PROPERTY = 9;

const MOD_DECLARATION = 1 << 0;
const MOD_DEFAULT_LIBRARY = 1 << 6;

const BUILTIN_GLOBALS = new Set([
  'print',
  'warn',
  'error',
  'assert',
  'type',
  'typeof',
  'tostring',
  'tonumber',
  'select',
  'next',
  'pairs',
  'ipairs',
  'rawget',
  'rawset',
  'rawequal',
  'rawlen',
  'setmetatable',
  'getmetatable',
  'pcall',
  'xpcall',
  'require',
  'loadstring',
  'newproxy',
  'unpack',
  'gcinfo',
  'collectgarbage',
  'game',
  'workspace',
  'script',
  'plugin',
  'shared',
  '_G',
  'Enum',
  'Instance',
  'Vector3',
  'Vector2',
  'CFrame',
  'Color3',
  'UDim',
  'UDim2',
  'Rect',
  'Ray',
  'BrickColor',
  'TweenInfo',
  'NumberRange',
  'NumberSequence',
  'ColorSequence',
  'Region3',
  'Axes',
  'Faces',
  'PhysicalProperties',
  'Random',
  'DateTime',
  'task',
  'debug',
  'math',
  'string',
  'table',
  'coroutine',
  'bit32',
  'utf8',
  'buffer',
  'os',
  'tick',
  'time',
  'elapsedTime',
  'wait',
  'delay',
  'spawn',
]);

const ROBLOX_CLASSES = new Set([
  'Instance',
  'Part',
  'Model',
  'Humanoid',
  'Player',
  'Players',
  'Workspace',
  'ReplicatedStorage',
  'ServerStorage',
  'ServerScriptService',
  'StarterGui',
  'StarterPlayer',
  'StarterPack',
  'Teams',
  'Lighting',
  'SoundService',
  'RunService',
  'UserInputService',
  'TweenService',
  'DataStoreService',
  'HttpService',
  'MarketplaceService',
  'TextService',
  'PathfindingService',
  'CollectionService',
  'Debris',
  'PhysicsService',
  'ContextActionService',
  'GuiService',
  'MessagingService',
  'MemoryStoreService',
  'PolicyService',
  'SocialService',
  'TeleportService',
  'ProximityPromptService',
  'Chat',
  'BasePart',
  'MeshPart',
  'UnionOperation',
  'WedgePart',
  'SpawnLocation',
  'Frame',
  'TextLabel',
  'TextButton',
  'TextBox',
  'ImageLabel',
  'ImageButton',
  'ScrollingFrame',
  'ViewportFrame',
  'ScreenGui',
  'SurfaceGui',
  'BillboardGui',
  'Sound',
  'Animation',
  'AnimationTrack',
  'Animator',
  'Tool',
  'Accessory',
  'RemoteEvent',
  'RemoteFunction',
  'BindableEvent',
  'BindableFunction',
  'Folder',
  'Configuration',
  'Camera',
  'Attachment',
  'Beam',
  'Trail',
  'ParticleEmitter',
  'PointLight',
  'SpotLight',
  'SurfaceLight',
  'Highlight',
]);

/**
 * Collects semantic tokens from the AST for enhanced syntax highlighting.
 * @param chunk - The parsed AST chunk to scan.
 * @returns An array of token info objects with type, modifier, and position.
 */
export const collectSemanticTokens = (chunk: Chunk): TokenInfo[] => {
  const tokens: TokenInfo[] = [];
  const parameterNames = new Set<string>();
  const localVariables = new Set<string>();
  const localFunctions = new Set<string>();

  const addToken = (
    node: { range: { start: { line: number; column: number } } },
    length: number,
    tokenType: number,
    modifiers = 0,
  ) => {
    tokens.push({
      'line': node.range.start.line - 1,
      'character': node.range.start.column - 1,
      length,
      tokenType,
      modifiers,
    });
  };

  const classifyIdentifier = (ident: Identifier, isDeclaration: boolean, isMethodCall: boolean): void => {
    const name = ident.name;
    let tokenType = TOKEN_TYPE_VARIABLE;
    let modifiers = isDeclaration ? MOD_DECLARATION : 0;

    if (parameterNames.has(name)) tokenType = TOKEN_TYPE_PARAMETER;
    else if (localFunctions.has(name)) tokenType = TOKEN_TYPE_FUNCTION;
    else if (isMethodCall) tokenType = TOKEN_TYPE_METHOD;
    else if (BUILTIN_GLOBALS.has(name)) {
      tokenType = TOKEN_TYPE_VARIABLE;
      modifiers |= MOD_DEFAULT_LIBRARY;
    } else if (ROBLOX_CLASSES.has(name)) {
      tokenType = TOKEN_TYPE_CLASS;
      modifiers |= MOD_DEFAULT_LIBRARY;
    } else if (name === 'Enum') {
      tokenType = TOKEN_TYPE_ENUM;
      modifiers |= MOD_DEFAULT_LIBRARY;
    }

    addToken(ident, name.length, tokenType, modifiers);
  };

  walk(chunk, {
    'visitLocalDeclaration': node => {
      for (const name of node.names) {
        localVariables.add(name.name);
        classifyIdentifier(name, true, false);
      }
    },

    'visitLocalFunction': node => {
      localFunctions.add(node.name.name);
      addToken(node.name, node.name.name.length, TOKEN_TYPE_FUNCTION, MOD_DECLARATION);

      for (const param of node.func.params)
        if (param.name !== undefined) {
          parameterNames.add(param.name.name);
          addToken(param.name, param.name.name.length, TOKEN_TYPE_PARAMETER, MOD_DECLARATION);
        }
    },

    'visitFunctionDeclaration': node => {
      addToken(node.name.base, node.name.base.name.length, TOKEN_TYPE_FUNCTION, MOD_DECLARATION);

      for (const part of node.name.path) addToken(part, part.name.length, TOKEN_TYPE_PROPERTY);

      if (node.name.method !== undefined)
        addToken(node.name.method, node.name.method.name.length, TOKEN_TYPE_METHOD, MOD_DECLARATION);

      for (const param of node.func.params)
        if (param.name !== undefined) {
          parameterNames.add(param.name.name);
          addToken(param.name, param.name.name.length, TOKEN_TYPE_PARAMETER, MOD_DECLARATION);
        }
    },

    'visitTypeAlias': node => addToken(node.name, node.name.name.length, TOKEN_TYPE_TYPE, MOD_DECLARATION),

    'visitIdentifier': node => {
      if (localVariables.has(node.name) || localFunctions.has(node.name)) return;
      classifyIdentifier(node, false, false);
    },

    'visitMemberExpression': node => {
      const propName = node.property.name;

      if (node.object.kind === 'Identifier' && node.object.name === 'Enum')
        return addToken(node.property, propName.length, TOKEN_TYPE_ENUM);

      if (
        node.object.kind === 'MemberExpression' &&
        node.object.object.kind === 'Identifier' &&
        node.object.object.name === 'Enum'
      )
        return addToken(node.property, propName.length, TOKEN_TYPE_ENUM_MEMBER);

      addToken(node.property, propName.length, TOKEN_TYPE_PROPERTY);
    },

    'visitMethodCallExpression': node => addToken(node.method, node.method.name.length, TOKEN_TYPE_METHOD),

    'visitCallExpression': node => {
      if (node.callee.kind === 'Identifier') {
        const name = node.callee.name;
        let modifiers = 0;

        if (BUILTIN_GLOBALS.has(name)) modifiers |= MOD_DEFAULT_LIBRARY;

        addToken(node.callee, name.length, TOKEN_TYPE_FUNCTION, modifiers);
      }
    },

    'visitTypeReference': node => {
      if (ROBLOX_CLASSES.has(node.name))
        tokens.push({
          'line': node.range.start.line - 1,
          'character': node.range.start.column - 1,
          'length': node.name.length,
          'tokenType': TOKEN_TYPE_CLASS,
          'modifiers': MOD_DEFAULT_LIBRARY,
        });
      else
        tokens.push({
          'line': node.range.start.line - 1,
          'character': node.range.start.column - 1,
          'length': node.name.length,
          'tokenType': TOKEN_TYPE_TYPE,
          'modifiers': 0,
        });
    },

    'visitForNumeric': node => addToken(node.variable, node.variable.name.length, TOKEN_TYPE_VARIABLE, MOD_DECLARATION),

    'visitForGeneric': node => {
      for (const v of node.variables) addToken(v, v.name.length, TOKEN_TYPE_VARIABLE, MOD_DECLARATION);
    },
  });

  tokens.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.character - b.character;
  });

  const uniqueTokens: TokenInfo[] = [];
  let lastLine = -1;
  let lastChar = -1;

  for (const token of tokens)
    if (token.line !== lastLine || token.character !== lastChar) {
      uniqueTokens.push(token);
      lastLine = token.line;
      lastChar = token.character;
    }

  return uniqueTokens;
};

const buildSemanticTokens = (tokenInfos: TokenInfo[]): SemanticTokens => {
  const builder = new SemanticTokensBuilder();

  for (const token of tokenInfos)
    builder.push(token.line, token.character, token.length, token.tokenType, token.modifiers);

  return builder.build();
};

const tokenCache = new WeakMap<Chunk, TokenInfo[]>();

const cachedSemanticTokens = (ast: Chunk): TokenInfo[] => {
  const cached = tokenCache.get(ast);
  if (cached !== undefined) return cached;

  const tokens = collectSemanticTokens(ast);
  tokenCache.set(ast, tokens);
  return tokens;
};

/** Provides enhanced syntax highlighting by classifying tokens based on their semantic meaning. */
export const setupSemanticTokensHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.languages.semanticTokens.on((params: SemanticTokensParams): SemanticTokens => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return { 'data': [] };

    return buildSemanticTokens(cachedSemanticTokens(document.ast));
  });

  connection.languages.semanticTokens.onRange((params: SemanticTokensRangeParams): SemanticTokens => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return { 'data': [] };

    const allTokens = cachedSemanticTokens(document.ast);
    const startLine = params.range.start.line;
    const endLine = params.range.end.line;

    const filtered = allTokens.filter(token => token.line >= startLine && token.line <= endLine);

    return buildSemanticTokens(filtered);
  });
};
