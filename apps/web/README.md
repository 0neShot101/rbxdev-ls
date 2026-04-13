# rbxdev-ls Website

Landing page and documentation site for [rbxdev-ls](https://github.com/0neShot101/rbxdev-ls).

Built with SvelteKit, Tailwind CSS, and mdsvex for markdown docs.

## Development

```bash
cd apps/web
bun install
bun run dev
```

Opens at `http://localhost:5173`.

## Structure

```
src/
  routes/
    +page.svelte              Landing page
    docs/
      +layout.svelte          Docs sidebar and nav
      getting-started/         Installation, quick start
      guides/                  Bridge, MCP, bundler, type checking, Rojo
      reference/               Settings, keybindings, MCP tools
  lib/
    components/
      Particles.svelte         Canvas particle background
  app.css                      Design system (colors, typography, spacing)
```

## Building

```bash
bun run build
```

## Deployment

The site uses `adapter-auto`. Configure an adapter (Vercel, Cloudflare Pages, static) for your hosting target.
