/**
 * Test for WaitForChild chain resolution bug
 */

import { buildGlobalEnvironment } from '../src/@definitions/globals';
import type { LuauType, ClassType } from '../src/@typings/types';

const globalEnv = buildGlobalEnvironment();

// Matches the extractExpressionChain function from completion.ts
const extractExpressionChain = (
  beforeCursor: string,
): { expression: string; prefix: string; isMethodAccess: boolean } | undefined => {
  const chainMatch = beforeCursor.match(
    /([a-zA-Z_]\w*(?:\s*\.\s*[a-zA-Z_]\w*|\s*:\s*[a-zA-Z_]\w*|\s*\([^)]*\)|\s*\[[^\]]*\]|\s*'[^']*'|\s*"[^"]*")*)\s*([.:])(\w*)$/,
  );

  if (chainMatch !== null) {
    const [, expr, accessor, prefix] = chainMatch;
    if (expr === undefined || accessor === undefined) return undefined;

    return {
      'expression': expr.replace(/\s+/g, ''),
      'prefix': prefix ?? '',
      'isMethodAccess': accessor === ':',
    };
  }

  return undefined;
};

// Matches the resolveTypeReference function from completion.ts
const resolveTypeReference = (type: LuauType): LuauType => {
  if (type.kind === 'TypeReference') {
    const className = type.name;
    const classType = globalEnv.robloxClasses.get(className);
    if (classType !== undefined) return classType;
  }
  return type;
};

// Matches the resolveMemberType function from completion.ts
const resolveMemberType = (type: LuauType, memberName: string): LuauType | undefined => {
  const resolvedType = resolveTypeReference(type);

  if (resolvedType.kind === 'Class') {
    const prop = resolvedType.properties.get(memberName);
    if (prop !== undefined) return resolveTypeReference(prop.type);

    const method = resolvedType.methods.get(memberName);
    if (method !== undefined) return method.func;

    if (resolvedType.superclass !== undefined) {
      return resolveMemberType(resolvedType.superclass, memberName);
    }
  } else if (resolvedType.kind === 'Table') {
    const prop = resolvedType.properties.get(memberName);
    if (prop !== undefined) return resolveTypeReference(prop.type);
  }

  return undefined;
};

// Expression parser matching completion.ts implementation
type ExprPart =
  | { kind: 'property'; name: string }
  | { kind: 'method'; name: string; args: string }
  | { kind: 'call'; args: string };

const parseExpression = (expression: string): ExprPart[] => {
  const parts: ExprPart[] = [];
  let current = '';
  let i = 0;

  while (i < expression.length) {
    const char = expression[i];
    if (char === '.') {
      if (current !== '') {
        parts.push({ 'kind': 'property', 'name': current });
        current = '';
      }
      i++;
    } else if (char === ':') {
      if (current !== '') {
        parts.push({ 'kind': 'property', 'name': current });
        current = '';
      }
      i++;
      let methodName = '';
      while (i < expression.length && /\w/.test(expression[i] ?? '')) {
        methodName += expression[i];
        i++;
      }
      while (i < expression.length && /\s/.test(expression[i] ?? '')) i++;
      let args = '';
      if (expression[i] === '(' || expression[i] === '"' || expression[i] === "'") {
        const startArgs = i;
        if (expression[i] === '(') {
          let depth = 1;
          i++;
          while (i < expression.length && depth > 0) {
            if (expression[i] === '(') depth++;
            else if (expression[i] === ')') depth--;
            i++;
          }
        } else {
          const quote = expression[i];
          i++;
          while (i < expression.length && expression[i] !== quote) i++;
          if (expression[i] === quote) i++;
        }
        args = expression.slice(startArgs, i);
      }
      if (methodName !== '') {
        parts.push({ 'kind': 'method', 'name': methodName, args });
      }
    } else if (char === '(' || char === '[') {
      if (current !== '') {
        parts.push({ 'kind': 'property', 'name': current });
        current = '';
      }
      const open = char;
      const close = char === '(' ? ')' : ']';
      const startArgs = i;
      let depth = 1;
      i++;
      while (i < expression.length && depth > 0) {
        if (expression[i] === open) depth++;
        else if (expression[i] === close) depth--;
        i++;
      }
      parts.push({ 'kind': 'call', 'args': expression.slice(startArgs, i) });
    } else if (char !== undefined && /\w/.test(char)) {
      current += char;
      i++;
    } else {
      i++;
    }
  }

  if (current !== '') {
    parts.push({ 'kind': 'property', 'name': current });
  }

  return parts;
};

// Full expression type resolver matching completion.ts implementation
const resolveExpressionType = (expression: string): LuauType | undefined => {
  const parts = parseExpression(expression);

  console.log('Parsing expression:', expression);
  console.log('Parts:', JSON.stringify(parts, null, 2));

  if (parts.length === 0) return undefined;

  const firstPart = parts[0];
  if (firstPart === undefined || firstPart.kind !== 'property') return undefined;
  const firstName = firstPart.name;

  let currentType: LuauType | undefined;

  // Check global symbols
  const globalSymbol = globalEnv.env.globalScope.symbols.get(firstName);
  if (globalSymbol !== undefined) {
    currentType = globalSymbol.type;
    console.log('First part resolved from globals to:', currentType?.kind, (currentType as ClassType)?.name);
  } else {
    const classType = globalEnv.robloxClasses.get(firstName);
    if (classType !== undefined) {
      currentType = classType;
      console.log('First part resolved from classes to:', currentType?.kind, (currentType as ClassType)?.name);
    }
  }

  if (currentType === undefined) {
    console.log('First part could not be resolved');
    return undefined;
  }

  // Resolve chain
  for (let partIdx = 1; partIdx < parts.length; partIdx++) {
    const part = parts[partIdx];
    if (part === undefined) break;

    console.log('Processing part', partIdx, ':', JSON.stringify(part));

    if (part.kind === 'property') {
      currentType = resolveMemberType(currentType, part.name);
      if (currentType === undefined) {
        console.log('Failed to resolve property', part.name);
        return undefined;
      }
      console.log('Resolved property to:', currentType?.kind, (currentType as ClassType)?.name);
    } else if (part.kind === 'method') {
      // For methods, get return type
      if (currentType !== undefined) {
        const resolvedCurrent = resolveTypeReference(currentType);
        console.log('Looking for method on:', resolvedCurrent?.kind, (resolvedCurrent as ClassType)?.name);

        if (resolvedCurrent.kind === 'Class') {
          const method = resolvedCurrent.methods.get(part.name);
          if (method !== undefined) {
            console.log('Found method, return type:', method.func.returnType?.kind, (method.func.returnType as ClassType)?.name);
            currentType = resolveTypeReference(method.func.returnType);
            console.log('After resolving TypeReference:', currentType?.kind, (currentType as ClassType)?.name);
            continue;
          }

          // Check superclass
          let superclass = resolvedCurrent.superclass;
          while (superclass !== undefined) {
            console.log('Checking superclass:', superclass.name);
            const superMethod = superclass.methods.get(part.name);
            if (superMethod !== undefined) {
              console.log('Found method in superclass, return type:', superMethod.func.returnType?.kind, (superMethod.func.returnType as ClassType)?.name);
              currentType = resolveTypeReference(superMethod.func.returnType);
              console.log('After resolving TypeReference:', currentType?.kind, (currentType as ClassType)?.name);
              break;
            }
            superclass = superclass.superclass;
          }
          if (currentType !== undefined && currentType.kind !== 'TypeReference') {
            continue;
          }
        }
      }
      console.log('Failed to resolve method', part.name);
      return undefined;
    } else if (part.kind === 'call') {
      if (currentType !== undefined && currentType.kind === 'Function') {
        currentType = resolveTypeReference(currentType.returnType);
      }
    }
  }

  return currentType;
};

console.log('=== WaitForChild Chain Test ===\n');

// First check if WaitForChild method exists on Instance
const instanceClass = globalEnv.robloxClasses.get('Instance');
if (instanceClass !== undefined && instanceClass.kind === 'Class') {
  const waitForChild = instanceClass.methods.get('WaitForChild');
  console.log('Instance.WaitForChild exists:', waitForChild !== undefined);
  if (waitForChild !== undefined) {
    console.log('WaitForChild return type:', waitForChild.func.returnType);
  }
}

// Check Workspace class
const workspaceClass = globalEnv.robloxClasses.get('Workspace');
if (workspaceClass !== undefined && workspaceClass.kind === 'Class') {
  console.log('\nWorkspace superclass chain:');
  let cls: ClassType | undefined = workspaceClass;
  while (cls !== undefined && cls.superclass !== undefined) {
    console.log('  ', cls.name, '->', cls.superclass.name);
    cls = cls.superclass;
  }
  if (cls !== undefined) {
    console.log('  ', cls.name, '(root)');
  }
}

console.log('\n--- Test 1: workspace:WaitForChild("X") ---');
const test1 = resolveExpressionType('workspace:WaitForChild("X")');
console.log('Result:', test1?.kind, (test1 as ClassType)?.name);

console.log('\n--- Test 2: workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds") ---');
const test2 = resolveExpressionType('workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds")');
console.log('Result:', test2?.kind, (test2 as ClassType)?.name);

console.log('\n--- Test 3: Expression chain extraction ---');
const chain = extractExpressionChain('workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds"):');
console.log('Chain info:', chain);
