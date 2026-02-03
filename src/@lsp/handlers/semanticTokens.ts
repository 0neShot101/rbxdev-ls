/**
 * Semantic Tokens Handler
 * Provides enhanced syntax highlighting by classifying tokens semantically
 */

import { walk } from '@parser/visitor';
import { SemanticTokenModifiers, SemanticTokensBuilder, SemanticTokenTypes } from 'vscode-languageserver';

import type { DocumentManager } from '@lsp/documents';
import type { Chunk, Identifier } from '@parser/ast';
import type { Connection, SemanticTokens, SemanticTokensLegend, SemanticTokensParams } from 'vscode-languageserver';

// Token types we support
const TOKEN_TYPES = [
  SemanticTokenTypes.namespace, // 0 - modules
  SemanticTokenTypes.type, // 1 - type names
  SemanticTokenTypes.class, // 2 - class names (Roblox classes)
  SemanticTokenTypes.enum, // 3 - enum types
  SemanticTokenTypes.enumMember, // 4 - enum items
  SemanticTokenTypes.function, // 5 - functions
  SemanticTokenTypes.method, // 6 - methods
  SemanticTokenTypes.parameter, // 7 - function parameters
  SemanticTokenTypes.variable, // 8 - variables
  SemanticTokenTypes.property, // 9 - properties
  SemanticTokenTypes.keyword, // 10 - keywords
  SemanticTokenTypes.string, // 11 - strings
  SemanticTokenTypes.number, // 12 - numbers
  SemanticTokenTypes.operator, // 13 - operators
  SemanticTokenTypes.comment, // 14 - comments
];

// Token modifiers we support
const TOKEN_MODIFIERS = [
  SemanticTokenModifiers.declaration, // 0 - where defined
  SemanticTokenModifiers.definition, // 1 - where implemented
  SemanticTokenModifiers.readonly, // 2 - constants
  SemanticTokenModifiers.deprecated, // 3 - deprecated
  SemanticTokenModifiers.modification, // 4 - being modified
  SemanticTokenModifiers.documentation, // 5 - doc comments
  SemanticTokenModifiers.defaultLibrary, // 6 - built-in
];

export const semanticTokensLegend: SemanticTokensLegend = {
  'tokenTypes': TOKEN_TYPES,
  'tokenModifiers': TOKEN_MODIFIERS,
};

// Token type indices
const TOKEN_TYPE_TYPE = 1;
const TOKEN_TYPE_CLASS = 2;
const TOKEN_TYPE_ENUM = 3;
const TOKEN_TYPE_ENUM_MEMBER = 4;
const TOKEN_TYPE_FUNCTION = 5;
const TOKEN_TYPE_METHOD = 6;
const TOKEN_TYPE_PARAMETER = 7;
const TOKEN_TYPE_VARIABLE = 8;
const TOKEN_TYPE_PROPERTY = 9;

// Modifier bit flags
const MOD_DECLARATION = 1 << 0;
const MOD_DEFAULT_LIBRARY = 1 << 6;

// Built-in globals that should be marked as defaultLibrary
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
  // Roblox globals
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

// Roblox class names for semantic highlighting
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
  // Common classes
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
 * Represents a semantic token with its position and classification.
 * @param line - The zero-indexed line number of the token
 * @param character - The zero-indexed character position within the line
 * @param length - The length of the token in characters
 * @param tokenType - The index of the token type from TOKEN_TYPES
 * @param modifiers - Bit flags representing token modifiers from TOKEN_MODIFIERS
 */
interface TokenInfo {
  line: number;
  character: number;
  length: number;
  tokenType: number;
  modifiers: number;
}

/**
 * Collects semantic tokens from the AST by walking the tree and classifying
 * identifiers, function calls, type references, and other syntax elements.
 * @param chunk - The root AST node of the parsed document
 * @returns A sorted array of TokenInfo objects representing all semantic tokens
 */
const collectSemanticTokens = (chunk: Chunk): TokenInfo[] => {
  const tokens: TokenInfo[] = [];
  const parameterNames = new Set<string>();
  const localVariables = new Set<string>();
  const localFunctions = new Set<string>();

  // Helper to add a token
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

  // Helper to classify an identifier
  const classifyIdentifier = (ident: Identifier, isDeclaration: boolean, isMethodCall: boolean): void => {
    const name = ident.name;
    let tokenType = TOKEN_TYPE_VARIABLE;
    let modifiers = isDeclaration ? MOD_DECLARATION : 0;

    // Check if it's a parameter
    if (parameterNames.has(name)) {
      tokenType = TOKEN_TYPE_PARAMETER;
    }
    // Check if it's a local function
    else if (localFunctions.has(name)) {
      tokenType = TOKEN_TYPE_FUNCTION;
    }
    // Check if it's a method call
    else if (isMethodCall) {
      tokenType = TOKEN_TYPE_METHOD;
    }
    // Check if it's a built-in global
    else if (BUILTIN_GLOBALS.has(name)) {
      tokenType = TOKEN_TYPE_VARIABLE;
      modifiers |= MOD_DEFAULT_LIBRARY;
    }
    // Check if it's a Roblox class name
    else if (ROBLOX_CLASSES.has(name)) {
      tokenType = TOKEN_TYPE_CLASS;
      modifiers |= MOD_DEFAULT_LIBRARY;
    }
    // Check for Enum pattern
    else if (name === 'Enum') {
      tokenType = TOKEN_TYPE_ENUM;
      modifiers |= MOD_DEFAULT_LIBRARY;
    }

    addToken(ident, name.length, tokenType, modifiers);
  };

  // Walk the AST
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

      // Track parameters
      for (const param of node.func.params) {
        if (param.name !== undefined) {
          parameterNames.add(param.name.name);
          addToken(param.name, param.name.name.length, TOKEN_TYPE_PARAMETER, MOD_DECLARATION);
        }
      }
    },

    'visitFunctionDeclaration': node => {
      // Base name
      addToken(node.name.base, node.name.base.name.length, TOKEN_TYPE_FUNCTION, MOD_DECLARATION);

      // Path parts (e.g., Module.SubModule)
      for (const part of node.name.path) {
        addToken(part, part.name.length, TOKEN_TYPE_PROPERTY);
      }

      // Method name
      if (node.name.method !== undefined) {
        addToken(node.name.method, node.name.method.name.length, TOKEN_TYPE_METHOD, MOD_DECLARATION);
      }

      // Track parameters
      for (const param of node.func.params) {
        if (param.name !== undefined) {
          parameterNames.add(param.name.name);
          addToken(param.name, param.name.name.length, TOKEN_TYPE_PARAMETER, MOD_DECLARATION);
        }
      }
    },

    'visitTypeAlias': node => {
      addToken(node.name, node.name.name.length, TOKEN_TYPE_TYPE, MOD_DECLARATION);
    },

    'visitIdentifier': node => {
      // Skip if already handled as declaration
      if (localVariables.has(node.name) || localFunctions.has(node.name)) {
        // Check if this is the declaration site (handled above)
        return;
      }
      classifyIdentifier(node, false, false);
    },

    'visitMemberExpression': node => {
      // The property access
      const propName = node.property.name;

      // Check for Enum.EnumType pattern
      if (node.object.kind === 'Identifier' && node.object.name === 'Enum') {
        addToken(node.property, propName.length, TOKEN_TYPE_ENUM);
        return;
      }

      // Check for Enum.EnumType.EnumItem pattern
      if (
        node.object.kind === 'MemberExpression' &&
        node.object.object.kind === 'Identifier' &&
        node.object.object.name === 'Enum'
      ) {
        addToken(node.property, propName.length, TOKEN_TYPE_ENUM_MEMBER);
        return;
      }

      // Regular property access
      addToken(node.property, propName.length, TOKEN_TYPE_PROPERTY);
    },

    'visitMethodCallExpression': node => {
      addToken(node.method, node.method.name.length, TOKEN_TYPE_METHOD);
    },

    'visitCallExpression': node => {
      // If callee is an identifier, mark it as a function
      if (node.callee.kind === 'Identifier') {
        const name = node.callee.name;
        let modifiers = 0;

        if (BUILTIN_GLOBALS.has(name)) {
          modifiers |= MOD_DEFAULT_LIBRARY;
        }

        addToken(node.callee, name.length, TOKEN_TYPE_FUNCTION, modifiers);
      }
    },

    'visitTypeReference': node => {
      // Check if it's a Roblox class
      if (ROBLOX_CLASSES.has(node.name)) {
        // Create a synthetic position for the type name
        tokens.push({
          'line': node.range.start.line - 1,
          'character': node.range.start.column - 1,
          'length': node.name.length,
          'tokenType': TOKEN_TYPE_CLASS,
          'modifiers': MOD_DEFAULT_LIBRARY,
        });
      } else {
        tokens.push({
          'line': node.range.start.line - 1,
          'character': node.range.start.column - 1,
          'length': node.name.length,
          'tokenType': TOKEN_TYPE_TYPE,
          'modifiers': 0,
        });
      }
    },

    'visitForNumeric': node => {
      addToken(node.variable, node.variable.name.length, TOKEN_TYPE_VARIABLE, MOD_DECLARATION);
    },

    'visitForGeneric': node => {
      for (const v of node.variables) {
        addToken(v, v.name.length, TOKEN_TYPE_VARIABLE, MOD_DECLARATION);
      }
    },
  });

  // Sort tokens by position (required by LSP)
  tokens.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.character - b.character;
  });

  // Remove duplicates (same position)
  const uniqueTokens: TokenInfo[] = [];
  let lastLine = -1;
  let lastChar = -1;

  for (const token of tokens) {
    if (token.line !== lastLine || token.character !== lastChar) {
      uniqueTokens.push(token);
      lastLine = token.line;
      lastChar = token.character;
    }
  }

  return uniqueTokens;
};

/**
 * Builds the final SemanticTokens object in LSP delta-encoded format
 * from an array of token information.
 * @param tokenInfos - The array of TokenInfo objects to encode
 * @returns A SemanticTokens object with delta-encoded position data
 */
const buildSemanticTokens = (tokenInfos: TokenInfo[]): SemanticTokens => {
  const builder = new SemanticTokensBuilder();

  for (const token of tokenInfos)
    builder.push(token.line, token.character, token.length, token.tokenType, token.modifiers);

  return builder.build();
};

/**
 * Registers the semantic tokens handler with the LSP connection.
 * Provides enhanced syntax highlighting by classifying tokens based on
 * their semantic meaning (e.g., function, variable, parameter, type).
 * @param connection - The LSP connection to register the handler on
 * @param documentManager - The document manager for accessing parsed documents
 * @returns void
 */
export const setupSemanticTokensHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.languages.semanticTokens.on((params: SemanticTokensParams): SemanticTokens => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return { 'data': [] };

    const tokens = collectSemanticTokens(document.ast);
    return buildSemanticTokens(tokens);
  });
};
