
# Luau Bundler

The Luau bundler combines multiple `.lua`/`.luau` source files into a single self-contained script. The output works with `loadstring()` in Roblox executors and anywhere else a single Lua file is needed.

## Usage in VS Code

Press `Ctrl+Alt+E` to bundle and execute the current project. The extension uses the bundler automatically.

On first use without a config file, you'll be prompted to set up:

- **Source directory** (default: `src`)
- **Output path** (default: `dist/out.lua`)
- **Entry module** (default: `init`)

This creates a `luau-bundler.config.json` in your workspace root.

## Configuration

Create `luau-bundler.config.json` in your project root:

```json
{
  "src": "src",
  "output": "dist/out.lua",
  "entry": "init"
}
```

| Field | Default | Purpose |
|-------|---------|---------|
| `src` | `src` | Directory containing your source files |
| `output` | `dist/out.lua` | Where the bundled file is written |
| `entry` | `init` | Module name to execute first (without extension) |

### Rojo project support

Point the bundler at a Rojo project file instead of a source directory:

```json
{
  "project": "default.project.json",
  "output": "dist/out.lua"
}
```

The bundler reads `tree.$path` from the project file and uses that as the source directory.

## CLI usage

Install globally or run via npx:

```bash
# Direct source directory
npx @oneshot101/luau-bundler --src src --out dist/out.lua

# From a Rojo project
npx @oneshot101/luau-bundler --project default.project.json --out dist/out.lua

# Custom entry point
npx @oneshot101/luau-bundler --src src --out dist/out.lua --entry main
```

## How it works

1. The bundler walks the source directory and collects all `.lua`/`.luau` files
2. Each file is wrapped in a module loader function
3. A `require()` shim is generated that caches module returns
4. Path aliases are created so `require("handlers/execute")` works without the extension
5. The entry module is called last, kicking off the program

Files using `init.luau` as their name can be required by their directory name (matching Rojo conventions).

## Module pattern

Write each source file as a standard Lua module:

```lua
-- handlers/execute.luau
local M = {}

M.handle = function(message, state, protocol)
    local ok, result = pcall(loadstring(message.code))
    protocol.sendResult('executeResult', message.id, ok, {
        result = ok and tostring(result) or nil,
        error = not ok and { message = result } or nil,
    })
end

return M
```

Then require it from your entry point:

```lua
-- init.luau
local execute = require("handlers/execute")

execute.handle(message, state, protocol)
```
