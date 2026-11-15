import { getCommonChildType } from '@definitions/commonChildren';
import {
  debugLog,
  quickScanForVariableType,
  SERVICE_CLASS_MAP,
  VARIABLE_NAME_HINTS,
} from '@lsp/handlers/completion/inference';

import type { ExprPart } from '@typings/completion';
import type { DocumentManager, ParsedDocument } from '@typings/lsp';
import type { ClassType, LuauType } from '@typings/types';

/** Resolves a named type reference to its Roblox class or data type. */
export const resolveTypeReference = (type: LuauType, documentManager: DocumentManager): LuauType => {
  if (type.kind === 'TypeReference') {
    const typeName = type.name;

    const classType = documentManager.globalEnv.robloxClasses.get(typeName);
    if (classType !== undefined) return classType;

    const dataType = documentManager.globalEnv.robloxDataTypes.get(typeName);
    if (dataType !== undefined) return dataType;
  }
  return type;
};

/** Resolves the type of a dotted, method or call expression chain. */
export const resolveExpressionType = (
  expression: string,
  documentManager: DocumentManager,
  document?: ParsedDocument,
  liveContent?: string,
  logFn?: (message: string) => void,
  documentUri?: string,
): LuauType | undefined => {
  const log = logFn ?? debugLog;
  log(`Resolving expression: ${expression}`);

  const parts: ExprPart[] = [];
  let current = '';
  let i = 0;

  while (i < expression.length) {
    const char = expression[i] ?? '';
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
      if (methodName !== '') parts.push({ 'kind': 'method', 'name': methodName, args });
    } else if (char === '[') {
      if (current !== '') {
        parts.push({ 'kind': 'property', 'name': current });
        current = '';
      }
      const startBracket = i;
      let depth = 1;
      i++;
      while (i < expression.length && depth > 0) {
        if (expression[i] === '[') depth++;
        else if (expression[i] === ']') depth--;
        i++;
      }
      const bracketContent = expression.slice(startBracket + 1, i - 1).trim();
      const stringKeyMatch = bracketContent.match(/^['"](.+)['"]$/);
      if (stringKeyMatch !== null && stringKeyMatch[1] !== undefined)
        parts.push({ 'kind': 'property', 'name': stringKeyMatch[1] });
      else parts.push({ 'kind': 'call', 'args': expression.slice(startBracket, i) });
    } else if (char === '(') {
      if (current !== '') {
        parts.push({ 'kind': 'property', 'name': current });
        current = '';
      }
      const startArgs = i;
      let depth = 1;
      i++;
      while (i < expression.length && depth > 0) {
        if (expression[i] === '(') depth++;
        else if (expression[i] === ')') depth--;
        i++;
      }
      parts.push({ 'kind': 'call', 'args': expression.slice(startArgs, i) });
    } else if (/\w/.test(char)) {
      current += char;
      i++;
    } else i++;
  }

  if (current !== '') parts.push({ 'kind': 'property', 'name': current });

  if (parts.length === 0) return undefined;

  const firstPart = parts[0];
  if (firstPart === undefined || firstPart.kind !== 'property') return undefined;
  const firstName = firstPart.name;

  let currentType: LuauType | undefined;

  const globalSymbol = documentManager.globalEnv.env.globalScope.symbols.get(firstName);
  if (globalSymbol !== undefined) {
    currentType = globalSymbol.type;
    log(`First part '${firstName}' resolved from globals: ${currentType.kind}`);
  } else {
    const classType = documentManager.globalEnv.robloxClasses.get(firstName);
    if (classType !== undefined) {
      currentType = classType;
      log(`First part '${firstName}' resolved from robloxClasses: ${currentType.kind}`);
    }
  }

  if (currentType === undefined && document?.typeCheckResult !== undefined) {
    log(`Checking allSymbols for '${firstName}'...`);
    const symbolType = document.typeCheckResult.allSymbols.get(firstName);
    if (symbolType !== undefined) {
      log(`Found '${firstName}' in allSymbols, type: ${symbolType.kind}`);
      const resolved = resolveTypeReference(symbolType, documentManager);
      log(`Resolved type: ${resolved.kind}${resolved.kind === 'Class' ? ` (${resolved.name})` : ''}`);

      if (resolved.kind === 'Class' || resolved.kind === 'Table') currentType = resolved;
      else if (resolved.kind === 'Union') {
        const nonNilTypes = resolved.types.filter((t: LuauType) => t.kind !== 'Primitive' || t.name !== 'nil');
        for (const member of nonNilTypes) {
          const memberResolved = resolveTypeReference(member, documentManager);
          if (memberResolved.kind === 'Class' || memberResolved.kind === 'Table') {
            currentType = memberResolved;
            break;
          }
        }
      } else if (resolved.kind === 'Function') {
        const returnResolved = resolveTypeReference(resolved.returnType, documentManager);
        if (returnResolved.kind === 'Class' || returnResolved.kind === 'Table') currentType = returnResolved;
      } else if (resolved.kind !== 'Any')
        log(`allSymbols type for '${firstName}' not directly usable: ${resolved.kind}`);
    } else log(`'${firstName}' not found in allSymbols`);
  } else if (currentType === undefined)
    log(
      `Skipping allSymbols check: doc=${document !== undefined}, typeCheck=${document?.typeCheckResult !== undefined}`,
    );

  if (currentType === undefined && liveContent !== undefined) {
    log(`Running quick scan for '${firstName}'...`);
    const scannedType = quickScanForVariableType(firstName, liveContent, documentManager, log, documentUri);
    if (scannedType !== undefined) {
      log(
        `Quick scan found '${firstName}': ${scannedType.kind}${scannedType.kind === 'Class' ? ` (${scannedType.name})` : ''}`,
      );
      currentType = scannedType;
    } else log(`Quick scan found nothing for '${firstName}'`);
  } else if (currentType === undefined) log(`Skipping quick scan: liveContent=${liveContent !== undefined}`);

  if (currentType === undefined) {
    const hintedClass = VARIABLE_NAME_HINTS.get(firstName);
    if (hintedClass !== undefined) {
      const classType = documentManager.globalEnv.robloxClasses.get(hintedClass);
      if (classType !== undefined) currentType = classType;
    }
  }

  if (currentType === undefined) return undefined;

  for (let partIdx = 1; partIdx < parts.length; partIdx++) {
    const part = parts[partIdx];
    if (part === undefined) break;

    if (part.kind === 'property') {
      if (partIdx === 1 && firstName === 'game') {
        const serviceClassName = SERVICE_CLASS_MAP.get(part.name);
        if (serviceClassName !== undefined) {
          const serviceClass = documentManager.globalEnv.robloxClasses.get(serviceClassName);
          if (serviceClass !== undefined) {
            currentType = serviceClass;
            continue;
          }
        }
      }

      if (partIdx === 1 && firstName === 'game' && part.name === 'Workspace') {
        const workspaceClass = documentManager.globalEnv.robloxClasses.get('Workspace');
        if (workspaceClass !== undefined) {
          currentType = workspaceClass;
          continue;
        }
      }

      currentType = resolveMemberType(currentType, part.name, documentManager);
      if (currentType === undefined) return undefined;
    } else if (part.kind === 'method') {
      if (part.name.toLowerCase() === 'getservice') {
        const serviceMatch = part.args.match(/["'](\w+)["']/);
        if (serviceMatch !== null) {
          const serviceName = serviceMatch[1];
          if (serviceName !== undefined) {
            const serviceClass = documentManager.globalEnv.robloxClasses.get(serviceName);
            if (serviceClass !== undefined) {
              currentType = serviceClass;
              continue;
            }
          }
        }
      }

      if (part.name === 'FindFirstChildOfClass' || part.name === 'FindFirstChildWhichIsA') {
        const classMatch = part.args.match(/["'](\w+)["']/);
        if (classMatch !== null) {
          const className = classMatch[1];
          if (className !== undefined) {
            const classType = documentManager.globalEnv.robloxClasses.get(className);
            if (classType !== undefined) {
              currentType = classType;
              continue;
            }
          }
        }
      }

      if (part.name === 'FindFirstAncestorOfClass' || part.name === 'FindFirstAncestorWhichIsA') {
        const classMatch = part.args.match(/["'](\w+)["']/);
        if (classMatch !== null) {
          const className = classMatch[1];
          if (className !== undefined) {
            const classType = documentManager.globalEnv.robloxClasses.get(className);
            if (classType !== undefined) {
              currentType = classType;
              continue;
            }
          }
        }
      }

      if (part.name === 'Clone' && part.args === '()') continue;

      if (part.name === 'WaitForChild' || part.name === 'FindFirstChild') {
        const childMatch = part.args.match(/["'](\w+)["']/);
        if (childMatch !== null && currentType !== undefined) {
          const childName = childMatch[1];
          const resolvedCurrent = resolveTypeReference(currentType, documentManager);
          if (childName !== undefined && resolvedCurrent.kind === 'Class') {
            const commonChildType = getCommonChildType(resolvedCurrent.name, childName, className =>
              getSuperclassName(className, documentManager),
            );
            if (commonChildType !== undefined) {
              const childClassType = documentManager.globalEnv.robloxClasses.get(commonChildType);
              if (childClassType !== undefined) {
                debugLog('WaitForChild/FindFirstChild resolved via common child:', childName, '->', commonChildType);
                currentType = childClassType;
                continue;
              }
            }
          }
        }
      }

      debugLog('Resolving method:', part.name, 'on type:', currentType?.kind);
      if (currentType !== undefined) {
        const resolvedCurrent = resolveTypeReference(currentType, documentManager);
        debugLog(
          'Resolved current type:',
          resolvedCurrent.kind,
          resolvedCurrent.kind === 'Class' ? resolvedCurrent.name : '',
        );
        if (resolvedCurrent.kind === 'Class') {
          let searchClass: ClassType | undefined = resolvedCurrent;
          while (searchClass !== undefined) {
            const method = searchClass.methods.get(part.name);
            if (method !== undefined) {
              debugLog('Found method in class:', searchClass.name, 'return type:', method.func.returnType);
              currentType = resolveTypeReference(method.func.returnType, documentManager);
              debugLog(
                'After resolving return type:',
                currentType.kind,
                currentType.kind === 'Class' ? currentType.name : '',
              );
              break;
            }
            debugLog('Method not found on:', searchClass.name, 'checking superclass');
            searchClass = searchClass.superclass;
          }
          if (searchClass !== undefined) {
            debugLog('Method resolution succeeded, continuing with type:', currentType?.kind);
            continue;
          }
          debugLog('Method not found in class hierarchy');
        }
      }
      debugLog('Failed to resolve method:', part.name);
      return undefined;
    } else if (part.kind === 'call')
      if (currentType !== undefined && currentType.kind === 'Function')
        currentType = resolveTypeReference(currentType.returnType, documentManager);
  }

  return currentType;
};

/** Returns the superclass name of a Roblox class. */
export const getSuperclassName = (className: string, documentManager: DocumentManager): string | undefined => {
  const classType = documentManager.globalEnv.robloxClasses.get(className);
  if (classType !== undefined && classType.kind === 'Class' && classType.superclass !== undefined)
    return classType.superclass.name;
  return undefined;
};

const resolveMemberType = (
  type: LuauType,
  memberName: string,
  documentManager: DocumentManager,
): LuauType | undefined => {
  const resolvedType = resolveTypeReference(type, documentManager);

  if (resolvedType.kind === 'Class') {
    const prop = resolvedType.properties.get(memberName);
    if (prop !== undefined) return resolveTypeReference(prop.type, documentManager);

    const method = resolvedType.methods.get(memberName);
    if (method !== undefined) return method.func;

    if (resolvedType.superclass !== undefined) {
      const inheritedMember = resolveMemberType(resolvedType.superclass, memberName, documentManager);
      if (inheritedMember !== undefined) return inheritedMember;
    }

    const commonChildType = getCommonChildType(resolvedType.name, memberName, className =>
      getSuperclassName(className, documentManager),
    );
    if (commonChildType !== undefined) {
      const childClassType = documentManager.globalEnv.robloxClasses.get(commonChildType);
      if (childClassType !== undefined) return childClassType;
    }
  } else if (resolvedType.kind === 'Table') {
    const prop = resolvedType.properties.get(memberName);
    if (prop !== undefined) return resolveTypeReference(prop.type, documentManager);
  }

  return undefined;
};
