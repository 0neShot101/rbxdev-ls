import type { Pathname } from '$app/types';

/** One sidebar link to a docs page. */
export interface DocsLink {
  /** Link text shown in the sidebar. */
  title: string;
  /** Unresolved route path of the target page. */
  href: Pathname;
}

/** A titled group of sidebar links. */
export interface DocsSection {
  /** Group heading shown above its links. */
  title: string;
  /** Links listed under the heading. */
  items: ReadonlyArray<DocsLink>;
}
