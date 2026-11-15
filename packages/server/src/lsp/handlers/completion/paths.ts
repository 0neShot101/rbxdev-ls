import type { ModuleReference } from '@typings/protocol';

/** Splits a member expression into its dotted and bracketed segments. */
export const splitMemberExpression = (expr: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (ch === '.') {
      if (current !== '') parts.push(current);
      current = '';
      i++;
    } else if (ch === '[') {
      if (current !== '') parts.push(current);
      current = '';
      i++;
      const quote = expr[i];
      if (quote === "'" || quote === '"') {
        i++;
        let key = '';
        while (i < expr.length && expr[i] !== quote) {
          key += expr[i];
          i++;
        }
        if (i < expr.length) i++;
        if (i < expr.length && expr[i] === ']') i++;
        parts.push(key);
      } else {
        while (i < expr.length && expr[i] !== ']') i++;
        if (i < expr.length) i++;
      }
    } else {
      current += ch;
      i++;
    }
  }

  if (current !== '') parts.push(current);
  return parts;
};

/** Extracts the member-access chain, prefix and access operator immediately before the cursor. */
export const extractExpressionChain = (
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

const CHILD_ACCESS_METHODS = new Set(['WaitForChild', 'FindFirstChild']);

const extractStringArg = (expr: string, startIdx: number): { value: string; endIdx: number } | undefined => {
  let i = startIdx;
  while (i < expr.length && /\s/.test(expr[i] ?? '')) i++;

  const opener = expr[i];
  if (opener === '(' || opener === "'" || opener === '"') {
    const isParenWrapped = opener === '(';
    if (isParenWrapped) {
      i++;
      while (i < expr.length && /\s/.test(expr[i] ?? '')) i++;
    }

    const quote = expr[i];
    if (quote === "'" || quote === '"') {
      i++;
      let value = '';
      while (i < expr.length && expr[i] !== quote) {
        value += expr[i];
        i++;
      }
      if (i < expr.length) i++;
      if (isParenWrapped) {
        while (i < expr.length && expr[i] !== ')') i++;
        if (i < expr.length) i++;
      }
      if (value !== '') return { value, 'endIdx': i };
    }
  }
  return undefined;
};

const splitPathExpression = (expr: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    if (char === '.') {
      if (current !== '') {
        parts.push(current);
        current = '';
      }
      i++;
    } else if (char === '[') {
      if (current !== '') {
        parts.push(current);
        current = '';
      }
      i++;
      while (i < expr.length && /\s/.test(expr[i] ?? '')) i++;
      const quote = expr[i];
      if (quote === '"' || quote === "'") {
        i++;
        let name = '';
        while (i < expr.length && expr[i] !== quote) {
          name += expr[i];
          i++;
        }
        if (name !== '') parts.push(name);
        i++;
        while (i < expr.length && expr[i] !== ']') i++;
        i++;
      } else {
        while (i < expr.length && expr[i] !== ']') i++;
        i++;
      }
    } else if (char === ':') {
      if (current !== '') {
        if (CHILD_ACCESS_METHODS.has(current)) {
          const arg = extractStringArg(expr, i + 1);
          if (arg !== undefined) {
            parts.push(arg.value);
            current = '';
            i = arg.endIdx;
            continue;
          }
        }
        parts.push(current);
        current = '';
      }
      i++;
    } else if (/\w/.test(char ?? '')) {
      current += char;
      i++;
    } else if ((char === "'" || char === '"') && CHILD_ACCESS_METHODS.has(current)) {
      const arg = extractStringArg(expr, i);
      if (arg !== undefined) {
        parts.push(arg.value);
        current = '';
        i = arg.endIdx;
        continue;
      }
      i++;
    } else if (char === '(') {
      if (CHILD_ACCESS_METHODS.has(current)) {
        const arg = extractStringArg(expr, i);
        if (arg !== undefined) {
          parts.push(arg.value);
          current = '';
          i = arg.endIdx;
          continue;
        }
      }
      if (current !== '') current = '';
      let depth = 1;
      i++;
      while (i < expr.length && depth > 0) {
        if (expr[i] === '(') depth++;
        else if (expr[i] === ')') depth--;
        i++;
      }
    } else i++;
  }

  if (current !== '' && CHILD_ACCESS_METHODS.has(current) === false) parts.push(current);

  return parts;
};

const GAME_SERVICE_NAMES = new Set([
  'Workspace',
  'Players',
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
  'CoreGui',
  'StarterPlayerScripts',
  'StarterCharacterScripts',
]);

/** Converts a `game`-rooted or service-rooted expression into a live game tree path. */
export const parseGameTreePath = (expression: string): string[] | undefined => {
  const expr = expression.trim();

  if (expr.startsWith('game.') || expr.startsWith('game:') || expr.startsWith('game[')) {
    let rest = expr.slice(4);
    if (rest.startsWith('.') || rest.startsWith(':')) rest = rest.slice(1);

    const getServiceMatch = rest.match(/^[Gg]et[Ss]ervice\s*(?:\(\s*["'](\w+)["']\s*\)|["'](\w+)["'])/);
    if (getServiceMatch !== null) {
      const serviceName = getServiceMatch[1] ?? getServiceMatch[2];
      if (serviceName === undefined) return undefined;

      const remaining = rest.slice(getServiceMatch[0].length);
      const path = [serviceName];
      if (remaining !== '') path.push(...splitPathExpression(remaining));
      return path;
    }

    const parts = splitPathExpression(rest);
    return parts.length > 0 ? parts : undefined;
  }

  if (expr.startsWith('workspace.') || expr.startsWith('workspace:') || expr.startsWith('workspace[')) {
    let rest = expr.slice(9);
    if (rest.startsWith('.') || rest.startsWith(':')) rest = rest.slice(1);
    const parts = splitPathExpression(rest);
    return ['Workspace', ...parts];
  }

  if (expr === 'workspace') return ['Workspace'];

  const firstIdent = expr.match(/^(\w+)/);
  if (firstIdent !== null && firstIdent[1] !== undefined && GAME_SERVICE_NAMES.has(firstIdent[1])) {
    const serviceName = firstIdent[1];
    const rest = expr.slice(serviceName.length);
    if (rest === '') return [serviceName];
    const parts = splitPathExpression(rest);
    return [serviceName, ...parts];
  }

  return undefined;
};

/** Extracts the module reference of a `require(game...)` call ending at the cursor. */
export const extractRequireExpression = (beforeCursor: string): ModuleReference | undefined => {
  const requireMatch = beforeCursor.match(/require\s*\(\s*game[.[\]]([^)]+)\s*\)[.:]\s*$/);
  if (requireMatch === null) return undefined;

  const rawPath = requireMatch[1];
  if (rawPath === undefined) return undefined;

  const pathParts = splitMemberExpression(rawPath).filter(p => p.length > 0);
  if (pathParts.length === 0) return undefined;

  return { 'kind': 'path', 'path': pathParts };
};
