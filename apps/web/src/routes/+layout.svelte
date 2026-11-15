<script lang="ts">
  import '@fontsource/inter/latin-400.css';
  import '@fontsource/inter/latin-500.css';
  import '@fontsource/inter/latin-600.css';
  import '@fontsource/inter/latin-700.css';
  import '@fontsource/inter/latin-800.css';
  import '@fontsource/jetbrains-mono/latin-400.css';
  import '@fontsource/jetbrains-mono/latin-500.css';

  import favicon from '$lib/assets/rbxdev.png';
  import '$styles';

  import type { LayoutProps } from '$lib/types/layout';

  const { children }: LayoutProps = $props();
</script>

<svelte:head>
  <link rel="icon" type="image/png" href={favicon} />
  <meta name="description" content="Type checking, completions, and live game tooling for Roblox development in VS Code." />
</svelte:head>

{@render children()}
