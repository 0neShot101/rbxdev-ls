import { getCommonChildType } from '@definitions/commonChildren';
import { addLuarmorGlobals } from '@definitions/luarmor';
import { addLuraphGlobals } from '@definitions/luraph';

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
} from '@typings/ast';
import type { DocComment } from '@typings/parser';
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

/** Tag indicating special diagnostic semantics for IDE rendering. */
export type DiagnosticTag = 'deprecated' | 'unnecessary';

/** Represents a type-related diagnostic message produced by the type checker. */
export interface TypeDiagnostic {
  readonly message: string;
  readonly range: NodeRange;
  readonly severity: 'error' | 'warning' | 'info' | 'hint';
  readonly code: string;
  readonly tags?: ReadonlyArray<DiagnosticTag>;
}

export { typeToString } from './types';

/** The result of type checking a Luau program. */
export interface TypeCheckResult {
  readonly diagnostics: ReadonlyArray<TypeDiagnostic>;
  readonly environment: TypeEnvironment;
  readonly allSymbols: ReadonlyMap<string, LuauType>;
}

interface TypeNarrowing {
  readonly variableName: string;
  readonly narrowedType: LuauType;
}

export type RequireResolver = (pathParts: ReadonlyArray<string>) => LuauType | undefined;

interface CheckerState {
  readonly env: TypeEnvironment;
  readonly diagnostics: TypeDiagnostic[];
  readonly ignoreState: IgnoreState;
  returnType: LuauType | undefined;
  isVariadic: boolean;
  readonly narrowings: Map<string, LuauType>;
  readonly allSymbols: Map<string, LuauType>;
  readonly requireResolver: RequireResolver | undefined;
}

interface CheckerOptions {
  readonly mode?: TypeCheckMode;
  readonly classes?: Map<string, ClassType>;
  readonly dataTypes?: Map<string, LuauType>;
  readonly ignoreState?: IgnoreState;
  readonly requireResolver?: RequireResolver;
}

const createCheckerState = (options: CheckerOptions = {}): CheckerState => {
  const mode = options.mode ?? 'strict';
  const env = createTypeEnvironment(mode);
  addLuauBuiltins(env);
  addRobloxGlobals(env);
  addSuncGlobals(env);
  addLuarmorGlobals(env);
  addLuraphGlobals(env);

  if (options.classes !== undefined) {
    for (const [name, classType] of options.classes) {
      (env.classes as Map<string, ClassType>).set(name, classType);
    }
  }

  if (options.dataTypes !== undefined) {
    for (const [name, type] of options.dataTypes) {
      env.globalScope.types.set(name, type);
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
    'requireResolver': options.requireResolver,
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

const trackSymbol = (state: CheckerState, name: string, type: LuauType): void => {
  state.allSymbols.set(name, type);
};

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

  if (type.kind === 'Primitive' && type.name === 'nil') return AnyType;

  return type;
};

const stripNilFromType = (type: LuauType): LuauType => {
  if (type.kind === 'Union') {
    const nonNil = type.types.filter(t => t.kind !== 'Primitive' || t.name !== 'nil');
    if (nonNil.length === 0) return NeverType;
    if (nonNil.length === 1) return nonNil[0]!;
    return createUnionType(nonNil);
  }
  if (type.kind === 'Optional') return type.type;
  if (type.kind === 'Primitive' && type.name === 'nil') return NeverType;
  return type;
};

const extractNarrowing = (state: CheckerState, condition: Expression): TypeNarrowing | undefined => {
  if (condition.kind === 'ParenthesizedExpression') return extractNarrowing(state, condition.expression);

  if (condition.kind === 'MethodCallExpression') {
    if (condition.method.name !== 'IsA') return undefined;
    if (condition.args.length === 0) return undefined;

    const firstArg = condition.args[0]!;
    if (firstArg.kind !== 'StringLiteral') return undefined;

    const className = firstArg.value;
    const classType = state.env.classes.get(className);
    if (classType === undefined) return undefined;

    if (condition.object.kind === 'Identifier')
      return { 'variableName': condition.object.name, 'narrowedType': classType };

    return undefined;
  }

  if (condition.kind === 'BinaryExpression' && condition.operator === '~=') {
    if (condition.right.kind === 'NilLiteral' && condition.left.kind === 'Identifier') {
      const symbol = lookupSymbol(state.env, condition.left.name);
      if (symbol !== undefined)
        return { 'variableName': condition.left.name, 'narrowedType': stripNilFromType(symbol.type) };
    }
    if (condition.left.kind === 'NilLiteral' && condition.right.kind === 'Identifier') {
      const symbol = lookupSymbol(state.env, condition.right.name);
      if (symbol !== undefined)
        return { 'variableName': condition.right.name, 'narrowedType': stripNilFromType(symbol.type) };
    }
  }

  if (condition.kind === 'BinaryExpression' && condition.operator === '==') {
    const typeofNarrowing = extractTypeofNarrowing(state, condition.left, condition.right);
    if (typeofNarrowing !== undefined) return typeofNarrowing;
    const reverseNarrowing = extractTypeofNarrowing(state, condition.right, condition.left);
    if (reverseNarrowing !== undefined) return reverseNarrowing;
  }

  if (condition.kind === 'Identifier') {
    const symbol = lookupSymbol(state.env, condition.name);
    if (symbol !== undefined) {
      const narrowed = stripNilFromType(symbol.type);
      if (narrowed !== symbol.type) return { 'variableName': condition.name, 'narrowedType': narrowed };
    }
  }

  if (condition.kind === 'BinaryExpression' && condition.operator === 'and') {
    const rightNarrowing = extractNarrowing(state, condition.right);
    if (rightNarrowing !== undefined) return rightNarrowing;

    const leftNarrowing = extractNarrowing(state, condition.left);
    if (leftNarrowing !== undefined) return leftNarrowing;
  }

  return undefined;
};

const extractTypeofNarrowing = (
  _state: CheckerState,
  callSide: Expression,
  litSide: Expression,
): TypeNarrowing | undefined => {
  if (callSide.kind !== 'CallExpression') return undefined;
  if (callSide.callee.kind !== 'Identifier' || callSide.callee.name !== 'type') return undefined;
  if (callSide.args.length === 0) return undefined;
  if (litSide.kind !== 'StringLiteral') return undefined;

  const arg = callSide.args[0]!;
  if (arg.kind !== 'Identifier') return undefined;

  const typeName = litSide.value;
  let narrowedType: LuauType;

  switch (typeName) {
    case 'string':
      narrowedType = StringType;
      break;
    case 'number':
      narrowedType = NumberType;
      break;
    case 'boolean':
      narrowedType = BooleanType;
      break;
    case 'nil':
      narrowedType = NilType;
      break;
    case 'table':
      narrowedType = createTableType(new Map(), undefined);
      break;
    case 'function':
      narrowedType = createFunctionType([], AnyType);
      break;
    default:
      return undefined;
  }

  return { 'variableName': arg.name, narrowedType };
};

const applyNarrowings = (state: CheckerState, narrowings: ReadonlyArray<TypeNarrowing>): void => {
  for (const narrowing of narrowings) state.narrowings.set(narrowing.variableName, narrowing.narrowedType);
};

const clearNarrowings = (state: CheckerState, narrowings: ReadonlyArray<TypeNarrowing>): void => {
  for (const narrowing of narrowings) state.narrowings.delete(narrowing.variableName);
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

const isInstanceDerived = (classType: ClassType): boolean => {
  let current: ClassType | undefined = classType;
  while (current !== undefined) {
    if (current.name === 'Instance') return true;
    current = current.superclass;
  }
  return false;
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

/** Checks a Luau program for type errors and produces diagnostics. */
export const checkProgram = (
  chunk: Chunk,
  options?: { mode?: TypeCheckMode; classes?: Map<string, ClassType>; dataTypes?: Map<string, LuauType>; requireResolver?: RequireResolver },
): TypeCheckResult => {
  const lastStatement = chunk.body[chunk.body.length - 1];
  const totalLines = lastStatement !== undefined ? lastStatement.range.end.line : 1;
  const ignoreState = parseIgnoreDirectives(chunk.comments, totalLines);

  const state = createCheckerState({ ...options, ignoreState });
  checkBlock(state, chunk.body);

  return { 'diagnostics': state.diagnostics, 'environment': state.env, 'allSymbols': state.allSymbols };
};

const blockAlwaysExits = (statements: ReadonlyArray<Statement>): boolean => {
  const last = statements[statements.length - 1];
  if (last === undefined) return false;

  if (last.kind === 'ReturnStatement') return true;
  if (last.kind === 'BreakStatement') return true;
  if (last.kind === 'ContinueStatement') return true;

  if (last.kind === 'IfStatement') {
    if (last.elseBody === undefined) return false;
    return (
      blockAlwaysExits(last.thenBody) &&
      blockAlwaysExits(last.elseBody) &&
      last.elseifClauses.every(c => blockAlwaysExits(c.body))
    );
  }

  return false;
};

const extractGuardNarrowing = (state: CheckerState, condition: Expression): TypeNarrowing | undefined => {
  if (condition.kind === 'ParenthesizedExpression') return extractGuardNarrowing(state, condition.expression);

  if (condition.kind === 'BinaryExpression' && condition.operator === '==') {
    if (condition.right.kind === 'NilLiteral' && condition.left.kind === 'Identifier') {
      const symbol = lookupSymbol(state.env, condition.left.name);
      if (symbol !== undefined)
        return { 'variableName': condition.left.name, 'narrowedType': stripNilFromType(symbol.type) };
    }
    if (condition.left.kind === 'NilLiteral' && condition.right.kind === 'Identifier') {
      const symbol = lookupSymbol(state.env, condition.right.name);
      if (symbol !== undefined)
        return { 'variableName': condition.right.name, 'narrowedType': stripNilFromType(symbol.type) };
    }
  }

  return undefined;
};

const checkBlock = (state: CheckerState, statements: ReadonlyArray<Statement>): void => {
  for (const stmt of statements) checkStatement(state, stmt);
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

  if (trimmed.endsWith('?')) {
    const baseType = resolveDocTypeAnnotation(state, trimmed.slice(0, -1));
    if (baseType === undefined) return undefined;
    return createUnionType([baseType, NilType]);
  }

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

  if (trimmed.endsWith('[]')) {
    const elementType = resolveDocTypeAnnotation(state, trimmed.slice(0, -2));
    if (elementType === undefined) return undefined;
    return createArrayType(elementType);
  }

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

  for (const value of decl.values) valueTypes.push(inferExpression(state, value));

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
    } else declaredType = widenTypeForMutableVariable(valueType);

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
        if (resolvedType !== undefined) docParamTypes.set(docParam.name, resolvedType);
      }
    }
  }

  const params: FunctionParam[] = [];
  for (const param of func.params) {
    if (param.name !== undefined) {
      let paramType: LuauType;
      if (param.type !== undefined) paramType = resolveTypeAnnotation(state, param.type);
      else if (docParamTypes.has(param.name.name)) paramType = docParamTypes.get(param.name.name)!;
      else paramType = AnyType;
      params.push({ 'name': param.name.name, 'type': paramType, 'optional': false });
      defineSymbol(state.env, param.name.name, paramType, 'Parameter', false);
      trackSymbol(state, param.name.name, paramType);
    } else if (param.isVariadic) {
      const varargType = param.type !== undefined ? resolveTypeAnnotation(state, param.type) : AnyType;
      params.push({ 'name': undefined, 'type': varargType, 'optional': true });
    }
  }

  let declaredReturnType: LuauType | undefined;
  if (func.returnType !== undefined) declaredReturnType = resolveTypeAnnotation(state, func.returnType);
  else if (docComment !== undefined && docComment.returns.length > 0 && docComment.returns[0]!.type !== undefined) {
    const docReturnType = resolveDocTypeAnnotation(state, docComment.returns[0]!.type!);
    declaredReturnType = docReturnType;
  }

  const savedReturnType = state.returnType;
  const savedVariadic = state.isVariadic;
  state.returnType = declaredReturnType;
  state.isVariadic = func.isVariadic;

  checkBlock(state, func.body);

  if (
    declaredReturnType !== undefined &&
    state.env.mode === 'strict' &&
    (declaredReturnType.kind !== 'Primitive' || declaredReturnType.name !== 'nil') &&
    blockAlwaysExits(func.body) === false
  ) {
    addDiagnostic(
      state,
      `Function with declared return type '${typeToString(declaredReturnType)}' must return a value on all code paths`,
      func.range,
      'error',
      'E013',
    );
  }

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

    let targetType: LuauType;
    if (target.kind === 'Identifier') {
      const symbol = lookupSymbol(state.env, target.name);
      targetType = symbol !== undefined ? symbol.type : inferExpression(state, target);
    } else targetType = inferExpression(state, target);

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

  if (state.env.mode === 'nonstrict') return;

  const numericOps = ['+=', '-=', '*=', '/=', '//=', '%=', '^='];
  const stringOps = ['..='];

  if (numericOps.includes(stmt.operator)) {
    if (isSubtype(targetType, NumberType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false)
      addDiagnostic(state, `Operator '${stmt.operator}' requires numeric operand`, stmt.target.range, 'error', 'E003');
    if (isSubtype(valueType, NumberType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false)
      addDiagnostic(state, `Operator '${stmt.operator}' requires numeric operand`, stmt.value.range, 'error', 'E003');
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

  const narrowing = extractNarrowing(state, stmt.condition);
  const narrowings: TypeNarrowing[] = narrowing !== undefined ? [narrowing] : [];

  enterScope(state.env, 'Conditional');
  applyNarrowings(state, narrowings);
  checkBlock(state, stmt.thenBody);
  clearNarrowings(state, narrowings);
  exitScope(state.env);

  for (const clause of stmt.elseifClauses) {
    inferExpression(state, clause.condition);

    const clauseNarrowing = extractNarrowing(state, clause.condition);
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

  if (stmt.elseifClauses.length === 0 && stmt.elseBody === undefined && blockAlwaysExits(stmt.thenBody)) {
    const guardNarrowing = extractGuardNarrowing(state, stmt.condition);
    if (guardNarrowing !== undefined) state.narrowings.set(guardNarrowing.variableName, guardNarrowing.narrowedType);
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

  if (state.env.mode !== 'nonstrict') {
    if (isSubtype(startType, NumberType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false)
      addDiagnostic(state, 'For loop start must be a number', stmt.start.range, 'error', 'E004');
    if (isSubtype(endType, NumberType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false)
      addDiagnostic(state, 'For loop end must be a number', stmt.end.range, 'error', 'E004');
    if (
      isSubtype(stepType, NumberType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false &&
      stmt.step !== undefined
    )
      addDiagnostic(state, 'For loop step must be a number', stmt.step.range, 'error', 'E004');
  }

  enterScope(state.env, 'Loop');
  defineSymbol(state.env, stmt.variable.name, NumberType, 'Variable', false);
  trackSymbol(state, stmt.variable.name, NumberType);
  checkBlock(state, stmt.body);
  exitScope(state.env);
};

const inferForGenericTypes = (state: CheckerState, stmt: ForGeneric): LuauType[] => {
  if (stmt.iterators.length === 0) return [];

  const firstIter = stmt.iterators[0]!;

  if (firstIter.kind === 'CallExpression' && firstIter.callee.kind === 'Identifier') {
    const funcName = firstIter.callee.name;
    if ((funcName === 'pairs' || funcName === 'ipairs') && firstIter.args.length > 0) {
      const tableType = resolveType(inferExpression(state, firstIter.args[0]!));

      if (tableType.kind === 'Table') {
        if (funcName === 'ipairs') {
          const valueType = tableType.indexer !== undefined ? tableType.indexer.valueType : AnyType;
          return [NumberType, valueType];
        }

        if (tableType.indexer !== undefined) return [tableType.indexer.keyType, tableType.indexer.valueType];

        if (tableType.properties.size > 0) {
          const valueTypes: LuauType[] = [];
          for (const [, prop] of tableType.properties) valueTypes.push(prop.type);
          const valueType = valueTypes.length === 1 ? valueTypes[0]! : createUnionType(valueTypes);
          return [StringType, valueType];
        }
      }
    }
  }

  if (firstIter.kind !== 'CallExpression') {
    const iterType = resolveType(inferExpression(state, firstIter));
    if (iterType.kind === 'Table') {
      if (iterType.indexer !== undefined) return [iterType.indexer.keyType, iterType.indexer.valueType];
      if (iterType.properties.size > 0) {
        const valueTypes: LuauType[] = [];
        for (const [, prop] of iterType.properties) valueTypes.push(prop.type);
        const valueType = valueTypes.length === 1 ? valueTypes[0]! : createUnionType(valueTypes);
        return [StringType, valueType];
      }
    }
  }

  return [];
};

const checkForGeneric = (state: CheckerState, stmt: ForGeneric): void => {
  for (const iter of stmt.iterators) inferExpression(state, iter);

  const inferredTypes = inferForGenericTypes(state, stmt);

  enterScope(state.env, 'Loop');

  for (let i = 0; i < stmt.variables.length; i++) {
    const variable = stmt.variables[i]!;
    const varType = i < inferredTypes.length ? inferredTypes[i]! : AnyType;
    defineSymbol(state.env, variable.name, varType, 'Variable', false);
    trackSymbol(state, variable.name, varType);
  }

  checkBlock(state, stmt.body);
  exitScope(state.env);
};

const checkReturnStatement = (state: CheckerState, stmt: ReturnStatement): void => {
  const returnTypes = stmt.values.map(v => inferExpression(state, v));

  if (state.returnType !== undefined && state.env.mode !== 'nonstrict') {
    const actualReturnType = returnTypes.length === 0 ? NilType : returnTypes[0]!;

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
  defineTypeAlias(state.env, stmt.name.name, { 'kind': 'TypeReference', 'name': stmt.name.name });

  if (stmt.typeParams !== undefined && stmt.typeParams.length > 0) {
    enterScope(state.env, 'Block');
    for (const param of stmt.typeParams) {
      const defaultType = param.defaultType !== undefined ? resolveTypeAnnotation(state, param.defaultType) : AnyType;
      defineTypeAlias(state.env, param.name, defaultType);
    }
  }

  const resolvedType = resolveTypeAnnotation(state, stmt.type);

  if (stmt.typeParams !== undefined && stmt.typeParams.length > 0) exitScope(state.env);

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

    case 'TypeCastExpression': {
      const exprType = inferExpression(state, expr.expression);
      const castType = resolveTypeAnnotation(state, expr.type);

      if (state.env.mode === 'strict' && expr.expression.kind === 'TableExpression') {
        const resolvedExpr = resolveType(exprType, state.env.classes);
        const resolvedCast = resolveType(castType, state.env.classes);
        if (resolvedExpr.kind === 'Table' && resolvedCast.kind === 'Table') {
          for (const field of expr.expression.fields) {
            if (field.kind !== 'TableFieldKey') continue;
            const targetProp = resolvedCast.properties.get(field.key.name);
            if (targetProp === undefined) continue;
            const fieldProp = resolvedExpr.properties.get(field.key.name);
            if (fieldProp === undefined) continue;
            const fieldType = resolveType(fieldProp.type, state.env.classes);
            const targetType = resolveType(targetProp.type, state.env.classes);
            if (isAssignable(fieldType, targetType, { 'mode': state.env.mode, 'variance': 'covariant' }) === false) {
              addDiagnostic(
                state,
                `Type '${typeToString(fieldType)}' is not assignable to type '${typeToString(targetType)}' for field '${field.key.name}'`,
                field.value.range,
                'error',
                'E002',
              );
            }
          }
        }
      }

      return castType;
    }

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
  const narrowedType = state.narrowings.get(id.name);
  if (narrowedType !== undefined) return narrowedType;

  const symbol = lookupSymbol(state.env, id.name);

  if (symbol === undefined) {
    if (state.env.mode === 'strict') addDiagnostic(state, `Unknown identifier '${id.name}'`, id.range, 'error', 'E006');
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
        if (isArray) elementTypes.push(valueType);
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

  if (arithmeticOps.includes(expr.operator)) {
    const leftResolved = resolveType(leftType, state.env.classes);
    const rightResolved = resolveType(rightType, state.env.classes);

    const mathTypeNames = ['Vector3', 'Vector2', 'CFrame', 'UDim', 'UDim2', 'Color3'];

    const isNumericCompatible = (t: LuauType): boolean => {
      if (t.kind === 'Any' || t.kind === 'Error') return true;
      if (t.kind === 'Primitive' && t.name === 'number') return true;
      if (t.kind === 'Literal' && t.baseType === 'number') return true;
      if (t.kind === 'TypeReference' && mathTypeNames.includes(t.name)) return true;
      if (t.kind === 'Union') return t.types.some(member => isNumericCompatible(member));
      if (t.kind === 'Table') {
        if (t.properties.has('X') && t.properties.has('Y')) return true;
        if (t.properties.has('Width') && t.properties.has('Height')) return true;
        if (t.properties.has('Scale') && t.properties.has('Offset')) return true;
      }
      return false;
    };

    const isDefinitelyNumeric = (t: LuauType): boolean => {
      if (t.kind === 'Any' || t.kind === 'Error') return true;
      if (t.kind === 'Primitive' && t.name === 'number') return true;
      if (t.kind === 'Literal' && t.baseType === 'number') return true;
      if (t.kind === 'TypeReference' && mathTypeNames.includes(t.name)) return true;
      if (t.kind === 'Union') return t.types.every(member => isDefinitelyNumeric(member));
      if (t.kind === 'Table') {
        if (t.properties.has('X') && t.properties.has('Y')) return true;
        if (t.properties.has('Width') && t.properties.has('Height')) return true;
        if (t.properties.has('Scale') && t.properties.has('Offset')) return true;
      }
      return false;
    };

    const checkOperand = (resolved: LuauType, original: LuauType, range: typeof expr.left.range): void => {
      if (isNumericCompatible(resolved) === false) {
        addDiagnostic(
          state,
          `Operator '${expr.operator}' cannot be applied to type '${typeToString(original)}'`,
          range,
          'error',
          'E011',
        );
      } else if (isDefinitelyNumeric(resolved) === false && state.env.mode !== 'nonstrict') {
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

    const getMathType = (t: LuauType): LuauType | undefined => {
      if (t.kind === 'TypeReference' && mathTypeNames.includes(t.name)) return t;
      if (t.kind === 'Class' && mathTypeNames.includes(t.name)) return t;
      if (t.kind === 'Table') {
        if (t.properties.has('X') && t.properties.has('Y')) return t;
        if (t.properties.has('Width') && t.properties.has('Height')) return t;
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

  if (comparisonOps.includes(expr.operator)) return BooleanType;

  switch (expr.operator) {
    case '..':
      return StringType;

    case '==':
    case '~=':
      return BooleanType;

    case 'and':
      return createUnionType([rightType, { 'kind': 'Literal', 'value': false, 'baseType': 'boolean' }, NilType]);

    case 'or': {
      const stripped = stripNilFromType(leftType);
      if (stripped.kind === 'Never') return rightType;
      return createUnionType([stripped, rightType]);
    }

    default:
      return AnyType;
  }
};

const inferUnaryExpression = (state: CheckerState, expr: UnaryExpression): LuauType => {
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

const inferInstanceNewCall = (state: CheckerState, expr: CallExpression): LuauType | undefined => {
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

  const instanceClass = state.env.classes.get('Instance');
  return instanceClass;
};

const inferCallExpression = (state: CheckerState, expr: CallExpression): LuauType => {
  const calleeType = resolveType(inferExpression(state, expr.callee), state.env.classes);

  for (const arg of expr.args) inferExpression(state, arg);

  const instanceNewType = inferInstanceNewCall(state, expr);
  if (instanceNewType !== undefined) return instanceNewType;

  const requireType = inferRequireCall(state, expr);
  if (requireType !== undefined) return requireType;

  if (calleeType.kind === 'Function') return resolveType(calleeType.returnType, state.env.classes);

  if (calleeType.kind === 'Any') return AnyType;

  if (calleeType.kind === 'Error') return calleeType;

  if (state.env.mode === 'strict')
    addDiagnostic(state, `Type '${typeToString(calleeType)}' is not callable`, expr.callee.range, 'error', 'E007');

  return createErrorType('not callable');
};

const extractStringLiteral = (expr: Expression): string | undefined => {
  if (expr.kind === 'StringLiteral') return expr.value;
  return undefined;
};

const extractRequirePath = (expr: Expression): string[] | undefined => {
  if (expr.kind === 'Identifier') return [expr.name];

  if (expr.kind === 'MemberExpression') {
    const objectPath = extractRequirePath(expr.object);
    if (objectPath === undefined) return undefined;
    return [...objectPath, expr.property.name];
  }

  if (expr.kind === 'IndexExpression') {
    const objectPath = extractRequirePath(expr.object);
    if (objectPath === undefined) return undefined;
    if (expr.index.kind === 'StringLiteral') return [...objectPath, expr.index.value];
    return undefined;
  }

  return undefined;
};

const inferRequireCall = (state: CheckerState, expr: CallExpression): LuauType | undefined => {
  if (state.requireResolver === undefined) return undefined;
  if (expr.callee.kind !== 'Identifier' || expr.callee.name !== 'require') return undefined;
  if (expr.args.length === 0) return undefined;

  const firstArg = expr.args[0];
  if (firstArg === undefined) return undefined;

  const pathParts = extractRequirePath(firstArg);
  if (pathParts === undefined || pathParts.length === 0) return undefined;

  const filtered = pathParts[0] === 'game' ? pathParts.slice(1) : pathParts;
  if (filtered.length === 0) return undefined;

  return state.requireResolver(filtered);
};

const inferSpecialMethodReturnType = (
  state: CheckerState,
  objectType: LuauType,
  methodName: string,
  args: ReadonlyArray<Expression>,
): LuauType | undefined => {
  if (methodName === 'GetService' && args.length >= 1) {
    const serviceName = extractStringLiteral(args[0]!);
    if (serviceName !== undefined) {
      const serviceClass = state.env.classes.get(serviceName);
      if (serviceClass !== undefined) return serviceClass;
    }
  }

  if (methodName === 'Clone' && args.length === 0) {
    if (objectType.kind === 'Class') return objectType;
  }

  if (methodName === 'FindFirstChildOfClass' && args.length >= 1) {
    const className = extractStringLiteral(args[0]!);
    if (className !== undefined) {
      const classType = state.env.classes.get(className);
      if (classType !== undefined) return createUnionType([classType, NilType]);
    }
  }

  if (methodName === 'FindFirstChildWhichIsA' && args.length >= 1) {
    const className = extractStringLiteral(args[0]!);
    if (className !== undefined) {
      const classType = state.env.classes.get(className);
      if (classType !== undefined) return createUnionType([classType, NilType]);
    }
  }

  if (methodName === 'FindFirstAncestorOfClass' && args.length >= 1) {
    const className = extractStringLiteral(args[0]!);
    if (className !== undefined) {
      const classType = state.env.classes.get(className);
      if (classType !== undefined) return createUnionType([classType, NilType]);
    }
  }

  if (methodName === 'FindFirstAncestorWhichIsA' && args.length >= 1) {
    const className = extractStringLiteral(args[0]!);
    if (className !== undefined) {
      const classType = state.env.classes.get(className);
      if (classType !== undefined) return createUnionType([classType, NilType]);
    }
  }

  if (methodName === 'WaitForChild' && args.length >= 1) {
    const childName = extractStringLiteral(args[0]!);
    if (childName !== undefined && objectType.kind === 'Class') {
      const instanceClass = state.env.classes.get('Instance');
      if (instanceClass !== undefined) return instanceClass;
    }
  }

  return undefined;
};

const inferSignalWaitReturnType = (signalType: LuauType): LuauType => {
  if (signalType.kind !== 'Table') return AnyType;

  const connectProp = signalType.properties.get('Connect');
  if (connectProp === undefined || connectProp.type.kind !== 'Function') return AnyType;

  const connectParams = connectProp.type.params;
  if (connectParams.length === 0) return AnyType;

  const callbackParam = connectParams[0];
  if (callbackParam === undefined || callbackParam.type.kind !== 'Function') return AnyType;

  const callbackParamTypes = callbackParam.type.params.map(p => p.type);

  if (callbackParamTypes.length === 0) return NilType;
  if (callbackParamTypes.length === 1) return callbackParamTypes[0]!;

  return callbackParamTypes[0]!;
};

const inferMethodCallExpression = (state: CheckerState, expr: MethodCallExpression): LuauType => {
  const objectType = resolveType(inferExpression(state, expr.object), state.env.classes);

  for (const arg of expr.args) inferExpression(state, arg);

  const specialReturnType = inferSpecialMethodReturnType(state, objectType, expr.method.name, expr.args);
  if (specialReturnType !== undefined) return specialReturnType;

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
          return resolveType(method.func.returnType, state.env.classes);
        }
        const prop = lookupClassProperty(resolved, expr.method.name);
        if (prop !== undefined && prop.type.kind === 'Function')
          return resolveType(prop.type.returnType, state.env.classes);
      }
      if (resolved.kind === 'Table') {
        const prop = resolved.properties.get(expr.method.name);
        if (prop !== undefined && prop.type.kind === 'Function')
          return resolveType(prop.type.returnType, state.env.classes);
      }
    }
  }

  if (objectType.kind === 'Class') {
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
      if (expr.method.name === 'Wait') {
        return inferSignalWaitReturnType(objectType);
      }
      return resolveType(prop.type.returnType, state.env.classes);
    }
  }

  if (objectType.kind === 'Any') return AnyType;

  if (objectType.kind === 'Error') return objectType;

  if (objectType.kind === 'Primitive' && objectType.name === 'string') {
    const stringLib = lookupSymbol(state.env, 'string');
    if (stringLib !== undefined && stringLib.type.kind === 'Table') {
      const method = stringLib.type.properties.get(expr.method.name);
      if (method !== undefined && method.type.kind === 'Function')
        return resolveType(method.type.returnType, state.env.classes);
    }
  }

  if (objectType.kind === 'Literal' && objectType.baseType === 'string') {
    const stringLib = lookupSymbol(state.env, 'string');
    if (stringLib !== undefined && stringLib.type.kind === 'Table') {
      const method = stringLib.type.properties.get(expr.method.name);
      if (method !== undefined && method.type.kind === 'Function')
        return resolveType(method.type.returnType, state.env.classes);
    }
  }

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
    if (objectType.kind === 'Class') {
      const correctMethod = lookupClassMethod(objectType, correction);
      if (correctMethod !== undefined) return resolveType(correctMethod.func.returnType, state.env.classes);
    }
    if (objectType.kind === 'Table') {
      const correctProp = objectType.properties.get(correction);
      if (correctProp !== undefined && correctProp.type.kind === 'Function')
        return resolveType(correctProp.type.returnType, state.env.classes);
    }
    return AnyType;
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
  const indexType = inferExpression(state, expr.index);

  if (objectType.kind === 'Table' && objectType.indexer !== undefined)
    return resolveType(objectType.indexer.valueType, state.env.classes);

  if (objectType.kind === 'Table' && indexType.kind === 'Literal' && indexType.baseType === 'string' && typeof indexType.value === 'string') {
    const prop = objectType.properties.get(indexType.value);
    if (prop !== undefined) return resolveType(prop.type, state.env.classes);
  }

  if (objectType.kind === 'Class') {
    if (indexType.kind === 'Literal' && indexType.baseType === 'string' && typeof indexType.value === 'string') {
      const prop = lookupClassProperty(objectType, indexType.value);
      if (prop !== undefined) return resolveType(prop.type, state.env.classes);
    }
    if (isInstanceDerived(objectType)) {
      const instanceClass = state.env.classes.get('Instance');
      if (instanceClass !== undefined) return instanceClass;
    }
  }

  if (objectType.kind === 'Any') return AnyType;

  if (objectType.kind === 'Error') return objectType;

  return AnyType;
};

const inferMemberExpression = (state: CheckerState, expr: MemberExpression): LuauType => {
  const objectType = resolveType(inferExpression(state, expr.object), state.env.classes);

  if (objectType.kind === 'Table') {
    const prop = objectType.properties.get(expr.property.name);
    if (prop !== undefined) return resolveType(prop.type, state.env.classes);

    if (objectType.indexer !== undefined) return resolveType(objectType.indexer.valueType, state.env.classes);
  }

  if (objectType.kind === 'Class') {
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

    const getSuperclass = (className: string): string | undefined => {
      const classType = state.env.classes.get(className);
      return classType?.superclass?.name;
    };
    const commonChildType = getCommonChildType(objectType.name, expr.property.name, getSuperclass);
    if (commonChildType !== undefined) {
      const childClass = state.env.classes.get(commonChildType);
      if (childClass !== undefined) return childClass;
      return { 'kind': 'TypeReference', 'name': commonChildType };
    }

    if (isInstanceDerived(objectType)) {
      const instanceClass = state.env.classes.get('Instance');
      if (instanceClass !== undefined) return instanceClass;
      return AnyType;
    }
  }

  if (objectType.kind === 'Any') return AnyType;

  if (objectType.kind === 'Error') return objectType;

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
      if (typeof annotation.value === 'number') return createNumberLiteral(annotation.value);
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

  const alias = lookupTypeAlias(state.env, ref.name);
  if (alias !== undefined) return alias;

  const classType = state.env.classes.get(ref.name);
  if (classType !== undefined) return classType;

  const enumType = state.env.enums.get(ref.name);
  if (enumType !== undefined) return enumType;

  if (state.env.mode === 'strict') addDiagnostic(state, `Unknown type '${ref.name}'`, ref.range, 'error', 'E010');

  return AnyType;
};
