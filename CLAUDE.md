# Coding Standards & Style Guide

This project adheres to a strict set of coding conventions focused on performance, type safety, and minimalism. All contributors are expected to follow these guidelines to maintain a consistent codebase.

## Core Philosophy

"Strict, Optimized, Minimal."

We prioritize functional programming patterns over OOP boilerplate, leverage modern TypeScript features for inference, and rigorously apply DRY (Don't Repeat Yourself) principles. Code should be self-documenting; if it requires line-by-line comments, it is likely too complex.

## 1. Syntax & Formatting

### Arrow Functions

All functions—including class methods, exports, and callbacks—must use arrow syntax `() =>`.

```ts
// ❌ Avoid
function handler(req, res) { ... }

// ✅ Preferred
const handler = (req: Request, res: Response) => { ... };
```

### Minimal Brackets

Remove curly braces `{}` for single-line control flow statements.

```ts
// ❌ Avoid
if (isValid) {
  return true;
}

// ✅ Preferred
if (isValid) return true;
```

### Imports

Group imports cleanly.

Use aliased paths (e.g., `@utils/`, `@structures/`) instead of relative paths (e.g., `../../`).

## 2. Strict Type Safety

### Zero Tolerance for `any`

Never use `as any` or `as unknown`. If a type is uncertain, use a User-Defined Type Guard.

```ts
// ❌ Avoid
const payload = data as any;

// ✅ Preferred
const isPayload = (data: unknown): data is Payload => typeof data === 'object' && data !== null && 'id' in data;

if (isPayload(data)) process(data);
```

### Explicit Equality Checks

NEVER use implicit boolean negation (`!value`) for existence checks. Logic must be explicit about what it is checking (`undefined`, `null`, `false`).

```ts
// ❌ Avoid
if (!handler) return;

// ✅ Preferred
if (handler === undefined) return;
```

## 3. Logic & Control Flow

### Guard Clauses ("Early Return")

Avoid nested if/else blocks. Handle failure conditions first and return early, keeping the "happy path" at the root indentation level.

```ts
// ❌ Avoid
const process = (user: User) => {
  if (user) {
    if (user.isActive) {
      save(user);
    }
  }
};

// ✅ Preferred
const process = (user: User | undefined) => {
  if (user === undefined) return;
  if (user.isActive === false) return;

  save(user);
};
```

### DRY (Don't Repeat Yourself)

Do not copy-paste logic. If a pattern repeats (e.g., iterating over middleware for different events), abstract it into a generic private execution method.

## 4. Documentation

- **JSDoc Only**: Use `/** ... */` for exported classes, interfaces, and public methods.
- **No Inline Comments**: Remove `//` comments explaining what the code does. The code should be readable enough to stand on its own.
- **No Dead Code**: Do not leave commented-out blocks or "TODO" comments in the codebase.

## 5. "The Gold Standard" Example

Reference this comparison when writing new modules.

### ❌ Bad Pattern

```ts
import { Logger } from '../../utils/logger';

export default class Manager {
  constructor() {}

  // Unnecessary brackets and implicit check
  public process(data: any) {
    if (!data) {
      return false;
    } else {
      // Logic here...
      return true;
    }
  }
}
```

### ✅ Good Pattern

```ts
import { Logger } from '@utils/logger';

const isValidData = (data: unknown): data is ValidData => typeof data === 'object' && data !== null;

export default class Manager {
  /**
   * Processes the incoming data payload.
   */
  public process = (data: unknown): boolean => {
    if (isValidData(data) === false) return false;

    // Logic here...
    return true;
  };
}
```
