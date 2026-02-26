import type { DocumentHighlightKind, Range, SymbolKind } from 'vscode-languageserver';
import type { Statement, TypeAnnotation } from './ast';

export interface ReferenceLocation {
  readonly line: number;
  readonly character: number;
  readonly endCharacter: number;
}

export interface HighlightLocation {
  readonly line: number;
  readonly character: number;
  readonly endCharacter: number;
  readonly kind: DocumentHighlightKind;
}

export interface SymbolLocation {
  readonly name: string;
  readonly line: number;
  readonly character: number;
  readonly endLine: number;
  readonly endCharacter: number;
}

export interface CallHierarchyFunctionInfo {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly range: Range;
  readonly selectionRange: Range;
  readonly bodyStatements: ReadonlyArray<Statement>;
}

export interface CallSite {
  readonly name: string;
  readonly range: Range;
}

export interface CodeLensFunctionInfo {
  readonly name: string;
  readonly selectionRange: Range;
}

export interface AstRange {
  readonly startLine: number;
  readonly startCharacter: number;
  readonly endLine: number;
  readonly endCharacter: number;
}

export interface TypeAliasInfo {
  readonly name: string;
  readonly range: Range;
  readonly selectionRange: Range;
  readonly type: TypeAnnotation;
}

export interface TableContextInfo {
  readonly functionName: string;
  readonly paramIndex: number;
  readonly existingFields: Set<string>;
  readonly prefix: string;
}

export interface TokenInfo {
  line: number;
  character: number;
  length: number;
  tokenType: number;
  modifiers: number;
}

export interface DeprecationInfo {
  deprecated: boolean;
  message: string | undefined;
}

export interface MemberAccessInfo {
  objectName: string;
  memberName: string;
  isMethod: boolean;
}

export interface ColorMatch {
  readonly start: number;
  readonly end: number;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
  readonly type: 'fromRGB' | 'new' | 'fromHex';
}
