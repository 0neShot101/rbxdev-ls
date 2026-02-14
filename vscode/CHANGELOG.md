# Changelog

All notable changes to the Roblox Luau Language Server extension will be documented in this file.

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
