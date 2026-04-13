<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();

	const sections = [
		{
			title: 'Getting Started',
			items: [
				{ title: 'Installation', href: '/docs/getting-started/installation' },
				{ title: 'Quick Start', href: '/docs/getting-started/quick-start' },
			]
		},
		{
			title: 'Guides',
			items: [
				{ title: 'Executor Bridge', href: '/docs/guides/executor-bridge' },
				{ title: 'MCP Server', href: '/docs/guides/mcp-server' },
				{ title: 'Luau Bundler', href: '/docs/guides/luau-bundler' },
				{ title: 'Type Checking', href: '/docs/guides/type-checking' },
				{ title: 'Rojo Integration', href: '/docs/guides/rojo' },
			]
		},
		{
			title: 'Reference',
			items: [
				{ title: 'Settings', href: '/docs/reference/settings' },
				{ title: 'Keybindings', href: '/docs/reference/keybindings' },
				{ title: 'MCP Tools', href: '/docs/reference/mcp-tools' },
			]
		}
	];
</script>

<div class="flex min-h-screen pt-16">
	<!-- Sidebar -->
	<aside class="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-white/5 bg-[var(--color-surface-base)] px-4 py-8 lg:block">
		{#each sections as section}
			<div class="mb-6">
				<h4 class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
					{section.title}
				</h4>
				<ul class="space-y-0.5">
					{#each section.items as item}
						<li>
							<a
								href={item.href}
								class="block rounded-lg px-3 py-1.5 text-sm transition-colors {page.url.pathname === item.href
									? 'bg-[var(--color-brand-500)]/10 text-[var(--color-brand-300)] font-medium'
									: 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)]'}"
							>
								{item.title}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</aside>

	<!-- Content -->
	<main class="mx-auto w-full max-w-3xl px-6 py-12 lg:ml-64">
		<article class="prose prose-invert max-w-none
			prose-headings:text-[var(--color-text-primary)] prose-headings:font-bold
			prose-h1:text-3xl prose-h1:mb-4
			prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-white/5 prose-h2:pb-2
			prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
			prose-p:text-[var(--color-text-secondary)] prose-p:leading-relaxed
			prose-a:text-[var(--color-brand-400)] prose-a:no-underline hover:prose-a:underline
			prose-strong:text-[var(--color-text-primary)]
			prose-code:text-[var(--color-brand-300)] prose-code:bg-[var(--color-surface-overlay)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
			prose-pre:bg-[var(--color-code-bg)] prose-pre:border prose-pre:border-[var(--color-code-border)] prose-pre:rounded-xl
			prose-li:text-[var(--color-text-secondary)]
			prose-table:text-sm
			prose-th:text-[var(--color-text-primary)] prose-th:border-[var(--color-surface-highest)]
			prose-td:text-[var(--color-text-secondary)] prose-td:border-[var(--color-surface-highest)]
		">
			{@render children()}
		</article>
	</main>
</div>
