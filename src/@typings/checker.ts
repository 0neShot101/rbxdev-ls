/**
 * Luau Type System - Type Checker
 */

import { getCommonChildType } from '@definitions/commonChildren';

import {
  addLuauBuiltins,
  addRobloxGlobals,
  addSuncGlobals,
  createTypeEnvironment,
  defineSymbol,
  defineTypeAlias,
  enterScope,
  exitScope,
  isInLoopScope,
  lookupSymbol,
  lookupTypeAlias,
  type TypeEnvironment,
} from './environment';
import { isLineIgnored, parseIgnoreDirectives, type IgnoreState } from './ignoreDirectives';
import { commonType, isAssignable, isSubtype, type TypeCheckMode } from './subtyping';
import {
  AnyType,
  BooleanType,
  NeverType,
  NilType,
  NumberType,
  StringType,
  createArrayType,
  createBooleanLiteral,
  createErrorType,
  createFunctionType,
  createNumberLiteral,
  createStringLiteral,
  createTableType,
  createUnionType,
  resolveType,
  typeToString,
} from './types';

import type {
  Assignment,
  BinaryExpression,
  CallExpression,
  Chunk,
  CompoundAssignment,
  Expression,
  ForGeneric,
  ForNumeric,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  IfStatement,
  IndexExpression,
  LocalDeclaration,
  LocalFunction,
  MemberExpression,
  MethodCallExpression,
  NodeRange,
  RepeatStatement,
  ReturnStatement,
  Statement,
  TableExpression,
  TypeAlias,
  TypeAnnotation,
  UnaryExpression,
  WhileStatement,
} from '@parser/ast';
import type { DocComment } from '@parser/docComment';
import type {
  ClassMethod,
  ClassProperty,
  ClassType,
  FunctionParam,
  FunctionType,
  LuauType,
  PropertyType,
  TableType,
  TypeParameterDef,
} from '@typings/types';

/**
 * Tag indicating special diagnostic semantics for IDE rendering.
 * - 'deprecated': The referenced symbol is deprecated and should be shown with strikethrough
 * - 'unnecessary': The code is unreachable or unused and should be shown dimmed
 */
export type DiagnosticTag = 'deprecated' | 'unnecessary';

/**
 * Represents a type-related diagnostic message produced by the type checker.
 * Contains all information needed to display the diagnostic in an IDE.
 */
export interface TypeDiagnostic {
  /** The human-readable diagnostic message describing the issue */
  readonly message: string;
  /** The source location range where the diagnostic applies */
  readonly range: NodeRange;
  /** The severity level determining how the diagnostic is displayed */
  readonly severity: 'error' | 'warning' | 'info' | 'hint';
  /** A unique error code identifying the diagnostic type (e.g., 'E001', 'W002') */
  readonly code: string;
  /** Optional tags providing additional semantic information for IDE rendering */
  readonly tags?: ReadonlyArray<DiagnosticTag>;
}

export { typeToString } from './types';

/**
 * The result of type checking a Luau program.
 * Contains diagnostics, the final type environment, and all discovered symbols.
 */
export interface TypeCheckResult {
  /** Array of type diagnostics (errors, warnings, hints) found during type checking */
  readonly diagnostics: ReadonlyArray<TypeDiagnostic>;
  /** The type environment after checking, containing all scope and type information */
  readonly environment: TypeEnvironment;
  /** Map of all symbol names to their inferred or declared types */
  readonly allSymbols: ReadonlyMap<string, LuauType>;
}

interface TypeNarrowing {
  readonly variableName: string;
  readonly narrowedType: LuauType;
}

interface CheckerState {
  readonly env: TypeEnvironment;
  readonly diagnostics: TypeDiagnostic[];
  readonly ignoreState: IgnoreState;
  returnType: LuauType | undefined;
  isVariadic: boolean;
  readonly narrowings: Map<string, LuauType>;
  readonly allSymbols: Map<string, LuauType>;
}

interface CheckerOptions {
  readonly mode?: TypeCheckMode;
  readonly classes?: Map<string, ClassType>;
  readonly ignoreState?: IgnoreState;
}

const createCheckerState = (options: CheckerOptions = {}): CheckerState => {
  const mode = options.mode ?? 'strict';
  const env = createTypeEnvironment(mode);
  addLuauBuiltins(env);
  addRobloxGlobals(env);
  addSuncGlobals(env);

  // Copy provided classes to env.classes for TypeReference resolution
  if (options.classes !== undefined) {
    for (const [name, classType] of options.classes) {
      (env.classes as Map<string, ClassType>).set(name, classType);
    }
  }

  const ignoreState = options.ignoreState ?? { 'ignoredLines': new Set<number>() };

  return {
    env,
    'diagnostics': [],
    ignoreState,
    'returnType': undefined,
    'isVariadic': false,
    'narrowings': new Map(),
    'allSymbols': new Map(),
  };
};

const addDiagnostic = (
  state: CheckerState,
  message: string,
  range: NodeRange,
  severity: 'error' | 'warning' | 'info' = 'error',
  code = 'E000',
  tags?: ReadonlyArray<DiagnosticTag>,
): void => {
  if (isLineIgnored(state.ignoreState, range.start.line)) return;
  const diagnostic: TypeDiagnostic = { message, range, severity, code };
  if (tags !== undefined) (diagnostic as TypeDiagnostic & { tags: ReadonlyArray<DiagnosticTag> }).tags = tags;

  state.diagnostics.push(diagnostic);
};

/** Helper to define a symbol and also track it in allSymbols */
const trackSymbol = (state: CheckerState, name: string, type: LuauType): void => {
  state.allSymbols.set(name, type);
};

/**
 * Widen literal and nil types to their base types for mutable variables.
 * This allows reassignment: `local x = false; x = true` works because x is `boolean`, not literal `false`.
 * For nil, we widen to `any` to allow initial nil assignment then reassignment to any type.
 */
const widenTypeForMutableVariable = (type: LuauType): LuauType => {
  if (type.kind === 'Literal') {
    switch (type.baseType) {
      case 'boolean':
        return BooleanType;
      case 'number':
        return NumberType;
      case 'string':
        return StringType;
    }
  }

  // Widen nil to any (allows `local x = nil` then `x = someValue`)
  if (type.kind === 'Primitive' && type.name === 'nil') {
    return AnyType;
  }

  return type;
};

const extractIsANarrowing = (state: CheckerState, condition: Expression): TypeNarrowing | undefined => {
  // Handle parenthesized expressions: (x:IsA("ClassName"))
  if (condition.kind === 'ParenthesizedExpression') {
    return extractIsANarrowing(state, condition.expression);
  }

  // Pattern: x:IsA("ClassName")
  if (condition.kind === 'MethodCallExpression') {
    if (condition.method.name !== 'IsA') return undefined;
    if (condition.args.length === 0) return undefined;

    const firstArg = condition.args[0]!;
    if (firstArg.kind !== 'StringLiteral') return undefined;

    const className = firstArg.value;
    const classType = state.env.classes.get(className);
    if (classType === undefined) return undefined;

    // Extract variable name from the object
    if (condition.object.kind === 'Identifier') {
      return { 'variableName': condition.object.name, 'narrowedType': classType };
    }

    return undefined;
  }

  // Pattern: x and x:IsA("ClassName") - handle truthiness check combined with IsA
  if (condition.kind === 'BinaryExpression' && condition.operator === 'and') {
    // Check right side for IsA pattern
    const rightNarrowing = extractIsANarrowing(state, condition.right);
    if (rightNarrowing !== undefined) return rightNarrowing;

    // Check left side for IsA pattern
    const leftNarrowing = extractIsANarrowing(state, condition.left);
    if (leftNarrowing !== undefined) return leftNarrowing;
  }

  return undefined;
};

const applyNarrowings = (state: CheckerState, narrowings: ReadonlyArray<TypeNarrowing>): void => {
  for (const narrowing of narrowings) {
    state.narrowings.set(narrowing.variableName, narrowing.narrowedType);
  }
};

const clearNarrowings = (state: CheckerState, narrowings: ReadonlyArray<TypeNarrowing>): void => {
  for (const narrowing of narrowings) {
    state.narrowings.delete(narrowing.variableName);
  }
};

const lookupClassMethod = (classType: ClassType, methodName: string): ClassMethod | undefined => {
  let current: ClassType | undefined = classType;
  while (current !== undefined) {
    const method = current.methods.get(methodName);
    if (method !== undefined) return method;
    current = current.superclass;
  }
  return undefined;
};

const lookupClassProperty = (classType: ClassType, propertyName: string): ClassProperty | undefined => {
  let current: ClassType | undefined = classType;
  while (current !== undefined) {
    const prop = current.properties.get(propertyName);
    if (prop !== undefined) return prop;
    current = current.superclass;
  }
  return undefined;
};

/**
 * Checks a Luau program for type errors and produces diagnostics.
 * Performs full type inference and validation on the AST, tracking all
 * symbols and their types throughout the program.
 * @param chunk - The parsed AST chunk representing the Luau program to check
 * @param options - Optional configuration for type checking behavior
 * @param options.mode - The strictness mode: 'strict', 'nonstrict', or 'nocheck'
 * @param options.classes - Map of Roblox class definitions for instance type resolution
 * @returns The type check result containing diagnostics, environment, and symbol map
 */
export const checkProgram = (
  chunk: Chunk,
  options?: { mode?: TypeCheckMode; classes?: Map<string, ClassType> },
): TypeCheckResult => {
  const lastStatement = chunk.body[chunk.body.length - 1];
  const totalLines = lastStatement !== undefined ? lastStatement.range.end.line : 1;
  const ignoreState = parseIgnoreDirectives(chunk.comments, totalLines);

  const state = createCheckerState({ ...options, ignoreState });
  checkBlock(state, chunk.body);

  return { 'diagnostics': state.diagnostics, 'environment': state.env, 'allSymbols': state.allSymbols };
};

const checkBlock = (state: CheckerState, statements: ReadonlyArray<Statement>): void => {
  for (const stmt of statements) {
    checkStatement(state, stmt);
  }
};

const checkStatement = (state: CheckerState, stmt: Statement): void => {
  switch (stmt.kind) {
    case 'LocalDeclaration':
      checkLocalDeclaration(state, stmt);
      break;

    case 'LocalFunction':
      checkLocalFunction(state, stmt);
      break;

    case 'FunctionDeclaration':
      checkFunctionDeclaration(state, stmt);
      break;

    case 'Assignment':
      checkAssignment(state, stmt);
      break;

    case 'CompoundAssignment':
      checkCompoundAssignment(state, stmt);
      break;

    case 'IfStatement':
      checkIfStatement(state, stmt);
      break;

    case 'WhileStatement':
      checkWhileStatement(state, stmt);
      break;

    case 'RepeatStatement':
      checkRepeatStatement(state, stmt);
      break;

    case 'ForNumeric':
      checkForNumeric(state, stmt);
      break;

    case 'ForGeneric':
      checkForGeneric(state, stmt);
      break;

    case 'DoStatement':
      enterScope(state.env, 'Block');
      checkBlock(state, stmt.body);
      exitScope(state.env);
      break;

    case 'ReturnStatement':
      checkReturnStatement(state, stmt);
      break;

    case 'BreakStatement':
    case 'ContinueStatement':
      if (isInLoopScope(state.env) === false) {
        addDiagnostic(
          state,
          `${stmt.kind === 'BreakStatement' ? 'break' : 'continue'} outside of loop`,
          stmt.range,
          'error',
          'E001',
        );
      }
      break;

    case 'TypeAlias':
      checkTypeAlias(state, stmt);
      break;

    case 'ExportStatement':
      checkTypeAlias(state, stmt.declaration);
      break;

    case 'CallStatement':
      inferExpression(state, stmt.expression);
      break;

    case 'ErrorStatement':
      break;
  }
};

const resolveDocTypeAnnotation = (state: CheckerState, typeStr: string): LuauType | undefined => {
  const trimmed = typeStr.trim();

  // Handle optional types (ending with ?)
  if (trimmed.endsWith('?')) {
    const baseType = resolveDocTypeAnnotation(state, trimmed.slice(0, -1));
    if (baseType === undefined) return undefined;
    return createUnionType([baseType, NilType]);
  }

  // Handle union types (type1|type2)
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|').map(p => p.trim());
    const resolvedTypes: LuauType[] = [];
    for (const part of parts) {
      const resolved = resolveDocTypeAnnotation(state, part);
      if (resolved === undefined) return undefined;
      resolvedTypes.push(resolved);
    }
    return createUnionType(resolvedTypes);
  }

  // Handle array types (type[])
  if (trimmed.endsWith('[]')) {
    const elementType = resolveDocTypeAnnotation(state, trimmed.slice(0, -2));
    if (elementType === undefined) return undefined;
    return createArrayType(elementType);
  }

  // Handle primitive and built-in types
  switch (trimmed) {
    case 'nil':
      return NilType;
    case 'boolean':
    case 'bool':
      return BooleanType;
    case 'number':
    case 'int':
    case 'integer':
    case 'float':
    case 'double':
      return NumberType;
    case 'string':
      return StringType;
    case 'thread':
      return { 'kind': 'Primitive', 'name': 'thread' };
    case 'buffer':
      return { 'kind': 'Primitive', 'name': 'buffer' };
    case 'any':
      return AnyType;
    case 'void':
      return NilType;
    case 'table':
      return createTableType(new Map());
    case 'function':
      return createFunctionType([], AnyType);
    default: {
      const alias = lookupTypeAlias(state.env, trimmed);
      if (alias !== undefined) return alias;
      const classType = state.env.classes.get(trimmed);
      if (classType !== undefined) return classType;
      return undefined;
    }
  }
};

const checkLocalDeclaration = (state: CheckerState, decl: LocalDeclaration): void => {
  const valueTypes: LuauType[] = [];

  for (const value of decl.values) {
    valueTypes.push(inferExpression(state, value));
  }

  const docComment = decl.docComment;

  for (let i = 0; i < decl.names.length; i++) {
    const name = decl.names[i]!;
    const annotatedType = decl.types[i];
    const hasValue = valueTypes[i] !== undefined;
    const valueType = hasValue ? valueTypes[i]! : AnyType;

    let declaredType: LuauType;

    if (annotatedType !== undefined) {
      declaredType = resolveTypeAnnotation(state, annotatedType);

      if (
        hasValue &&
        state.env.mode !== 'nonstrict' &&
        isAssignable(valueType, declaredType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false
      ) {
        addDiagnostic(
          state,
          `Type '${typeToString(valueType)}' is not assignable to type '${typeToString(declaredType)}'`,
          name.range,
          'error',
          'E002',
        );
      }
    } else if (docComment !== undefined && docComment.type !== undefined) {
      const docType = resolveDocTypeAnnotation(state, docComment.type);
      declaredType = docType !== undefined ? docType : widenTypeForMutableVariable(valueType);
    } else {
      // Widen literal types to base types for mutable variables
      // e.g., `local x = false` should be `boolean`, not literal `false`
      declaredType = widenTypeForMutableVariable(valueType);
    }

    defineSymbol(state.env, name.name, declaredType, 'Variable', true, docComment);
    trackSymbol(state, name.name, declaredType);
  }
};

const checkLocalFunction = (state: CheckerState, decl: LocalFunction): void => {
  const funcType = checkFunctionExpressionWithDocComment(state, decl.func, decl.docComment);
  defineSymbol(state.env, decl.name.name, funcType, 'Function', false, decl.docComment);
  trackSymbol(state, decl.name.name, funcType);
};

const checkFunctionDeclaration = (state: CheckerState, decl: FunctionDeclaration): void => {
  const funcType = checkFunctionExpressionWithDocComment(state, decl.func, decl.docComment);

  if (decl.name.path.length === 0 && decl.name.method === undefined) {
    defineSymbol(state.env, decl.name.base.name, funcType, 'Function', false, decl.docComment);
    trackSymbol(state, decl.name.base.name, funcType);
  }
};

const checkFunctionExpression = (state: CheckerState, func: FunctionExpression): FunctionType =>
  checkFunctionExpressionWithDocComment(state, func, undefined);

const checkFunctionExpressionWithDocComment = (
  state: CheckerState,
  func: FunctionExpression,
  docComment: DocComment | undefined,
): FunctionType => {
  enterScope(state.env, 'Function');

  const typeParams: TypeParameterDef[] = [];
  if (func.typeParams !== undefined) {
    for (const param of func.typeParams) {
      const constraint = param.constraint !== undefined ? resolveTypeAnnotation(state, param.constraint) : undefined;
      const defaultType = param.defaultType !== undefined ? resolveTypeAnnotation(state, param.defaultType) : undefined;
      typeParams.push({ 'name': param.name, constraint, defaultType });
    }
  }

  const docParamTypes = new Map<string, LuauType>();
  if (docComment !== undefined) {
    for (const docParam of docComment.params) {
      if (docParam.type !== undefined) {
        const resolvedType = resolveDocTypeAnnotation(state, docParam.type);
        if (resolvedType !== undefined) {
          docParamTypes.set(docParam.name, resolvedType);
        }
      }
    }
  }

  const params: FunctionParam[] = [];
  for (const param of func.params) {
    if (param.name !== undefined) {
      let paramType: LuauType;
      if (param.type !== undefined) {
        paramType = resolveTypeAnnotation(state, param.type);
      } else if (docParamTypes.has(param.name.name)) {
        paramType = docParamTypes.get(param.name.name)!;
      } else {
        paramType = AnyType;
      }
      params.push({ 'name': param.name.name, 'type': paramType, 'optional': false });
      defineSymbol(state.env, param.name.name, paramType, 'Parameter', false);
      trackSymbol(state, param.name.name, paramType);
    } else if (param.isVariadic) {
      const varargType = param.type !== undefined ? resolveTypeAnnotation(state, param.type) : AnyType;
      params.push({ 'name': undefined, 'type': varargType, 'optional': true });
    }
  }

  let declaredReturnType: LuauType | undefined;
  if (func.returnType !== undefined) {
    declaredReturnType = resolveTypeAnnotation(state, func.returnType);
  } else if (docComment !== undefined && docComment.returns.length > 0 && docComment.returns[0]!.type !== undefined) {
    const docReturnType = resolveDocTypeAnnotation(state, docComment.returns[0]!.type!);
    declaredReturnType = docReturnType;
  }

  const savedReturnType = state.returnType;
  const savedVariadic = state.isVariadic;
  state.returnType = declaredReturnType;
  state.isVariadic = func.isVariadic;

  checkBlock(state, func.body);

  state.returnType = savedReturnType;
  state.isVariadic = savedVariadic;
  exitScope(state.env);

  const funcOptions: { typeParams?: ReadonlyArray<TypeParameterDef>; isVariadic?: boolean } = {
    'isVariadic': func.isVariadic,
  };
  if (typeParams.length > 0) funcOptions.typeParams = typeParams;

  return createFunctionType(params, declaredReturnType ?? AnyType, funcOptions);
};

const checkAssignment = (state: CheckerState, stmt: Assignment): void => {
  const valueTypes: LuauType[] = stmt.values.map(v => inferExpression(state, v));

  for (let i = 0; i < stmt.targets.length; i++) {
    const target = stmt.targets[i]!;
    const valueType = valueTypes[i] ?? NilType;

    const targetType = inferExpression(state, target);

    if (
      targetType.kind !== 'Any' &&
      state.env.mode !== 'nonstrict' &&
      isAssignable(valueType, targetType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false
    ) {
      addDiagnostic(
        state,
        `Type '${typeToString(valueType)}' is not assignable to type '${typeToString(targetType)}'`,
        target.range,
        'error',
        'E002',
      );
    }
  }
};

const checkCompoundAssignment = (state: CheckerState, stmt: CompoundAssignment): void => {
  const targetType = inferExpression(state, stmt.target);
  const valueType = inferExpression(state, stmt.value);

  // In nonstrict mode, skip operator type checks entirely
  if (state.env.mode === 'nonstrict') return;

  // Check operand compatibility based on operator
  const numericOps = ['+=', '-=', '*=', '/=', '//=', '%=', '^='];
  const stringOps = ['..='];

  if (numericOps.includes(stmt.operator)) {
    if (isSubtype(targetType, NumberType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false) {
      addDiagnostic(state, `Operator '${stmt.operator}' requires numeric operand`, stmt.target.range, 'error', 'E003');
    }
    if (isSubtype(valueType, NumberType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false) {
      addDiagnostic(state, `Operator '${stmt.operator}' requires numeric operand`, stmt.value.range, 'error', 'E003');
    }
  } else if (stringOps.includes(stmt.operator)) {
    const stringOrNumber = createUnionType([StringType, NumberType]);
    if (isSubtype(targetType, stringOrNumber, { 'mode': state.env.mode, 'variance': 'covariant' }) === false) {
      addDiagnostic(
        state,
        `Operator '${stmt.operator}' requires string or number operand`,
        stmt.target.range,
        'error',
        'E003',
      );
    }
  }
};

const checkIfStatement = (state: CheckerState, stmt: IfStatement): void => {
  inferExpression(state, stmt.condition);

  // Extract type narrowings from the condition
  const narrowing = extractIsANarrowing(state, stmt.condition);
  const narrowings: TypeNarrowing[] = narrowing !== undefined ? [narrowing] : [];

  enterScope(state.env, 'Conditional');
  applyNarrowings(state, narrowings);
  checkBlock(state, stmt.thenBody);
  clearNarrowings(state, narrowings);
  exitScope(state.env);

  for (const clause of stmt.elseifClauses) {
    inferExpression(state, clause.condition);

    // Extract narrowings for elseif clauses
    const clauseNarrowing = extractIsANarrowing(state, clause.condition);
    const clauseNarrowings: TypeNarrowing[] = clauseNarrowing !== undefined ? [clauseNarrowing] : [];

    enterScope(state.env, 'Conditional');
    applyNarrowings(state, clauseNarrowings);
    checkBlock(state, clause.body);
    clearNarrowings(state, clauseNarrowings);
    exitScope(state.env);
  }

  if (stmt.elseBody !== undefined) {
    enterScope(state.env, 'Conditional');
    checkBlock(state, stmt.elseBody);
    exitScope(state.env);
  }
};

const checkWhileStatement = (state: CheckerState, stmt: WhileStatement): void => {
  inferExpression(state, stmt.condition);
  enterScope(state.env, 'Loop');
  checkBlock(state, stmt.body);
  exitScope(state.env);
};

const checkRepeatStatement = (state: CheckerState, stmt: RepeatStatement): void => {
  enterScope(state.env, 'Loop');
  checkBlock(state, stmt.body);
  inferExpression(state, stmt.condition);
  exitScope(state.env);
};

const checkForNumeric = (state: CheckerState, stmt: ForNumeric): void => {
  const startType = inferExpression(state, stmt.start);
  const endType = inferExpression(state, stmt.end);
  const stepType = stmt.step !== undefined ? inferExpression(state, stmt.step) : NumberType;

  // In nonstrict mode, skip for loop type checks entirely
  if (state.env.mode !== 'nonstrict') {
    if (isSubtype(startType, NumberType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false) {
      addDiagnostic(state, 'For loop start must be a number', stmt.start.range, 'error', 'E004');
    }
    if (isSubtype(endType, NumberType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false) {
      addDiagnostic(state, 'For loop end must be a number', stmt.end.range, 'error', 'E004');
    }
    if (
      isSubtype(stepType, NumberType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false &&
      stmt.step !== undefined
    ) {
      addDiagnostic(state, 'For loop step must be a number', stmt.step.range, 'error', 'E004');
    }
  }

  enterScope(state.env, 'Loop');
  defineSymbol(state.env, stmt.variable.name, NumberType, 'Variable', false);
  trackSymbol(state, stmt.variable.name, NumberType);
  checkBlock(state, stmt.body);
  exitScope(state.env);
};

const checkForGeneric = (state: CheckerState, stmt: ForGeneric): void => {
  // Infer iterator types
  for (const iter of stmt.iterators) {
    inferExpression(state, iter);
  }

  enterScope(state.env, 'Loop');

  // Define loop variables (types inferred from iterators)
  for (const variable of stmt.variables) {
    defineSymbol(state.env, variable.name, AnyType, 'Variable', false);
    trackSymbol(state, variable.name, AnyType);
  }

  checkBlock(state, stmt.body);
  exitScope(state.env);
};

const checkReturnStatement = (state: CheckerState, stmt: ReturnStatement): void => {
  const returnTypes = stmt.values.map(v => inferExpression(state, v));

  if (state.returnType !== undefined && state.env.mode !== 'nonstrict') {
    const actualReturnType =
      returnTypes.length === 0 ? NilType : returnTypes.length === 1 ? returnTypes[0]! : createUnionType(returnTypes);

    if (
      isAssignable(actualReturnType, state.returnType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false
    ) {
      addDiagnostic(
        state,
        `Return type '${typeToString(actualReturnType)}' is not assignable to expected type '${typeToString(state.returnType)}'`,
        stmt.range,
        'error',
        'E005',
      );
    }
  }
};

const checkTypeAlias = (state: CheckerState, stmt: TypeAlias): void => {
  // Register the type name first with a self-referential TypeReference
  // This allows self-references within the type body to resolve
  defineTypeAlias(state.env, stmt.name.name, { 'kind': 'TypeReference', 'name': stmt.name.name });

  // Now resolve the type body (self-references will find the placeholder)
  const resolvedType = resolveTypeAnnotation(state, stmt.type);

  // Update with the fully resolved type
  defineTypeAlias(state.env, stmt.name.name, resolvedType);
};

const inferExpression = (state: CheckerState, expr: Expression): LuauType => {
  switch (expr.kind) {
    case 'Identifier':
      return inferIdentifier(state, expr);

    case 'NilLiteral':
      return NilType;

    case 'BooleanLiteral':
      return state.env.mode === 'strict' ? createBooleanLiteral(expr.value) : BooleanType;

    case 'NumberLiteral':
      return state.env.mode === 'strict' ? createNumberLiteral(expr.value) : NumberType;

    case 'StringLiteral':
      return state.env.mode === 'strict' ? createStringLiteral(expr.value) : StringType;

    case 'VarargExpression':
      return AnyType;

    case 'FunctionExpression':
      return checkFunctionExpression(state, expr);

    case 'TableExpression':
      return inferTableExpression(state, expr);

    case 'BinaryExpression':
      return inferBinaryExpression(state, expr);

    case 'UnaryExpression':
      return inferUnaryExpression(state, expr);

    case 'CallExpression':
      return inferCallExpression(state, expr);

    case 'MethodCallExpression':
      return inferMethodCallExpression(state, expr);

    case 'IndexExpression':
      return inferIndexExpression(state, expr);

    case 'MemberExpression':
      return inferMemberExpression(state, expr);

    case 'IfExpression':
      return inferIfExpression(state, expr);

    case 'TypeCastExpression':
      return resolveTypeAnnotation(state, expr.type);

    case 'InterpolatedString':
      return StringType;

    case 'ParenthesizedExpression':
      return inferExpression(state, expr.expression);

    case 'ErrorExpression':
      return AnyType;

    default:
      return AnyType;
  }
};

const inferIdentifier = (state: CheckerState, id: Identifier): LuauType => {
  // Check for narrowed type first (from IsA checks, etc.)
  const narrowedType = state.narrowings.get(id.name);
  if (narrowedType !== undefined) return narrowedType;

  const symbol = lookupSymbol(state.env, id.name);

  if (symbol === undefined) {
    if (state.env.mode === 'strict') {
      addDiagnostic(state, `Unknown identifier '${id.name}'`, id.range, 'error', 'E006');
    }
    return AnyType;
  }

  return symbol.type;
};

const inferTableExpression = (state: CheckerState, table: TableExpression): TableType => {
  const properties = new Map<string, PropertyType>();
  let isArray = true;
  let arrayIndex = 1;
  const elementTypes: LuauType[] = [];

  for (const field of table.fields) {
    switch (field.kind) {
      case 'TableFieldKey':
        isArray = false;
        properties.set(field.key.name, {
          'type': inferExpression(state, field.value),
          'readonly': false,
          'optional': false,
        });
        break;

      case 'TableFieldIndex': {
        isArray = false;
        const indexType = inferExpression(state, field.index);
        const valueType = inferExpression(state, field.value);
        if (field.index.kind === 'StringLiteral') {
          properties.set(field.index.value, {
            'type': valueType,
            'readonly': false,
            'optional': false,
          });
        } else if (indexType.kind === 'Literal' && indexType.baseType === 'string') {
          properties.set(String(indexType.value), {
            'type': valueType,
            'readonly': false,
            'optional': false,
          });
        }
        break;
      }

      case 'TableFieldValue': {
        const valueType = inferExpression(state, field.value);
        if (isArray) {
          elementTypes.push(valueType);
        }
        properties.set(String(arrayIndex++), { 'type': valueType, 'readonly': false, 'optional': false });
        break;
      }
    }
  }

  if (isArray && elementTypes.length > 0) {
    const elementType = elementTypes.reduce((a, b) =>
      commonType(a, b, { 'mode': state.env.mode, 'variance': 'covariant' }),
    );
    return createArrayType(elementType);
  }

  return createTableType(properties);
};

const inferBinaryExpression = (state: CheckerState, expr: BinaryExpression): LuauType => {
  const leftType = inferExpression(state, expr.left);
  const rightType = inferExpression(state, expr.right);

  const arithmeticOps = ['+', '-', '*', '/', '//', '%', '^'];
  const comparisonOps = ['<', '<=', '>', '>='];

  // Check arithmetic operators require numeric operands
  if (arithmeticOps.includes(expr.operator)) {
    const leftResolved = resolveType(leftType, state.env.classes);
    const rightResolved = resolveType(rightType, state.env.classes);

    // Math-compatible types that support arithmetic
    const mathTypeNames = ['Vector3', 'Vector2', 'CFrame', 'UDim', 'UDim2', 'Color3'];

    const isNumericCompatible = (t: LuauType): boolean => {
      if (t.kind === 'Any' || t.kind === 'Error') return true;
      if (t.kind === 'Primitive' && t.name === 'number') return true;
      if (t.kind === 'Literal' && t.baseType === 'number') return true;
      if (t.kind === 'TypeReference' && mathTypeNames.includes(t.name)) return true;
      // Union types: if any member is numeric, it's compatible (may be nil-guarded)
      if (t.kind === 'Union') {
        return t.types.some(member => isNumericCompatible(member));
      }
      if (t.kind === 'Table') {
        // Check if it's a Vector3/CFrame table type (has X, Y)
        if (t.properties.has('X') && t.properties.has('Y')) return true;
        // Check for UDim2 (has Width/Height which are UDim)
        if (t.properties.has('Width') && t.properties.has('Height')) return true;
        // Check for UDim (has Scale/Offset)
        if (t.properties.has('Scale') && t.properties.has('Offset')) return true;
      }
      return false;
    };

    // Check if type is definitively numeric (not union with nil)
    const isDefinitelyNumeric = (t: LuauType): boolean => {
      if (t.kind === 'Any' || t.kind === 'Error') return true;
      if (t.kind === 'Primitive' && t.name === 'number') return true;
      if (t.kind === 'Literal' && t.baseType === 'number') return true;
      if (t.kind === 'TypeReference' && mathTypeNames.includes(t.name)) return true;
      if (t.kind === 'Table') {
        if (t.properties.has('X') && t.properties.has('Y')) return true;
        if (t.properties.has('Width') && t.properties.has('Height')) return true;
        if (t.properties.has('Scale') && t.properties.has('Offset')) return true;
      }
      return false;
    };

    const checkOperand = (resolved: LuauType, original: LuauType, range: typeof expr.left.range): void => {
      if (isNumericCompatible(resolved) === false) {
        // Definitely not numeric - always error
        addDiagnostic(
          state,
          `Operator '${expr.operator}' cannot be applied to type '${typeToString(original)}'`,
          range,
          'error',
          'E011',
        );
      } else if (isDefinitelyNumeric(resolved) === false && state.env.mode === 'nonstrict') {
        // Possibly numeric (union with nil) - warning in nonstrict mode
        // Don't report anything in nonstrict mode for number | nil cases
      } else if (isDefinitelyNumeric(resolved) === false) {
        // Possibly numeric but in strict mode - error
        addDiagnostic(
          state,
          `Operator '${expr.operator}' cannot be applied to type '${typeToString(original)}'`,
          range,
          'error',
          'E011',
        );
      }
    };

    checkOperand(leftResolved, leftType, expr.left.range);
    checkOperand(rightResolved, rightType, expr.right.range);

    // Determine return type based on operand types
    // If either operand is a math type (Vector3, Vector2, CFrame, UDim, UDim2, Color3), return that type
    const getMathType = (t: LuauType): LuauType | undefined => {
      if (t.kind === 'TypeReference' && mathTypeNames.includes(t.name)) return t;
      if (t.kind === 'Class' && mathTypeNames.includes(t.name)) return t;
      if (t.kind === 'Table') {
        // Check for Vector3/Vector2/CFrame (has X, Y properties)
        if (t.properties.has('X') && t.properties.has('Y')) return t;
        // Check for UDim2 (has Width/Height which are UDim)
        if (t.properties.has('Width') && t.properties.has('Height')) return t;
        // Check for UDim (has Scale/Offset)
        if (t.properties.has('Scale') && t.properties.has('Offset')) return t;
      }
      return undefined;
    };

    const leftMathType = getMathType(leftResolved);
    if (leftMathType !== undefined) return leftMathType;

    const rightMathType = getMathType(rightResolved);
    if (rightMathType !== undefined) return rightMathType;

    return NumberType;
  }

  // Check comparison operators
  if (comparisonOps.includes(expr.operator)) {
    return BooleanType;
  }

  switch (expr.operator) {
    case '..':
      return StringType;

    case '==':
    case '~=':
      return BooleanType;

    case 'and':
      return createUnionType([rightType, { 'kind': 'Literal', 'value': false, 'baseType': 'boolean' }, NilType]);

    case 'or':
      return createUnionType([leftType, rightType]);

    default:
      return AnyType;
  }
};

const inferUnaryExpression = (state: CheckerState, expr: UnaryExpression): LuauType => {
  // Infer operand for side effects (diagnostics)
  inferExpression(state, expr.operand);

  switch (expr.operator) {
    case '-':
      return NumberType;

    case 'not':
      return BooleanType;

    case '#':
      return NumberType;

    default:
      return AnyType;
  }
};

/**
 * Checks if an expression is Instance.new and returns the class type if a string literal is provided
 */
const inferInstanceNewCall = (state: CheckerState, expr: CallExpression): LuauType | undefined => {
  // Check for Instance.new("ClassName") pattern
  if (expr.callee.kind !== 'MemberExpression') return undefined;
  if (expr.callee.object.kind !== 'Identifier') return undefined;
  if (expr.callee.object.name !== 'Instance') return undefined;
  if (expr.callee.property.name !== 'new') return undefined;
  if (expr.args.length === 0) return undefined;

  const firstArg = expr.args[0]!;
  if (firstArg.kind !== 'StringLiteral') return undefined;

  const className = firstArg.value;
  const classType = state.env.classes.get(className);
  if (classType !== undefined) return classType;

  // Return Instance type as fallback for unknown class names
  const instanceClass = state.env.classes.get('Instance');
  return instanceClass;
};

const inferCallExpression = (state: CheckerState, expr: CallExpression): LuauType => {
  const calleeType = resolveType(inferExpression(state, expr.callee), state.env.classes);

  // Check arguments
  for (const arg of expr.args) {
    inferExpression(state, arg);
  }

  // Special case: Instance.new("ClassName") returns that class type
  const instanceNewType = inferInstanceNewCall(state, expr);
  if (instanceNewType !== undefined) return instanceNewType;

  if (calleeType.kind === 'Function') {
    return resolveType(calleeType.returnType, state.env.classes);
  }

  if (calleeType.kind === 'Any') {
    return AnyType;
  }

  // Avoid cascading errors when the callee is already an error type
  if (calleeType.kind === 'Error') {
    return calleeType;
  }

  if (state.env.mode === 'strict') {
    addDiagnostic(state, `Type '${typeToString(calleeType)}' is not callable`, expr.callee.range, 'error', 'E007');
  }

  return createErrorType('not callable');
};

/**
 * Extracts a string literal value from an expression if possible
 */
const extractStringLiteral = (expr: Expression): string | undefined => {
  if (expr.kind === 'StringLiteral') return expr.value;
  return undefined;
};

/**
 * Handles special Roblox method patterns that return specific types based on arguments
 */
const inferSpecialMethodReturnType = (
  state: CheckerState,
  objectType: LuauType,
  methodName: string,
  args: ReadonlyArray<Expression>,
): LuauType | undefined => {
  // GetService("ServiceName") returns the service class
  if (methodName === 'GetService' && args.length >= 1) {
    const serviceName = extractStringLiteral(args[0]!);
    if (serviceName !== undefined) {
      const serviceClass = state.env.classes.get(serviceName);
      if (serviceClass !== undefined) return serviceClass;
    }
  }

  // Clone() returns the same type as the object being cloned
  if (methodName === 'Clone' && args.length === 0) {
    if (objectType.kind === 'Class') return objectType;
  }

  // FindFirstChildOfClass("ClassName") returns that class type or nil
  if (methodName === 'FindFirstChildOfClass' && args.length >= 1) {
    const className = extractStringLiteral(args[0]!);
    if (className !== undefined) {
      const classType = state.env.classes.get(className);
      if (classType !== undefined) return createUnionType([classType, NilType]);
    }
  }

  // FindFirstChildWhichIsA("ClassName") returns that class type or nil
  if (methodName === 'FindFirstChildWhichIsA' && args.length >= 1) {
    const className = extractStringLiteral(args[0]!);
    if (className !== undefined) {
      const classType = state.env.classes.get(className);
      if (classType !== undefined) return createUnionType([classType, NilType]);
    }
  }

  // FindFirstAncestorOfClass("ClassName") returns that class type or nil
  if (methodName === 'FindFirstAncestorOfClass' && args.length >= 1) {
    const className = extractStringLiteral(args[0]!);
    if (className !== undefined) {
      const classType = state.env.classes.get(className);
      if (classType !== undefined) return createUnionType([classType, NilType]);
    }
  }

  // FindFirstAncestorWhichIsA("ClassName") returns that class type or nil
  if (methodName === 'FindFirstAncestorWhichIsA' && args.length >= 1) {
    const className = extractStringLiteral(args[0]!);
    if (className !== undefined) {
      const classType = state.env.classes.get(className);
      if (classType !== undefined) return createUnionType([classType, NilType]);
    }
  }

  // WaitForChild("Name", timeout?) with string literal can still give hints
  // For now, return Instance type but this could be enhanced with common children
  if (methodName === 'WaitForChild' && args.length >= 1) {
    const childName = extractStringLiteral(args[0]!);
    if (childName !== undefined && objectType.kind === 'Class') {
      // Could check common children map here for better inference
      const instanceClass = state.env.classes.get('Instance');
      if (instanceClass !== undefined) return instanceClass;
    }
  }

  return undefined;
};

/**
 * Extracts callback parameter types from an RBXScriptSignal for Wait() method
 */
const inferSignalWaitReturnType = (signalType: LuauType): LuauType => {
  if (signalType.kind !== 'Table') return AnyType;

  // Look for Connect method to understand the callback signature
  const connectProp = signalType.properties.get('Connect');
  if (connectProp === undefined || connectProp.type.kind !== 'Function') return AnyType;

  // Connect takes a callback function as its first parameter
  const connectParams = connectProp.type.params;
  if (connectParams.length === 0) return AnyType;

  const callbackParam = connectParams[0];
  if (callbackParam === undefined || callbackParam.type.kind !== 'Function') return AnyType;

  // The callback parameters are what Wait() returns
  const callbackParamTypes = callbackParam.type.params.map(p => p.type);

  if (callbackParamTypes.length === 0) return NilType;
  if (callbackParamTypes.length === 1) return callbackParamTypes[0]!;

  // For multiple return values, we return the first type (most common case for Wait is single return)
  return callbackParamTypes[0]!;
};

const inferMethodCallExpression = (state: CheckerState, expr: MethodCallExpression): LuauType => {
  const objectType = resolveType(inferExpression(state, expr.object), state.env.classes);

  // Check arguments
  for (const arg of expr.args) {
    inferExpression(state, arg);
  }

  // Check for special Roblox method patterns first
  const specialReturnType = inferSpecialMethodReturnType(state, objectType, expr.method.name, expr.args);
  if (specialReturnType !== undefined) return specialReturnType;

  // Handle Union types (like Tool | nil) - check if method exists on any non-nil member
  if (objectType.kind === 'Union') {
    const nonNilTypes = objectType.types.filter(t => t.kind !== 'Primitive' || t.name !== 'nil');
    for (const memberType of nonNilTypes) {
      const resolved = resolveType(memberType, state.env.classes);
      if (resolved.kind === 'Class') {
        const method = lookupClassMethod(resolved, expr.method.name);
        if (method !== undefined) {
          if (method.deprecated === true) {
            const message =
              method.deprecationMessage !== undefined
                ? `'${expr.method.name}' is deprecated. ${method.deprecationMessage}`
                : `'${expr.method.name}' is deprecated.`;
            addDiagnostic(state, message, expr.method.range, 'warning', 'W001', ['deprecated']);
          }
          // Return type might include nil since the object could be nil
          return resolveType(method.func.returnType, state.env.classes);
        }
        const prop = lookupClassProperty(resolved, expr.method.name);
        if (prop !== undefined && prop.type.kind === 'Function') {
          return resolveType(prop.type.returnType, state.env.classes);
        }
      }
      if (resolved.kind === 'Table') {
        const prop = resolved.properties.get(expr.method.name);
        if (prop !== undefined && prop.type.kind === 'Function') {
          return resolveType(prop.type.returnType, state.env.classes);
        }
      }
    }
  }

  if (objectType.kind === 'Class') {
    // Look up method including inherited methods from superclasses
    const method = lookupClassMethod(objectType, expr.method.name);
    if (method !== undefined) {
      if (method.deprecated === true) {
        const message =
          method.deprecationMessage !== undefined
            ? `'${expr.method.name}' is deprecated. ${method.deprecationMessage}`
            : `'${expr.method.name}' is deprecated.`;
        addDiagnostic(state, message, expr.method.range, 'warning', 'W001', ['deprecated']);
      }
      return resolveType(method.func.returnType, state.env.classes);
    }

    // Check properties too (could be a function-typed property)
    const prop = lookupClassProperty(objectType, expr.method.name);
    if (prop !== undefined && prop.type.kind === 'Function') {
      if (prop.deprecated === true) {
        const message =
          prop.deprecationMessage !== undefined
            ? `'${expr.method.name}' is deprecated. ${prop.deprecationMessage}`
            : `'${expr.method.name}' is deprecated.`;
        addDiagnostic(state, message, expr.method.range, 'warning', 'W001', ['deprecated']);
      }
      return resolveType(prop.type.returnType, state.env.classes);
    }
  }

  if (objectType.kind === 'Table') {
    const prop = objectType.properties.get(expr.method.name);
    if (prop !== undefined && prop.type.kind === 'Function') {
      // Special case: Wait() on RBXScriptSignal should return callback params
      if (expr.method.name === 'Wait') {
        return inferSignalWaitReturnType(objectType);
      }
      return resolveType(prop.type.returnType, state.env.classes);
    }
  }

  if (objectType.kind === 'Any') return AnyType;

  // Avoid cascading errors when the object type is already an error type
  if (objectType.kind === 'Error') {
    return objectType;
  }

  // String method calls - look up in string library (e.g., s:lower() -> string.lower(s))
  if (objectType.kind === 'Primitive' && objectType.name === 'string') {
    const stringLib = lookupSymbol(state.env, 'string');
    if (stringLib !== undefined && stringLib.type.kind === 'Table') {
      const method = stringLib.type.properties.get(expr.method.name);
      if (method !== undefined && method.type.kind === 'Function') {
        return resolveType(method.type.returnType, state.env.classes);
      }
    }
  }

  // String literal method calls
  if (objectType.kind === 'Literal' && objectType.baseType === 'string') {
    const stringLib = lookupSymbol(state.env, 'string');
    if (stringLib !== undefined && stringLib.type.kind === 'Table') {
      const method = stringLib.type.properties.get(expr.method.name);
      if (method !== undefined && method.type.kind === 'Function') {
        return resolveType(method.type.returnType, state.env.classes);
      }
    }
  }

  // Check for common case-sensitivity issues and suggest corrections
  const methodCorrections: Record<string, string> = {
    'connect': 'Connect',
    'disconnect': 'Disconnect',
    'wait': 'Wait',
    'once': 'Once',
    'destroy': 'Destroy',
    'clone': 'Clone',
    'getchildren': 'GetChildren',
    'getdescendants': 'GetDescendants',
    'findfirstchild': 'FindFirstChild',
    'findfirstchildofclass': 'FindFirstChildOfClass',
    'findfirstchildwhichisa': 'FindFirstChildWhichIsA',
    'findfirstancestor': 'FindFirstAncestor',
    'findfirstancestorofclass': 'FindFirstAncestorOfClass',
    'findfirstancestorwhichisa': 'FindFirstAncestorWhichIsA',
    'waitforchild': 'WaitForChild',
    'isa': 'IsA',
    'isancestorof': 'IsAncestorOf',
    'isdescendantof': 'IsDescendantOf',
    'getattribute': 'GetAttribute',
    'setattribute': 'SetAttribute',
    'getattributes': 'GetAttributes',
    'getpropertychangedsignal': 'GetPropertyChangedSignal',
    'getattributechangedsignal': 'GetAttributeChangedSignal',
    'setprimarypartcframe': 'SetPrimaryPartCFrame',
    'getprimarypartcframe': 'GetPrimaryPartCFrame',
    'moveto': 'MoveTo',
    'tweenposition': 'TweenPosition',
    'tweensize': 'TweenSize',
    'tweensizeandposition': 'TweenSizeAndPosition',
    'play': 'Play',
    'stop': 'Stop',
    'pause': 'Pause',
    'resume': 'Resume',
    'fire': 'Fire',
    'invoke': 'Invoke',
    'fireserver': 'FireServer',
    'fireclient': 'FireClient',
    'fireallclients': 'FireAllClients',
    'invokeserver': 'InvokeServer',
    'invokeclient': 'InvokeClient',
  };

  const lowercaseName = expr.method.name.toLowerCase();
  const correction = methodCorrections[lowercaseName];
  if (correction !== undefined && expr.method.name !== correction) {
    addDiagnostic(
      state,
      `'${expr.method.name}' should be '${correction}'. Luau is case-sensitive.`,
      expr.method.range,
      'warning',
      'W002',
    );
    // Try to find the correct method and return its type
    if (objectType.kind === 'Class') {
      const correctMethod = lookupClassMethod(objectType, correction);
      if (correctMethod !== undefined) {
        return resolveType(correctMethod.func.returnType, state.env.classes);
      }
    }
    if (objectType.kind === 'Table') {
      const correctProp = objectType.properties.get(correction);
      if (correctProp !== undefined && correctProp.type.kind === 'Function') {
        return resolveType(correctProp.type.returnType, state.env.classes);
      }
    }
    return AnyType; // Return any to avoid cascading errors
  }

  if (state.env.mode === 'strict') {
    addDiagnostic(
      state,
      `Method '${expr.method.name}' does not exist on type '${typeToString(objectType)}'`,
      expr.method.range,
      'error',
      'E008',
    );
  }

  return createErrorType(`method '${expr.method.name}' not found`);
};

const inferIndexExpression = (state: CheckerState, expr: IndexExpression): LuauType => {
  const objectType = resolveType(inferExpression(state, expr.object), state.env.classes);
  // Infer index for side effects (diagnostics)
  inferExpression(state, expr.index);

  if (objectType.kind === 'Table' && objectType.indexer !== undefined) {
    return resolveType(objectType.indexer.valueType, state.env.classes);
  }

  if (objectType.kind === 'Any') return AnyType;

  // Avoid cascading errors when the object type is already an error type
  if (objectType.kind === 'Error') {
    return objectType;
  }

  return AnyType;
};

const inferMemberExpression = (state: CheckerState, expr: MemberExpression): LuauType => {
  const objectType = resolveType(inferExpression(state, expr.object), state.env.classes);

  if (objectType.kind === 'Table') {
    const prop = objectType.properties.get(expr.property.name);
    if (prop !== undefined) return resolveType(prop.type, state.env.classes);

    // Check for indexer access
    if (objectType.indexer !== undefined) {
      return resolveType(objectType.indexer.valueType, state.env.classes);
    }
  }

  if (objectType.kind === 'Class') {
    // Look up property including inherited properties from superclasses
    const prop = lookupClassProperty(objectType, expr.property.name);
    if (prop !== undefined) {
      if (prop.deprecated === true) {
        const message =
          prop.deprecationMessage !== undefined
            ? `'${expr.property.name}' is deprecated. ${prop.deprecationMessage}`
            : `'${expr.property.name}' is deprecated.`;
        addDiagnostic(state, message, expr.property.range, 'warning', 'W001', ['deprecated']);
      }
      return resolveType(prop.type, state.env.classes);
    }

    // Look up method including inherited methods from superclasses
    const method = lookupClassMethod(objectType, expr.property.name);
    if (method !== undefined) {
      if (method.deprecated === true) {
        const message =
          method.deprecationMessage !== undefined
            ? `'${expr.property.name}' is deprecated. ${method.deprecationMessage}`
            : `'${expr.property.name}' is deprecated.`;
        addDiagnostic(state, message, expr.property.range, 'warning', 'W001', ['deprecated']);
      }
      return method.func;
    }

    // Check COMMON_CHILDREN for implicit child access (like character.Humanoid)
    const getSuperclass = (className: string): string | undefined => {
      const classType = state.env.classes.get(className);
      return classType?.superclass?.name;
    };
    const commonChildType = getCommonChildType(objectType.name, expr.property.name, getSuperclass);
    if (commonChildType !== undefined) {
      const childClass = state.env.classes.get(commonChildType);
      if (childClass !== undefined) return childClass;
      // Return as TypeReference if class not found
      return { 'kind': 'TypeReference', 'name': commonChildType };
    }
  }

  if (objectType.kind === 'Any') return AnyType;

  // Avoid cascading errors when the object type is already an error type
  if (objectType.kind === 'Error') {
    return objectType;
  }

  // Check for common deprecated/incorrect property names and suggest corrections
  const propertyCorrections: Record<string, { correct: string; message: string }> = {
    'children': { 'correct': 'GetChildren', 'message': "Use 'GetChildren()' method instead of 'children' property." },
    'parent': { 'correct': 'Parent', 'message': "Use 'Parent' (capitalized) instead of 'parent'." },
    'name': { 'correct': 'Name', 'message': "Use 'Name' (capitalized) instead of 'name'." },
    'classname': { 'correct': 'ClassName', 'message': "Use 'ClassName' (capitalized) instead of 'classname'." },
    'position': { 'correct': 'Position', 'message': "Use 'Position' (capitalized) instead of 'position'." },
    'cframe': { 'correct': 'CFrame', 'message': "Use 'CFrame' (capitalized) instead of 'cframe'." },
    'size': { 'correct': 'Size', 'message': "Use 'Size' (capitalized) instead of 'size'." },
    'color': { 'correct': 'Color', 'message': "Use 'Color' (capitalized) instead of 'color'." },
    'transparency': {
      'correct': 'Transparency',
      'message': "Use 'Transparency' (capitalized) instead of 'transparency'.",
    },
    'visible': { 'correct': 'Visible', 'message': "Use 'Visible' (capitalized) instead of 'visible'." },
    'enabled': { 'correct': 'Enabled', 'message': "Use 'Enabled' (capitalized) instead of 'enabled'." },
    'anchored': { 'correct': 'Anchored', 'message': "Use 'Anchored' (capitalized) instead of 'anchored'." },
    'cancollide': { 'correct': 'CanCollide', 'message': "Use 'CanCollide' (capitalized) instead of 'cancollide'." },
    'value': { 'correct': 'Value', 'message': "Use 'Value' (capitalized) instead of 'value'." },
    'text': { 'correct': 'Text', 'message': "Use 'Text' (capitalized) instead of 'text'." },
  };

  const lowercaseName = expr.property.name.toLowerCase();
  const correction = propertyCorrections[lowercaseName];
  if (correction !== undefined && expr.property.name !== correction.correct) {
    // Check if the correct property exists
    if (objectType.kind === 'Class') {
      const correctProp = lookupClassProperty(objectType, correction.correct);
      const correctMethod = lookupClassMethod(objectType, correction.correct);
      if (correctProp !== undefined || correctMethod !== undefined) {
        addDiagnostic(state, correction.message, expr.property.range, 'warning', 'W002');
        if (correctProp !== undefined) return resolveType(correctProp.type, state.env.classes);
        if (correctMethod !== undefined) return correctMethod.func;
      }
    }
  }

  if (state.env.mode === 'strict') {
    addDiagnostic(
      state,
      `Property '${expr.property.name}' does not exist on type '${typeToString(objectType)}'`,
      expr.property.range,
      'error',
      'E009',
    );
  }

  return createErrorType(`property '${expr.property.name}' not found`);
};

const inferIfExpression = (
  state: CheckerState,
  expr: {
    condition: Expression;
    thenExpr: Expression;
    elseifExprs: ReadonlyArray<{ condition: Expression; thenExpr: Expression }>;
    elseExpr: Expression;
    range: NodeRange;
  },
): LuauType => {
  inferExpression(state, expr.condition);
  const thenType = inferExpression(state, expr.thenExpr);

  let resultType = thenType;

  for (const clause of expr.elseifExprs) {
    inferExpression(state, clause.condition);
    const clauseType = inferExpression(state, clause.thenExpr);
    resultType = commonType(resultType, clauseType, { 'mode': state.env.mode, 'variance': 'covariant' });
  }

  const elseType = inferExpression(state, expr.elseExpr);
  return commonType(resultType, elseType, { 'mode': state.env.mode, 'variance': 'covariant' });
};

const resolveTypeAnnotation = (state: CheckerState, annotation: TypeAnnotation): LuauType => {
  switch (annotation.kind) {
    case 'TypeReference':
      return resolveTypeReference(state, annotation);

    case 'TypeLiteral':
      if (typeof annotation.value === 'string') return createStringLiteral(annotation.value);
      if (typeof annotation.value === 'boolean') return createBooleanLiteral(annotation.value);
      return AnyType;

    case 'FunctionType': {
      const params: FunctionParam[] = annotation.params.map(p => ({
        'name': p.name,
        'type': resolveTypeAnnotation(state, p.type),
        'optional': false,
      }));
      const returnType = resolveTypeAnnotation(state, annotation.returnType);
      const funcOptions: { thisType?: LuauType; isVariadic?: boolean } = {
        'isVariadic': annotation.isVariadic,
      };
      if (annotation.thisType !== undefined) funcOptions.thisType = resolveTypeAnnotation(state, annotation.thisType);
      return createFunctionType(params, returnType, funcOptions);
    }

    case 'TableType': {
      const properties = new Map<string, PropertyType>();
      for (const prop of annotation.properties) {
        properties.set(prop.name, {
          'type': resolveTypeAnnotation(state, prop.type),
          'readonly': prop.isReadonly,
          'optional': false,
        });
      }
      const tableOptions: { indexer?: { keyType: LuauType; valueType: LuauType } } = {};
      if (annotation.indexer !== undefined) {
        tableOptions.indexer = {
          'keyType': resolveTypeAnnotation(state, annotation.indexer.keyType),
          'valueType': resolveTypeAnnotation(state, annotation.indexer.valueType),
        };
      }
      return createTableType(properties, tableOptions);
    }

    case 'UnionType':
      return createUnionType(annotation.types.map(t => resolveTypeAnnotation(state, t)));

    case 'IntersectionType':
      return { 'kind': 'Intersection', 'types': annotation.types.map(t => resolveTypeAnnotation(state, t)) };

    case 'OptionalType':
      return createUnionType([resolveTypeAnnotation(state, annotation.type), NilType]);

    case 'TypeofType':
      return inferExpression(state, annotation.expression);

    case 'VariadicType':
      return { 'kind': 'Variadic', 'type': resolveTypeAnnotation(state, annotation.type) };

    case 'ParenthesizedType':
      return resolveTypeAnnotation(state, annotation.type);

    case 'ErrorType':
      return { 'kind': 'Error', 'message': annotation.message };

    default:
      return AnyType;
  }
};

const resolveTypeReference = (
  state: CheckerState,
  ref: {
    name: string;
    module: string | undefined;
    typeArgs: ReadonlyArray<TypeAnnotation> | undefined;
    range: NodeRange;
  },
): LuauType => {
  // Check for built-in types
  switch (ref.name) {
    case 'nil':
      return NilType;
    case 'boolean':
      return BooleanType;
    case 'number':
      return NumberType;
    case 'string':
      return StringType;
    case 'thread':
      return { 'kind': 'Primitive', 'name': 'thread' };
    case 'buffer':
      return { 'kind': 'Primitive', 'name': 'buffer' };
    case 'vector':
      return { 'kind': 'Primitive', 'name': 'vector' };
    case 'any':
      return AnyType;
    case 'unknown':
      return { 'kind': 'Unknown' };
    case 'never':
      return NeverType;
  }

  // Check for type alias
  const alias = lookupTypeAlias(state.env, ref.name);
  if (alias !== undefined) return alias;

  // Check for class type
  const classType = state.env.classes.get(ref.name);
  if (classType !== undefined) return classType;

  // Check for enum type
  const enumType = state.env.enums.get(ref.name);
  if (enumType !== undefined) return enumType;

  if (state.env.mode === 'strict') {
    addDiagnostic(state, `Unknown type '${ref.name}'`, ref.range, 'error', 'E010');
  }

  return AnyType;
};
