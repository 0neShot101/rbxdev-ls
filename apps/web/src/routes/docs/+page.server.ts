import { redirect } from '@sveltejs/kit';

import { resolve } from '$app/paths';

/** Sends the docs index to the installation guide. */
export const load = (): void => {
  redirect(307, resolve('/docs/getting-started/installation'));
};
