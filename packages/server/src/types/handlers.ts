import type { DocumentHighlightKind, Range, SymbolKind } from 'vscode-languageserver';
import type { Statement, TypeAnnotation } from '@typings/ast';
import type { ClassMethod, ClassProperty } from '@typings/types';

/** Zero-based single-line span of an identifier reference. */
export interface ReferenceLocation {
  readonly line: number;
  readonly character: number;
  readonly endCharacter: number;
}

/** Reference span tagged with its read/write highlight kind. */
export interface HighlightLocation {
  readonly line: number;
  readonly character: number;
  readonly endCharacter: number;
  readonly kind: DocumentHighlightKind;
}

/** Zero-based span of a named declaration used for symbol lookups. */
export interface SymbolLocation {
  readonly name: string;
  readonly line: number;
  readonly character: number;
  readonly endLine: number;
  readonly endCharacter: number;
}

/** Function declaration collected for call hierarchy items, with its body for call-site scanning. */
export interface CallHierarchyFunctionInfo {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly range: Range;
  readonly selectionRange: Range;
  readonly bodyStatements: ReadonlyArray<Statement>;
}

/** Call expression site reported as an incoming or outgoing call. */
export interface CallSite {
  readonly name: string;
  readonly range: Range;
}

/** Function name and selection range used to anchor a reference-count code lens. */
export interface CodeLensFunctionInfo {
  readonly name: string;
  readonly selectionRange: Range;
}

/** Zero-based start/end span converted from an AST node range for selection ranges. */
export interface AstRange {
  readonly startLine: number;
  readonly startCharacter: number;
  readonly endLine: number;
  readonly endCharacter: number;
}

/** Local type alias declaration with its annotation and source ranges. */
export interface TypeAliasInfo {
  readonly name: string;
  readonly range: Range;
  readonly selectionRange: Range;
  readonly type: TypeAnnotation;
}

/** Table-constructor context at the cursor: the called function, argument index, and fields already written. */
export interface TableContextInfo {
  readonly functionName: string;
  readonly paramIndex: number;
  readonly existingFields: Set<string>;
  readonly prefix: string;
}

/** Single semantic token prior to delta encoding. */
export interface TokenInfo {
  line: number;
  character: number;
  length: number;
  tokenType: number;
  modifiers: number;
}

/** Deprecation flag and optional replacement message attached to hover documentation. */
export interface DeprecationInfo {
  deprecated: boolean;
  message: string | undefined;
}

/** `object.member` or `object:method` access found under the cursor. */
export interface MemberAccessInfo {
  objectName: string;
  memberName: string;
  isMethod: boolean;
}

/** Color constructor call (`Color3.fromRGB`, `Color3.new`, `Color3.fromHex`) located in source text. */
export interface ColorMatch {
  readonly start: number;
  readonly end: number;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
  readonly type: 'fromRGB' | 'new' | 'fromHex';
}

/** Class member resolved through the inheritance chain, or `undefined` when no member matches. */
export type ClassMemberLookupResult =
  | { kind: 'property'; prop: ClassProperty; declaringClass: string }
  | { kind: 'method'; method: ClassMethod; declaringClass: string }
  | { kind: 'commonChild'; childName: string; childTypeName: string }
  | undefined;

/** Declaration position and every reference of a scoped local, used for linked editing. */
export interface ScopeEntry {
  readonly declarationLine: number;
  readonly declarationColumn: number;
  readonly references: ReferenceLocation[];
}

/** Zero-based span of a type declaration name used for go-to-type-definition. */
export interface TypeDeclarationLocation {
  readonly name: string;
  readonly line: number;
  readonly character: number;
  readonly endLine: number;
  readonly endCharacter: number;
}

/** MCP tool call result: text content blocks plus an optional error flag. */
export type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

/** Payload round-tripped on code lens and hierarchy items, naming the symbol and its document. */
export interface NamedItemData {
  readonly name: string;
  readonly uri: string;
}

/** Deferred-documentation payload attached to member and global completion items. */
export type CompletionItemData =
  | { readonly resolve: 'member'; readonly class: string; readonly member: string }
  | { readonly resolve: 'global'; readonly name: string };
