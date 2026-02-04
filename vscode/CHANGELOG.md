# Changelog

All notable changes to the Roblox Luau Language Server extension will be documented in this file.

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
