# Changelog

All notable changes to the Roblox Luau Language Server extension will be documented in this file.

## [0.2.9] - 2026-02-16

### Added

- Comprehensive test suite — 685 tests across 19 files covering parser, type checker, LSP handlers, MCP server, doc comments, subtyping, and more
- MCP server test coverage — 52 tests for all pure functions, tool definitions, bridge creation, and game tree model
- VSIX build pipeline script (`bun run build:vsix`) — runs tests, type-checks, builds server + extension, and packages VSIX in one command
- Auto version bumping — build script bumps patch by default, supports `major`/`minor`/`patch` argument and syncs both package.json files
- Remote spy keybindings — `Ctrl+Shift+R` copy last remote call, `Ctrl+Shift+Alt+R` insert at cursor, `Ctrl+Alt+C` quick copy
- Bundle & Execute mode — `Ctrl+Alt+E` to bundle and execute Luau files with `luau-bundle`
- Ignore directives — `@rbxls-ignore`, `@rbxls-ignore-line`, `@rbxls-disable`/`@rbxls-enable` to suppress diagnostics
- Code actions — quick fixes for undefined variables, missing requires, and type mismatches

### Changed

- Major codebase refactor — all source files cleaned up with consistent arrow functions, explicit equality checks, and path aliases
- Improved formatter — better handling of table literals, method chains, and multiline expressions
- Type checker improvements — better narrowing, subtyping, and diagnostic messages

### Fixed

- Game tree no longer merges siblings with the same name into one entry (index-based path disambiguation)
- Bridge script reconnects automatically after VS Code restart (retry on failed connect)
- Re-executing the bridge script no longer causes old/new scripts to compete (unique bridge ID per execution)
- Code formatting preserves semantic meaning in all edge cases
- Semantic tokens correctly handle complex nested expressions
- Completion handler no longer suggests duplicate items

## [0.2.7] - 2026-02-15

### Fixed

- Bridge script no longer floods VS Code with redundant game tree updates (removed auto DescendantAdded/Removing listeners)
- Re-executing the bridge script now properly replaces the old connection instead of being rejected
- Log hooks no longer double-wrap on bridge script re-execution
- Bridge script cleanup on re-execution (closes old WebSocket, disconnects old listeners)

## [0.2.6] - 2026-02-15

### Fixed

- Extension failing to activate due to missing dependencies in VSIX package

## [0.2.5] - 2026-02-15

### Added

- Select "Bundle & Execute in Roblox" from the play button dropdown to enable bundle mode
- `Ctrl+Shift+E` respects the selected mode (normal execute or bundle+execute)
- Status bar reflects current mode (`$(play)` or `$(package)`)
- Auto-downloads `luau-bundle.exe` on first use, cached for future sessions
- Reads `luau-bundle.config.json` from workspace root for output path
- `rbxdev-ls.bundler.path` setting to override the bundler executable path
- `Ctrl+Alt+E` keybinding for Bundle & Execute

### Fixed

- Remote spy now generates copyable Lua code for all argument types
- Game tree shows all game children, not just hardcoded services
- Shallow tree updates no longer replace deep tree data (smart merge)
- Properties panel timeout increased to 5 seconds for reliable loading
- Duplicate execute button removed from editor title bar

## [0.2.4] - 2026-02-14

### Fixed

- Executor name now displays correctly in status bar (was showing "Roblox: Connected" instead of executor name)
- Connection timeout caused by build script crash when MCP server wasn't built
- Build script gracefully skips missing `mcp.js` instead of crashing

## [0.2.3] - 2026-02-14

### Added

- Comprehensive documentation for all built-in functions visible on hover
  - Lua/Luau globals: `print`, `warn`, `error`, `assert`, `type`, `typeof`, `tostring`, `tonumber`, `pcall`, `xpcall`, `select`, `pairs`, `ipairs`, `next`, `unpack`, `rawget`, `rawset`, `rawequal`, `rawlen`, `setmetatable`, `getmetatable`, `require`
  - Standard libraries: `math`, `string`, `table`, `coroutine`, `bit32`, `utf8`, `os`, `buffer`, `task`, `debug`
  - Roblox data type methods: `Vector3`, `Vector2`, `CFrame`, `Color3`, `UDim2`, `BrickColor`, `DateTime`, `Random`, `RBXScriptSignal`
  - All Roblox constructors: `Vector3.new`, `CFrame.Angles`, `Color3.fromRGB`, `UDim2.fromOffset`, `TweenInfo.new`, etc.
  - Roblox legacy globals: `wait`, `delay`, `spawn`, `tick`, `time`, `loadstring`
  - Native vector library: `vector.create`, `vector.dot`, `vector.cross`, `vector.normalize`, etc.
- Type cast field validation in strict mode — `{x = 0} :: {x: string}` now reports field type mismatch

### Fixed

- Multi-return type checking no longer creates false union of all return values
- `or` expressions correctly narrow away nil (`x or default` where x is `T?` produces `T | typeof(default)`)
- Guard clause narrowing — after `if x == nil then return end`, `x` is narrowed to non-nil
- Assignment to narrowed variables uses declared type instead of narrowed type
- Parser handles nested array types and optional table types correctly

## [0.2.2] - 2026-02-13

### Added

- Variable tracking through assignment chains — `local RS = game:GetService'ReplicatedStorage'; local folder = RS.Models; folder.` now resolves live game children
- Live game tree completions for variables assigned from any service (Workspace, ReplicatedStorage, CoreGui, Players, etc.)
- Module `require()` completions from executor bridge with full metatable chain walking
- Local file `require("./")` completions with icons, export details, and documentation
- Missing return type diagnostic for functions with declared return types that don't return
- Custom file icons for `.lua` and `.luau` files
- Support for type annotations on variable declarations in all completion patterns

### Fixed

- Literal types now assignable to base types (`{x: 1}` assignable to `{x: number}`)
- Arithmetic operators work with number literal union types (`10 | 20 | 30`)
- Mixed table types with indexers parse correctly (`{name: string, [number]: boolean}`)
- `{string}` array type shorthand parses without errors
- Hover shows proper type info instead of empty tables (`names: {string}` not `names: { }`)
- `type` keyword in type alias declarations no longer shows global `type()` function hover
- Document symbols `selectionRange must be contained in fullRange` error
- Metamethods (`__index`, etc.) filtered from module completions
- Type checking now runs even with parse errors for better completions

## [0.2.1] - 2026-02-06

### Added

- MCP server for AI assistant integration (GitHub Copilot, Claude, etc.)
- Copilot language model tools for game tree, properties, execution, and script decompilation

## [0.1.3] - 2026-02-03

### Fixed

- Full game tree now loads on first connect for complete autocomplete
- Auto-updates no longer overwrite deep tree with shallow data

### Changed

- `firstConnectDepth = 999` - Full tree dump on connect
- `updateTreeDepth = 2` - Shallow updates for performance
- Disabled automatic tree updates (use refresh button instead)

## [0.1.2] - 2026-02-03

### Fixed

- Live completions now work with deeper game tree paths
- Lazy-loaded children are now merged into completion model

### Added

- Configurable bridge options via loadstring args
- Increased default tree depth from 2 to 5 levels

## [0.1.1] - 2026-02-03

### Added

- Documentation for executor bridge setup

## [0.1.0] - 2026-02-03

### Added

- Initial release
- Full Roblox API completions and type checking
- Luau language support with type annotations
- Live game tree explorer with lazy loading
- Properties panel with inline editing
- Code execution via executor bridge
- Custom icons for 80+ Roblox class types
- Drag and drop instance reparenting
- Teleport to instance feature
- Context menu actions (copy path, insert path, delete)
- Semantic token highlighting
- Go to definition and find references
- Document symbols and outline view
- Signature help and hover documentation
- Color picker for Color3 properties
- Enum dropdowns for EnumItem properties
