<div align="center">

<img src="https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/packages/vscode/icon.png" alt="rbxdev-ls logo" width="160">

<h1>@oneshot101/luau-bundler</h1>

<p>Small Luau/Lua bundler that turns a folder of modules into one self-contained script with a require shim</p>

<p>
  <a href="https://www.npmjs.com/package/@oneshot101/luau-bundler"><img src="https://img.shields.io/npm/v/@oneshot101/luau-bundler?style=flat-square" alt="npm"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square" alt="Node.js >= 18">
  <img src="https://img.shields.io/badge/language-Luau-blue?style=flat-square" alt="Luau">
  <a href="https://github.com/0neShot101/rbxdev-ls/blob/main/LICENSE"><img src="https://img.shields.io/github/license/0neShot101/rbxdev-ls?style=flat-square" alt="MIT License"></a>
</p>

</div>

---

## Overview

`@oneshot101/luau-bundler` bundles a directory of `.lua` and `.luau` modules into a single Lua file that can run through `loadstring()` or any environment that needs one pasted/executed script. It walks the source tree, wraps each module in a loader, generates compatible `require()` aliases, and emits one self-contained script that starts at an entry module.

The package is part of the [rbxdev-ls](https://github.com/0neShot101/rbxdev-ls) monorepo and is used by the Roblox executor bridge tooling to ship modular Luau source as one runtime script.

## Features

- **Single-file output** &mdash; Converts a folder of Luau/Lua modules into one script
- **Require shim** &mdash; Preserves module-style `require("path/to/module")` calls inside the bundle
- **Rojo project support** &mdash; Reads a `default.project.json` and uses `tree.$path` as the source directory
- **Deterministic builds** &mdash; Sorts discovered files before emitting output
- **Entry module control** &mdash; Starts from `init` by default, or any custom module name
- **Header support** &mdash; Prepends a generated comment header for provenance/versioning
- **CLI and API** &mdash; Use it from npm scripts or directly from Node/Bun tooling

## Table of Contents

- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [CLI](#cli)
- [JavaScript API](#javascript-api)
- [Module Resolution](#module-resolution)
- [Part of rbxdev-ls](#part-of-rbxdev-ls)
- [License](#license)

## Quick Start

Bundle a source folder into one Lua file:

```bash
npx -y @oneshot101/luau-bundler --src src --out dist/bundle.lua
```

Bundle from a Rojo project:

```bash
npx -y @oneshot101/luau-bundler --project default.project.json --out dist/bundle.lua
```

Use a custom entry module and header:

```bash
npx -y @oneshot101/luau-bundler --src src --out dist/bridge.lua --entry main --header "rbxdev executor bridge"
```

## How It Works

The bundler recursively collects every `.lua` and `.luau` file under the source directory. Each file is emitted into a `_modules` table as a lazy loader, then a local `require()` shim resolves module paths at runtime. The output ends by requiring the configured entry module and returning its value.

The generated `require()` first checks bundled modules. If a path is not bundled, it falls back to the original runtime `require` when available. That lets bundled code still use runtime-provided modules when the host environment supports them.

The final output is wrapped like this:

```lua
return (function(oldRequire, ...)
  -- bundled module registry and require shim
  return require("init")
end)(require or function() end, ...)
```

## Installation

### Prerequisites

- **Node.js &ge; 18** &mdash; `node --version` to verify
- Source files ending in `.lua` or `.luau`

### npx (recommended)

No installation required:

```bash
npx -y @oneshot101/luau-bundler --src src --out dist/bundle.lua
```

### Global install

If you prefer a persistent CLI:

```bash
npm install -g @oneshot101/luau-bundler
```

Then run:

```bash
luau-bundler --src src --out dist/bundle.lua
```

## CLI

```bash
luau-bundler --src <dir> --out <file> [--entry <name>] [--header <text>]
luau-bundler --project <rojo.project.json> --out <file> [--entry <name>] [--header <text>]
```

| Option      | Required | Default | Purpose                                                        |
| ----------- | -------- | ------- | -------------------------------------------------------------- |
| `--src`     | Yes*     | none    | Source directory containing `.lua` and `.luau` files           |
| `--project` | Yes*     | none    | Rojo project file; uses `tree.$path` as the source directory   |
| `--out`     | Yes      | none    | Output file path for the generated single-file bundle          |
| `--entry`   | No       | `init`  | Module name to require after all modules are registered        |
| `--header`  | No       | none    | Text emitted as leading Lua comments in the generated output   |

*Use either `--src` or `--project`.

## JavaScript API

```ts
import { bundle, resolveRojoProject } from "@oneshot101/luau-bundler";

const result = bundle({
  sourceDir: "src",
  entry: "init",
  header: "generated by luau-bundler",
});

console.log(result.output);
console.log(`${result.moduleCount} modules in ${result.elapsedMs.toFixed(1)}ms`);
```

### `bundle(options)`

| Option        | Type      | Default | Purpose                                                  |
| ------------- | --------- | ------- | -------------------------------------------------------- |
| `sourceDir`   | `string`  | none    | Directory to recursively scan for `.lua` and `.luau`     |
| `entry`       | `string`  | `init`  | Module name required at the end of the bundle            |
| `header`      | `string`  | none    | Comment header prepended to the output                   |
| `passVarargs` | `boolean` | `true`  | Whether top-level varargs are forwarded into modules     |

Returns:

| Field         | Type     | Description                         |
| ------------- | -------- | ----------------------------------- |
| `output`      | `string` | Bundled Lua source                  |
| `moduleCount` | `number` | Number of modules included          |
| `elapsedMs`   | `number` | Bundling time in milliseconds       |

### `resolveRojoProject(projectPath)`

Reads a Rojo project file and returns the resolved source directory from `tree.$path`:

```ts
const project = resolveRojoProject("default.project.json");
if (project) {
  console.log(project.name, project.sourceDir);
}
```

## Module Resolution

Each file gets aliases that match common Luau module paths:

| File path              | Valid require paths                                      |
| ---------------------- | -------------------------------------------------------- |
| `services/player.luau` | `services/player.luau`, `services/player`                |
| `controllers/init.lua` | `controllers/init.lua`, `controllers/init`, `controllers` |

Files are sorted before bundling so repeated builds produce stable output when the source files are unchanged.

## Part of rbxdev-ls

This bundler is one workspace in the [rbxdev-ls](https://github.com/0neShot101/rbxdev-ls) monorepo, which also includes:

- **packages/server** &mdash; The Roblox/Luau language server with type checking, completions, and diagnostics
- **packages/vscode** &mdash; The VS Code extension with Game Tree, Properties panel, Remote Spy, and code execution
- **packages/mcp** &mdash; The MCP server for connecting AI assistants to live Roblox game instances
- **packages/luau-bundler** &mdash; This package

## License

[MIT](../../LICENSE) &copy; Andrew
