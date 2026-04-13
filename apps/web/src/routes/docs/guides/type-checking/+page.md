
# Type Checking

rbxdev-ls includes a Luau type checker that validates your code against the Roblox API and your own type annotations. It catches type mismatches, undefined variables, and incorrect API usage before you run your code.

## Modes

Control the checker's strictness with a comment at the top of your file:

### Strict mode

```lua
--!strict
local part: BasePart = workspace.Baseplate
part.Anchored = true
part.Anchored = "yes"  -- Error: string is not assignable to boolean
```

Reports all type errors. Variables must have inferable or annotated types.

### Nonstrict mode

```lua
--!nonstrict
local x = getValue()  -- x is inferred as any, no error
x.foo()               -- No error, x is any
```

Type inference is active but unresolvable types default to `any`. This is the default mode.

### Nocheck mode

```lua
--!nocheck
-- No type diagnostics at all. Only parse errors are reported.
```

Useful for generated code or files you don't control.

## Changing the default

The global default is `nonstrict`. Change it in VS Code settings:

```json
{
  "rbxdev-ls.typeCheckMode": "strict"
}
```

Per-file directives always override the global setting.

## Ignore directives

Suppress diagnostics on specific lines or regions:

```lua
--@rbxls-ignore
local x = untypedFunction()  -- No diagnostic on this line

--@rbxls-disable
-- Everything below this point is unchecked
local a = foo()
local b = bar()
--@rbxls-enable
-- Diagnostics resume here
```

| Directive | Scope |
|-----------|-------|
| `--@rbxls-ignore` | Suppresses the next line |
| `--@rbxls-disable` | Suppresses from this point forward |
| `--@rbxls-enable` | Re-enables after a disable |

## Roblox API types

The type checker loads the complete Roblox API dump at startup. This means:

- All classes, their properties, methods, and events are typed
- Constructor types (`Instance.new`, `Vector3.new`, `CFrame.new`) are fully checked
- Enum values are validated (`Enum.Material.Neon` resolves correctly)
- Service return types from `game:GetService()` are narrowed automatically
