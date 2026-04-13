
# Keybindings

## Code Execution

| Command | Keybinding | Description |
|---------|------------|-------------|
| Execute in Roblox | `Ctrl+Shift+E` | Execute the current file in the game |
| Execute Selection | `Ctrl+Shift+Alt+E` | Execute only the selected code |
| Bundle and Execute | `Ctrl+Alt+E` | Bundle the project with luau-bundler and execute the output |

## Remote Spy

| Command | Keybinding | Description |
|---------|------------|-------------|
| Copy Last Remote | `Ctrl+Shift+R` | Copy the last captured remote call to clipboard |
| Insert Last Remote | `Ctrl+Shift+Alt+R` | Insert the last remote call at the cursor position |
| Quick Copy Remote | `Ctrl+Alt+C` | Quick copy the most recent remote call |

## Game Tree

Right-click any instance in the Game Tree panel for context actions:

| Action | Description |
|--------|-------------|
| Copy Instance Path | Copy the full Luau path (e.g., `game.Workspace.Model`) |
| Insert Path at Cursor | Insert the path into your active editor |
| Insert GetService | Insert a `game:GetService()` call (for services) |
| Teleport To | Move your character to the instance |
| Delete Instance | Remove the instance from the game |
| Clone Instance | Duplicate the instance as a sibling |
| Create Instance | Create a child instance of a given class |
| View Script Source | Decompile and open the script's source |
| Save Instance | Save the instance to disk as .rbxm |

Drag and drop instances in the tree to reparent them.
