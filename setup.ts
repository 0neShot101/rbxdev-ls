import { constants } from 'node:fs';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { $ } from 'bun';

const colors = {
  'reset': '\x1b[0m',
  'bright': '\x1b[1m',
  'red': '\x1b[31m',
  'green': '\x1b[32m',
  'yellow': '\x1b[33m',
  'magenta': '\x1b[35m',
  'cyan': '\x1b[36m',
  'white': '\x1b[37m',
} as const;

const c = (color: keyof typeof colors, text: string) => `${colors[color]}${text}${colors.reset}`;

const rl = createInterface({ input, output });

const slogans = [
  'Another happy little accident',
  'This code is sponsored by monstor energy',
  'Built different (and probably broken)',
  'Copying from Stack Overflow since 2008',
  'TODO: fix this later (narrator: they never did)',
  'If it compiles, it ships',
  'JavaScript was a mistake',
  'Tabs > spaces (fight me)',
  'Semicolons are for quitters',
  'npm install depression --save-dev',
  "It ain't much but it's honest work",
  'Ctrl+Z is basically time travel',
  'console.log("why doesn\'t this work")',
  'TypeScript > your feelings',
  'Still waiting for my code to compile...',
  'git push origin master && pray',
  'Friday deployments hit different',
  'Stack Overflow raised me',
  'Tabs gang rise up',
  'It works on localhost tho',
  'Sleep is for the weak (and QA)',
  'Error messages are just suggestions',
];

const getRandomSlogan = () => slogans[Math.floor(Math.random() * slogans.length)];

const boxInner = '                                                                              ';

const centeredLine = (text: string, style: keyof typeof colors) => {
  const maxWidth = boxInner.length;
  const t = text.length > maxWidth ? text.slice(0, maxWidth) : text;
  const totalPadding = maxWidth - t.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  const left = ' '.repeat(leftPadding);
  const right = ' '.repeat(rightPadding);

  return c('cyan', '║' + left) + c(style, t) + c('cyan', right + '║');
};

const greenCenteredLine = (text: string, style: keyof typeof colors) => {
  const maxWidth = boxInner.length;
  const t = text.length > maxWidth ? text.slice(0, maxWidth) : text;
  const totalPadding = maxWidth - t.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  const left = ' '.repeat(leftPadding);
  const right = ' '.repeat(rightPadding);

  return c('green', '║' + left) + c(style, t) + c('green', right + '║');
};

const emptyLine = (borderColor: keyof typeof colors = 'cyan') => c(borderColor, '║' + boxInner + '║');

const banner = () => {
  const randomSlogan = getRandomSlogan();

  console.log(c('cyan', '╔══════════════════════════════════════════════════════════════════════════════╗'));
  console.log(emptyLine());
  console.log(centeredLine('Typescript Project Template', 'bright'));
  console.log(emptyLine());
  console.log(centeredLine(randomSlogan, 'white'));
  console.log(emptyLine());
  console.log(c('cyan', '╚══════════════════════════════════════════════════════════════════════════════╝'));
};

const clearLine = () => {
  const stdout = process.stdout as typeof process.stdout & {
    clearLine?: (direction: number) => void;
    cursorTo?: (x: number) => void;
  };

  if (typeof stdout.clearLine === 'function') stdout.clearLine(0);
  else process.stdout.write('\r');

  if (typeof stdout.cursorTo === 'function') stdout.cursorTo(0);
  else process.stdout.write('\r');
};

const withSpinner = async <T>(text: string, fn: () => Promise<T>) => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;

  const render = () => {
    clearLine();
    process.stdout.write(`${c('cyan', frames[i++ % frames.length])} ${text}`);
  };

  render();

  const id = setInterval(render, 80);

  try {
    const result = await fn();
    clearInterval(id);
    clearLine();

    process.stdout.write(`${c('green', '✅')} ${text}\n`);

    return result;
  } catch (err) {
    clearInterval(id);
    clearLine();

    process.stdout.write(`${c('red', '❌')} ${text}\n`);

    throw err;
  }
};

const ask = async (q: string) => (await rl.question(c('yellow', `❓ ${q}: `))).trim();

const exists = async (p: string) => {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const slugifyName = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

type PkgJson = {
  name?: string;
  description?: string;
  author?: string;
  [k: string]: unknown;
};

const readJSON = async <T extends Record<string, unknown>>(path: string, fallback: T) => {
  try {
    const txt = await Bun.file(path).text();
    const parsed = JSON.parse(txt);

    return typeof parsed === 'object' && parsed !== null ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
};

const getGit = async (key: string) => {
  const scopes = [['--local'], ['--global']];

  for (const scope of scopes) {
    try {
      const out = await $`git config ${scope} ${key}`.text();
      const v = out.trim();

      if (v) return v;
    } catch {
      // Git config not found for this scope, try next
    }
  }

  return '';
};

const setup = async () => {
  banner();

  console.log(c('magenta', `🚀 Let's set up your project!`));

  const cwdName = basename(process.cwd());
  const projectNameInput = await ask(`What's the name of your project? [${cwdName}]`);
  const projectName = projectNameInput || cwdName;

  const description = await ask('Give it a short description (optional, press Enter to skip)');

  let author = '';
  try {
    const name = await getGit('user.name');
    const email = await getGit('user.email');

    if (name) author = email ? `${name} <${email}>` : name;
    if (author) console.log(c('green', `🎭 Found git user: ${author}`));
  } catch {
    // Git not available or configured
  }

  if (!author) author = await ask("Who's the author?");

  console.log(c('cyan', `\n📋 Project: ${c('bright', projectName)}`));
  if (description) console.log(c('cyan', `📝 ${description}`));
  console.log(c('cyan', `👤 Author: ${c('bright', author)}`));

  const confirm = await ask('\n🤔 Does this look good? (y/N)');

  if (!/^y(es)?$/i.test(confirm)) {
    console.log(c('yellow', "👋 No worries! Run the setup again when you're ready."));

    await rl.close();

    process.exit(0);
  }

  console.log(c('green', "\n� Alright, let's get this thing built!\n"));

  await withSpinner('📦 Updating package.json with your project info', async () => {
    const pkg = await readJSON<PkgJson>('package.json', {});

    pkg.name = slugifyName(projectName);
    pkg.description = description || 'A TypeScript project built with Bun';
    pkg.author = author;

    const text = `${JSON.stringify(pkg, null, 2)}\n`;

    await writeFile('package.json', text);
  });
  await withSpinner('🎯 Creating your epic entry point', async () => {
    if (!(await exists('src'))) await mkdir('src', { 'recursive': true });

    const indexContent =
      `/*\n` +
      ` ${projectName}\n` +
      ` ${description ? description : 'A TypeScript project built with Bun'}\n` +
      ` Author: ${author}\n` +
      ` Created: ${new Date().toLocaleDateString()}\n` +
      `*/\n\n` +
      `console.log('Welcome to ${projectName}!');\n` +
      `console.log('Built with Bun + TypeScript + ESLint + Prettier');\n\n` +
      `const main = (): void => {\n` +
      `  console.log('Hello from your new TypeScript project.');\n` +
      `  console.log('Edit src/index.ts to start building.');\n` +
      `};\n\n` +
      `main();\n`;

    await writeFile('src/index.ts', indexContent);
  });
  await withSpinner('📚 Creating a README', async () => {
    const readme =
      `# ${projectName}\n\n` +
      `${description ? `${description}\n\n` : ''}` +
      `Built with the TypeScript Project Wizard.\n\n` +
      `## Quick Start\n\n` +
      `\\\`\\\`\\\`bash\n` +
      `bun install\n` +
      `bun run dev\n` +
      `bun run build\n` +
      `bun start\n` +
      `\\\`\\\`\\\`\n\n` +
      `## Available Scripts\n\n` +
      `- \`bun run dev\` - Development with hot reload\n` +
      `- \`bun run build\` - Build for production\n` +
      `- \`bun start\` - Run the built application\n` +
      `- \`bun run lint\` - Lint and fix code\n` +
      `- \`bun run format\` - Format code with Prettier\n` +
      `- \`bun run type-check\` - TypeScript type checking\n\n` +
      `## Code Style\n\n` +
      `This project uses:\n` +
      `- ESLint for code quality\n` +
      `- Prettier for formatting (LF line endings enforced)\n` +
      `- Strict TypeScript configuration\n` +
      `- Path aliases for clean imports\n\n` +
      `## Project Structure\n\n` +
      `\\\`\\\`\\\`\n` +
      `src/\n` +
      `└── index.ts\n` +
      `\\\`\\\`\\\`\n\n` +
      `## Built With\n\n` +
      `- [Bun](https://bun.sh)\n` +
      `- [TypeScript](https://typescriptlang.org)\n` +
      `- [ESLint](https://eslint.org)\n` +
      `- [Prettier](https://prettier.io)\n\n` +
      `${author ? `Created by ${author}\n` : ''}`;

    await writeFile('README.md', readme);
  });
  await withSpinner('🎨 Formatting files', async () => {
    await $`bun run format`.quiet();
  });
  await withSpinner("🗑️ Cleaning up setup script (it's done its job!)", async () => {
    if (await exists('setup.ts')) await unlink('setup.ts');
  });

  console.log(c('green', '╔══════════════════════════════════════════════════════════════════════════════╗'));
  console.log(emptyLine('green'));
  console.log(greenCenteredLine('🎉 Project created successfully! 🎉', 'yellow'));
  console.log(emptyLine('green'));
  console.log(greenCenteredLine("What's next?", 'white'));
  console.log(greenCenteredLine('→ bun run dev (start developing)', 'cyan'));
  console.log(greenCenteredLine('→ bun run build (production build)', 'cyan'));
  console.log(greenCenteredLine('→ Edit src/index.ts (make it yours)', 'cyan'));
  console.log(emptyLine('green'));
  console.log(greenCenteredLine('Happy coding! 🚀', 'magenta'));
  console.log(emptyLine('green'));
  console.log(c('green', '╚══════════════════════════════════════════════════════════════════════════════╝'));

  await rl.close();

  process.exit(0);
};

setup().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';

  console.error(c('red', `\n❌ Setup failed: ${message}`));

  await rl.close();

  process.exit(1);
});
