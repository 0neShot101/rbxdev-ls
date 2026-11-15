<script lang="ts">
  import { onMount } from 'svelte';

  import { afterNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { COPY_RESET_MS, writeClipboard } from '$lib/clipboard';

  import type { CopyStatus } from '$lib/types/clipboard';
  import type { LayoutProps } from '$lib/types/layout';
  import type { DocsSection } from '$lib/types/navigation';

  const { children }: LayoutProps = $props();

  const COPY_LABELS: Record<CopyStatus, string> = {
    'idle': 'Copy code',
    'copied': 'Copied',
    'failed': 'Copy failed',
  };

  const sections: ReadonlyArray<DocsSection> = [
    {
      'title': 'Getting started',
      'items': [
        { 'title': 'Installation', 'href': '/docs/getting-started/installation' },
        { 'title': 'Quick start', 'href': '/docs/getting-started/quick-start' },
      ],
    },
    {
      'title': 'Guides',
      'items': [
        { 'title': 'Executor bridge', 'href': '/docs/guides/executor-bridge' },
        { 'title': 'MCP server', 'href': '/docs/guides/mcp-server' },
        { 'title': 'Luau bundler', 'href': '/docs/guides/luau-bundler' },
        { 'title': 'Type checking', 'href': '/docs/guides/type-checking' },
        { 'title': 'Rojo integration', 'href': '/docs/guides/rojo' },
      ],
    },
    {
      'title': 'Reference',
      'items': [
        { 'title': 'Settings', 'href': '/docs/reference/settings' },
        { 'title': 'Keybindings', 'href': '/docs/reference/keybindings' },
        { 'title': 'MCP tools', 'href': '/docs/reference/mcp-tools' },
      ],
    },
  ];

  const timers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
  let article: HTMLElement | undefined;

  const showStatus = (button: HTMLButtonElement, status: CopyStatus): void => {
    button.textContent = COPY_LABELS[status];
    clearTimeout(timers.get(button));
    timers.set(
      button,
      setTimeout(() => {
        button.textContent = COPY_LABELS.idle;
        timers.delete(button);
      }, COPY_RESET_MS),
    );
  };

  const resetButtons = (): void => {
    for (const [button, timer] of timers) {
      clearTimeout(timer);
      button.textContent = COPY_LABELS.idle;
    }
    timers.clear();
  };

  const createButton = (): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-button';
    button.textContent = COPY_LABELS.idle;
    button.setAttribute('aria-live', 'polite');
    return button;
  };

  const addButtons = (): void => {
    if (article === undefined) return;

    for (const pre of article.querySelectorAll('pre')) {
      if (pre.parentElement?.classList.contains('code-block') === true) continue;
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block';
      pre.before(wrapper);
      wrapper.append(pre, createButton());
    }
  };

  const copy = async (button: HTMLButtonElement): Promise<void> => {
    const code = button.parentElement?.querySelector('pre')?.textContent ?? '';
    showStatus(button, (await writeClipboard(code)) ? 'copied' : 'failed');
  };

  const onClick = (event: MouseEvent): void => {
    const button =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button.copy-button') : null;
    if (button !== null) void copy(button);
  };

  afterNavigate(() => {
    resetButtons();
    addButtons();
  });

  onMount(() => {
    if (article === undefined) return;
    const target = article;
    target.addEventListener('click', onClick);

    return () => {
      target.removeEventListener('click', onClick);
      resetButtons();
    };
  });
</script>

<nav class="fixed top-0 z-50 w-full border-b border-white/5 bg-surface-base/80 backdrop-blur-xl">
  <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
    <div class="flex items-center gap-3">
      <a href={resolve('/')} class="flex items-center gap-3">
        <enhanced:img src="$lib/assets/rbxdev.png" alt="" width="64" height="64" class="h-8 w-8" />
        <span class="text-lg font-semibold text-text-primary">rbxdev-ls</span>
      </a>
      <span class="text-text-muted">/</span>
      <span class="text-sm text-text-secondary">docs</span>
    </div>
    <div class="hidden items-center gap-8 text-sm text-text-secondary md:flex">
      <a href={resolve('/')} class="transition-colors hover:text-text-primary">Home</a>
      <a href="https://github.com/0neShot101/rbxdev-ls" class="transition-colors hover:text-text-primary">GitHub</a>
    </div>
    <a
      href="https://marketplace.visualstudio.com/items?itemName=rbxdev.rbxdev-ls"
      class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-brand-400"
    >
      Install
    </a>
  </div>
</nav>

<div class="flex min-h-screen pt-16">
  <aside
    class="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-white/5 bg-surface-base px-4 py-8 lg:block"
  >
    {#each sections as section (section.title)}
      <div class="mb-6">
        <h2 class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
          {section.title}
        </h2>
        <ul class="space-y-0.5">
          {#each section.items as item (item.href)}
            {@const href = resolve(item.href)}
            <li>
              <a
                {href}
                aria-current={page.url.pathname === href ? 'page' : undefined}
                class={[
                  'block rounded-lg px-3 py-1.5 text-sm transition-colors',
                  page.url.pathname === href
                    ? 'bg-brand-500/10 font-medium text-brand-300'
                    : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary',
                ]}
              >
                {item.title}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </aside>

  <main class="mx-auto w-full max-w-3xl px-6 py-12 lg:ml-64">
    <article bind:this={article} class="docs-content">
      {@render children()}
    </article>
  </main>
</div>

<style>
  :global(.docs-content h1) { font-size: 1.875rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 1rem; }
  :global(.docs-content h2) { font-size: 1.25rem; font-weight: 700; color: var(--color-text-primary); margin-top: 2.5rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
  :global(.docs-content h3) { font-size: 1.125rem; font-weight: 600; color: var(--color-text-primary); margin-top: 2rem; margin-bottom: 0.75rem; }
  :global(.docs-content p) { color: var(--color-text-secondary); line-height: 1.75; margin-bottom: 1rem; }
  :global(.docs-content a) { color: var(--color-brand-400); text-decoration: none; }
  :global(.docs-content a:hover) { text-decoration: underline; }
  :global(.docs-content strong) { color: var(--color-text-primary); }
  :global(.docs-content ul, .docs-content ol) { color: var(--color-text-secondary); padding-left: 1.5rem; margin-bottom: 1rem; }
  :global(.docs-content li) { margin-bottom: 0.25rem; line-height: 1.75; }
  :global(.docs-content code) { color: var(--color-brand-300); background: var(--color-surface-overlay); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.875rem; font-family: var(--font-mono); }
  :global(.docs-content pre) { background: var(--color-code-bg); border: 1px solid var(--color-code-border); border-radius: 0.75rem; padding: 1.25rem; overflow-x: auto; margin-bottom: 1.5rem; position: relative; }
  :global(.code-block) { position: relative; }
  :global(.copy-button) { position: absolute; top: 0.5rem; right: 0.5rem; padding: 0.25rem 0.625rem; font-size: 0.75rem; font-family: var(--font-sans); color: var(--color-text-muted); background: var(--color-surface-overlay); border: 1px solid var(--color-code-border); border-radius: 0.375rem; cursor: pointer; transition: all 0.15s; opacity: 0; }
  :global(.code-block:hover .copy-button, .copy-button:focus-visible) { opacity: 1; }
  :global(.copy-button:hover, .copy-button:focus-visible) { color: var(--color-text-primary); background: var(--color-surface-elevated); }
  @media (hover: none) { :global(.copy-button) { opacity: 1; } }
  :global(.docs-content pre code) { background: none; padding: 0; color: var(--color-text-secondary); font-size: 0.875rem; line-height: 1.7; }
  :global(.docs-content table) { width: 100%; font-size: 0.875rem; margin-bottom: 1.5rem; border-collapse: collapse; }
  :global(.docs-content th) { color: var(--color-text-primary); text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--color-surface-highest); font-weight: 600; }
  :global(.docs-content td) { color: var(--color-text-secondary); padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--color-surface-overlay); }
</style>
