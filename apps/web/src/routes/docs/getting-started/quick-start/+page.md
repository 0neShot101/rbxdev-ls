
# Quick Start

## 1. Install the extension

Open VS Code and install `rbxdev-ls` from the extensions panel, or run:

```
ext install rbxdev.rbxdev-ls
```

## 2. Open a Luau project

Open any folder containing `.lua` or `.luau` files. The language server starts automatically and begins providing completions, type checking, and diagnostics.

## 3. Write some code

```lua
--!strict

local Players = game:GetService("Players")
local localPlayer = Players.LocalPlayer
local character = localPlayer.Character or localPlayer.CharacterAdded:Wait()

local humanoid = character:FindFirstChildOfClass("Humanoid")
if humanoid then
    humanoid.WalkSpeed = 24
end
```

You should immediately see:

- **Completions** for `game:GetService`, player properties, and humanoid members
- **Type checking** that validates your code against the Roblox API
- **Hover docs** showing parameter types and descriptions for every API member

## 4. Connect to a live game (optional)

To enable live game features like the Game Tree, Properties panel, and code execution, you need to set up the [Executor Bridge](/docs/guides/executor-bridge). This is optional and only needed for runtime interaction.

## Type checking modes

Control how strict the type checker is with a comment at the top of your file:

| Directive | Behavior |
|-----------|----------|
| `--!strict` | Full type checking, all errors reported |
| `--!nonstrict` | Type inference enabled, some errors relaxed |
| `--!nocheck` | Parsing only, no type diagnostics |

The default mode is `nonstrict`. You can change it globally with the `rbxdev-ls.typeCheckMode` setting.
