# TypeScript Project Template

[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![ESLint](https://img.shields.io/badge/ESLint-4B3263?style=for-the-badge&logo=eslint&logoColor=white)](https://eslint.org)
[![Prettier](https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=black)](https://prettier.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> A modern TypeScript project template with Bun runtime, featuring an epic setup wizard and best practices out of the box.

## 🚀 Features

- **⚡ Bun Runtime** - Fast package management and bundling
- **🎯 TypeScript 5.0** - Full type safety with strict configuration
- **🎨 ESLint + Prettier** - Code quality and consistent formatting
- **📦 Zero Config** - Works out of the box with sensible defaults
- **🧙‍♂️ Setup Wizard** - Interactive project initialization with random memes
- **🔧 VS Code Ready** - Optimized settings and extension recommendations

## 🎭 Quick Start

1. **Use this template:**

2. **Run the setup wizard:**

   ```bash
   bun run setup
   ```

3. **Start developing:**
   ```bash
   bun run dev
   ```

The setup wizard will:

- Configure your project name and description
- Set up your author information (from git config)
- Generate a clean `src/index.ts` entry point
- Create a project-specific README
- Format everything with Prettier
- Clean up after itself

## 📋 Available Scripts

| Script                 | Description                      |
| ---------------------- | -------------------------------- |
| `bun run setup`        | Run the interactive setup wizard |
| `bun run dev`          | Development with hot reload      |
| `bun run build`        | Build for production             |
| `bun start`            | Run the built application        |
| `bun run lint`         | Lint and fix code                |
| `bun run lint:check`   | Check for linting errors         |
| `bun run format`       | Format code with Prettier        |
| `bun run format:check` | Check code formatting            |
| `bun run type-check`   | TypeScript type checking         |

## 🏗️ Project Structure

```
├── src/
│   └── index.ts          # Main entry point
├── .eslintrc.cjs         # ESLint configuration
├── .prettierrc           # Prettier configuration
├── .gitattributes        # Git line ending enforcement
├── .gitignore            # Git ignore rules
├── .editorconfig         # Editor configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── setup.ts              # Epic setup wizard (self-deleting)
```

## ⚙️ Configuration

### TypeScript

- Strict type checking enabled
- Modern ES2022 target
- Path aliases support ready
- Declaration files generated

### ESLint

- TypeScript-specific rules
- Import organization
- Prettier integration
- Custom rule preferences

### Prettier

- LF line endings enforced
- Consistent code formatting
- Works with ESLint

### VS Code

- Auto-format on save
- Extension recommendations
- Workspace settings included

## 🎨 Code Style

This template enforces:

- **Arrow functions** preferred over function declarations
- **const/let** over var (prefer const when possible)
- **Import organization** with automatic sorting
- **LF line endings** across all platforms
- **No trailing semicolons** (handled by Prettier)
- **Consistent quotes** and spacing

## 🛠️ Built With

- [Bun](https://bun.sh) - Fast JavaScript runtime and package manager
- [TypeScript](https://typescriptlang.org) - Type-safe JavaScript
- [ESLint](https://eslint.org) - Code quality and consistency
- [Prettier](https://prettier.io) - Code formatting

## 📝 License

MIT - see [LICENSE](LICENSE) for details.

## 💡 Why This Template?

- **Modern Stack**: Bun + TypeScript for maximum performance and type safety
- **Developer Experience**: Everything configured for a smooth development workflow
- **Best Practices**: Follows current TypeScript and Node.js best practices
- **Fun Setup**: Because setting up projects should be enjoyable, not boring
- **Zero Bloat**: Only includes what you actually need

---
