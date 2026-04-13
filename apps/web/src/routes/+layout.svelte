<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
		rel="stylesheet"
	/>
	<title>rbxdev-ls | Luau Language Server for Roblox</title>
	<link rel="icon" href="https://raw.githubusercontent.com/0neShot101/rbxdev-ls/main/packages/vscode/icon.png" />
	<meta name="description" content="Type checking, completions, and live game tooling for Roblox development in VS Code." />
</svelte:head>

{@render children()}
