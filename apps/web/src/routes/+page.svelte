<script lang="ts">
	import Particles from '$lib/components/Particles.svelte';

	let copied = $state(false);

	const copyInstall = () => {
		navigator.clipboard.writeText('ext install rbxdev.rbxdev-ls');
		copied = true;
		setTimeout(() => (copied = false), 2000);
	};
</script>

<Particles />

<!-- Nav -->
<nav class="fixed top-0 z-50 w-full border-b border-white/5 bg-surface-base/80 backdrop-blur-xl">
	<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
		<div class="flex items-center gap-3">
			<img src="https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/packages/vscode/icon.png" alt="rbxdev-ls" class="h-8 w-8" />
			<span class="text-lg font-semibold text-text-primary">rbxdev-ls</span>
		</div>
		<div class="hidden items-center gap-8 text-sm text-text-secondary md:flex">
			<a href="#features" class="transition-colors hover:text-text-primary">Features</a>
			<a href="#bridge" class="transition-colors hover:text-text-primary">Bridge</a>
			<a href="#mcp" class="transition-colors hover:text-text-primary">MCP</a>
			<a href="/docs" class="transition-colors hover:text-text-primary">Docs</a>
			<a href="https://github.com/0neShot101/rbxdev-ls" class="transition-colors hover:text-text-primary">GitHub</a>
		</div>
		<a
			href="https://marketplace.visualstudio.com/items?itemName=rbxdev.rbxdev-ls"
			class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-brand-400 hover:scale-[1.02]"
		>
			Install
		</a>
	</div>
</nav>

<!-- Hero -->
<section class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16">
	<div class="pointer-events-none absolute top-1/3 -translate-y-1/2">
		<div class="h-125 w-125 rounded-full bg-brand-600/4 blur-[150px]"></div>
	</div>

	<div class="relative z-10 mx-auto max-w-4xl text-center">
		<div class="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/5 px-4 py-1.5 text-sm text-brand-300">
			<span class="h-1.5 w-1.5 rounded-full bg-brand-400"></span>
			v0.4.0 now available
		</div>

		<h1 class="mb-6 text-5xl font-extrabold leading-[1.1] tracking-tight text-text-primary md:text-6xl lg:text-7xl">
			The Luau language server<br />
			<span class="bg-linear-to-r from-brand-400 to-accent-400 bg-clip-text text-transparent">
				for Roblox
			</span>
		</h1>

		<p class="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-text-secondary md:text-xl">
			Type checking, intelligent completions, and live game tooling. Write Luau with full
			Roblox API support, execute code in-game, and connect AI assistants to your running game.
		</p>

		<button
			onclick={copyInstall}
			class="group mx-auto mb-8 flex max-w-lg items-center gap-3 rounded-xl border border-code-border bg-code-bg px-5 py-3.5 text-left font-mono text-sm transition-colors hover:border-brand-500/30"
		>
			<span class="text-text-muted">$</span>
			<span class="text-text-secondary">ext install</span>
			<span class="text-brand-300">rbxdev.rbxdev-ls</span>
			<span class="ml-auto text-xs text-text-muted transition-colors group-hover:text-text-tertiary">
				{copied ? 'copied!' : 'click to copy'}
			</span>
		</button>

		<div class="flex items-center justify-center gap-4">
			<a
				href="https://marketplace.visualstudio.com/items?itemName=rbxdev.rbxdev-ls"
				class="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-400 hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-500/20"
			>
				VS Code Marketplace
			</a>
			<a
				href="https://open-vsx.org/extension/rbxdev/rbxdev-ls"
				class="rounded-xl border border-surface-highest bg-surface-raised px-6 py-3 text-sm font-semibold text-text-secondary transition-all hover:border-brand-500/20 hover:text-text-primary"
			>
				Open VSX
			</a>
		</div>
	</div>

</section>

<!-- Features -->
<section id="features" class="relative px-6 py-32">
	<div class="mx-auto max-w-6xl">
		<div class="mb-16 text-center">
			<h2 class="mb-4 text-3xl font-bold text-text-primary md:text-4xl">
				Everything you need to write Luau
			</h2>
			<p class="mx-auto max-w-2xl text-lg text-text-secondary">
				30+ LSP handlers, full Roblox API coverage, and a type checker that catches
				bugs before you hit Play.
			</p>
		</div>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each features as feature}
				<div class="group rounded-2xl border border-surface-highest bg-surface-raised p-6 transition-all hover:border-brand-500/15 hover:bg-surface-overlay">
					<div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
						{@html feature.icon}
					</div>
					<h3 class="mb-2 text-base font-semibold text-text-primary">{feature.title}</h3>
					<p class="text-sm leading-relaxed text-text-tertiary">{feature.description}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Live Game -->
<section id="bridge" class="relative px-6 py-32">
	<div class="mx-auto max-w-6xl">
		<div class="grid items-center gap-16 lg:grid-cols-2">
			<div>
				<div class="mb-4 inline-flex items-center gap-2 rounded-full border border-accent-500/20 bg-accent-500/5 px-3 py-1 text-xs font-medium text-accent-400">
					Live connection
				</div>
				<h2 class="mb-6 text-3xl font-bold text-text-primary md:text-4xl">
					Your game, inside VS Code
				</h2>
				<p class="mb-8 text-lg leading-relaxed text-text-secondary">
					Browse the live instance tree, edit properties, execute code, and monitor remote calls
					without leaving your editor. The executor bridge connects over WebSocket and streams
					game state in real time.
				</p>
				<div class="space-y-4">
					{#each liveFeatures as item}
						<div class="flex items-start gap-3">
							<div class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400"></div>
							<p class="text-sm text-text-secondary">{item}</p>
						</div>
					{/each}
				</div>
			</div>

			<div class="rounded-2xl border border-code-border bg-code-bg p-1">
				<div class="flex items-center gap-2 border-b border-code-border px-4 py-3">
					<div class="h-3 w-3 rounded-full bg-surface-highest"></div>
					<div class="h-3 w-3 rounded-full bg-surface-highest"></div>
					<div class="h-3 w-3 rounded-full bg-surface-highest"></div>
					<span class="ml-2 text-xs text-text-muted">auto-execute.lua</span>
				</div>
				<pre class="overflow-x-auto p-5 text-sm leading-relaxed"><code class="text-text-secondary whitespace-nowrap"><span class="text-brand-300">loadstring</span><span class="text-text-muted">(</span><span class="text-accent-400">game</span><span class="text-text-muted">:</span><span class="text-brand-300">HttpGetAsync</span><span class="text-text-muted">(</span><span class="text-green-400">'https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/scripts/executor-bridge.lua'</span><span class="text-text-muted">))()</span></code></pre>
			</div>
		</div>
	</div>
</section>

<!-- MCP -->
<section id="mcp" class="relative px-6 py-32">
	<div class="mx-auto max-w-6xl">
		<div class="grid items-center gap-16 lg:grid-cols-2">
			<div class="order-2 lg:order-1">
				<div class="rounded-2xl border border-code-border bg-code-bg p-1">
					<div class="flex items-center gap-2 border-b border-code-border px-4 py-3">
						<div class="h-3 w-3 rounded-full bg-surface-highest"></div>
						<div class="h-3 w-3 rounded-full bg-surface-highest"></div>
						<div class="h-3 w-3 rounded-full bg-surface-highest"></div>
						<span class="ml-2 text-xs text-text-muted">mcp_config.json</span>
					</div>
					<pre class="overflow-x-auto p-5 text-sm leading-relaxed"><code class="text-text-secondary"><span class="text-text-muted">&#123;</span>
  <span class="text-brand-300">"mcpServers"</span><span class="text-text-muted">: &#123;</span>
    <span class="text-brand-300">"rbxdev-roblox"</span><span class="text-text-muted">: &#123;</span>
      <span class="text-accent-400">"command"</span><span class="text-text-muted">:</span> <span class="text-green-400">"npx"</span><span class="text-text-muted">,</span>
      <span class="text-accent-400">"args"</span><span class="text-text-muted">:</span> <span class="text-text-muted">[</span><span class="text-green-400">"-y"</span><span class="text-text-muted">,</span> <span class="text-green-400">"@0neshot101/rbxdev-mcp"</span><span class="text-text-muted">]</span>
    <span class="text-text-muted">&#125;</span>
  <span class="text-text-muted">&#125;</span>
<span class="text-text-muted">&#125;</span></code></pre>
				</div>
			</div>

			<div class="order-1 lg:order-2">
				<div class="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/5 px-3 py-1 text-xs font-medium text-brand-300">
					AI integration
				</div>
				<h2 class="mb-6 text-3xl font-bold text-text-primary md:text-4xl">
					Let AI work with your game
				</h2>
				<p class="mb-8 text-lg leading-relaxed text-text-secondary">
					The MCP server exposes 16 tools that let Claude, Cursor, and Windsurf interact with
					your running Roblox game. Browse instances, execute code, read properties, and monitor
					remote traffic through natural language.
				</p>
				<div class="space-y-4">
					{#each mcpFeatures as item}
						<div class="flex items-start gap-3">
							<div class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400"></div>
							<p class="text-sm text-text-secondary">{item}</p>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</section>

<!-- CTA -->
<section class="relative px-6 py-32">
	<div class="mx-auto max-w-3xl text-center">
		<h2 class="mb-6 text-3xl font-bold text-text-primary md:text-4xl">
			Start building
		</h2>
		<p class="mb-10 text-lg text-text-secondary">
			Install the extension. Open a Luau file. That's it.
		</p>
		<div class="flex items-center justify-center gap-4">
			<a
				href="https://marketplace.visualstudio.com/items?itemName=rbxdev.rbxdev-ls"
				class="rounded-xl bg-brand-500 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-brand-400 hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-500/20"
			>
				Install for VS Code
			</a>
			<a
				href="https://github.com/0neShot101/rbxdev-ls"
				class="rounded-xl border border-surface-highest bg-surface-raised px-8 py-3.5 text-sm font-semibold text-text-secondary transition-all hover:border-brand-500/20 hover:text-text-primary"
			>
				View on GitHub
			</a>
		</div>
	</div>
</section>

<!-- Footer -->
<footer class="border-t border-white/5 px-6 py-12">
	<div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-text-muted md:flex-row">
		<div class="flex items-center gap-2">
			<img src="https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/packages/vscode/icon.png" alt="" class="h-5 w-5 opacity-50" />
			<span>rbxdev-ls</span>
		</div>
		<div class="flex gap-6">
			<a href="https://github.com/0neShot101/rbxdev-ls" class="transition-colors hover:text-text-tertiary">GitHub</a>
			<a href="https://marketplace.visualstudio.com/items?itemName=rbxdev.rbxdev-ls" class="transition-colors hover:text-text-tertiary">Marketplace</a>
			<a href="https://github.com/0neShot101/rbxdev-ls/issues" class="transition-colors hover:text-text-tertiary">Issues</a>
		</div>
		<span>MIT License</span>
	</div>
</footer>

<script lang="ts" module>
	const features = [
		{
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>',
			title: 'Roblox API Completions',
			description: 'Every class, method, property, and enum from the official API dump with inline documentation.'
		},
		{
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>',
			title: 'Luau Type Checking',
			description: 'Catch type mismatches before runtime. Supports strict, nonstrict, and nocheck modes.'
		},
		{
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
			title: 'Go to Definition',
			description: 'Navigate to module definitions, function declarations, and variable assignments across files.'
		},
		{
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
			title: 'Rename & Refactor',
			description: 'Safely rename symbols across your workspace. Quick fixes for undefined variables and missing requires.'
		},
		{
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
			title: 'Auto Import',
			description: 'Automatically insert require statements when completing exports from workspace modules.'
		},
		{
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
			title: 'Rojo & Sourcemap',
			description: 'Cross-file module resolution through Rojo projects and sourcemap.json. Hot-reloads on changes.'
		},
		{
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/></svg>',
			title: 'Semantic Tokens',
			description: 'Enhanced syntax highlighting that distinguishes services, classes, types, enums, and parameters.'
		},
		{
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>',
			title: 'Formatting',
			description: 'Built-in Luau formatter with StyLua integration. Format on save or on demand.'
		},
		{
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>',
			title: 'AI Tools',
			description: '16 language model tools for GitHub Copilot. Standalone MCP server for Claude and Cursor.'
		},
	];

	const liveFeatures = [
		'Game Tree explorer mirroring the live instance hierarchy',
		'Properties panel with real-time editing (Vector3, Color3, CFrame, UDim2)',
		'Execute Luau code in-game with Ctrl+Shift+E',
		'Remote Spy capturing all FireServer and InvokeServer calls',
		'Create, clone, delete, and reparent instances from VS Code',
		'Teleport your character to any instance in the tree',
	];

	const mcpFeatures = [
		'Works with Claude, Cursor, Windsurf, and any MCP client',
		'16 tools: execute code, browse tree, read/write properties, inspect scripts',
		'Proxy mode shares the executor connection with the VS Code extension',
		'Published to GitHub Packages as @0neshot101/rbxdev-mcp',
	];
</script>
