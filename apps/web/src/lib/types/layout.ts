import type { Snippet } from 'svelte';

/** Props shared by layouts that wrap routed page content. */
export interface LayoutProps {
  /** Routed page content rendered inside the layout. */
  children: Snippet;
}
