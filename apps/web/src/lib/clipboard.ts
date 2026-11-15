/** Milliseconds a copy control shows its result before returning to idle. */
export const COPY_RESET_MS = 2000;

/**
 * Writes text to the system clipboard.
 * @param text - Text to copy.
 * @returns Whether the browser accepted the write; false when the Clipboard API is missing or denied.
 */
export const writeClipboard = (text: string): Promise<boolean> =>
  Promise.resolve()
    .then(() => navigator.clipboard.writeText(text))
    .then(
      () => true,
      () => false,
    );
