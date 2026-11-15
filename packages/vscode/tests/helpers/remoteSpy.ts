import type { Uri } from 'vscode';

/** Extension location used by panel tests; only localResourceRoots reads this URI. */
export const extensionUri: Uri = {
  'scheme': 'file',
  'authority': '',
  'path': '/test-extension',
  'query': '',
  'fragment': '',
  'fsPath': '/test-extension',
  'with': () => extensionUri,
  'toJSON': () => ({ 'scheme': 'file', 'path': '/test-extension' }),
  'toString': () => 'file:///test-extension',
};
