import * as path from 'path';
import { CompletionItemKind, MarkupKind, Position, TextEdit } from 'vscode-languageserver';

import { generateRequirePath, listModuleFiles } from '@workspace/moduleIndex';
import { getDataModelPath } from '@workspace/rojo';

import type { DocumentManager } from '@typings/lsp';
import type { ModuleFileEntry } from '@typings/workspace';
import type { CompletionItem } from 'vscode-languageserver';

/** Suggests workspace module exports with an edit inserting the matching `require`. */
export const getAutoImportCompletions = (
  prefix: string,
  documentManager: DocumentManager,
  currentDocUri: string,
  content: string,
): CompletionItem[] => {
  if (prefix.length < 2) return [];

  const exports = documentManager.searchModuleExports(prefix);
  if (exports.length === 0) return [];

  const rojoState = documentManager.getRojoState();
  let currentDataModelPath: string[] = [];

  if (rojoState?.dataModel !== undefined) {
    let filePath = currentDocUri;
    try {
      if (currentDocUri.startsWith('file://')) {
        filePath = decodeURIComponent(currentDocUri.replace('file:///', '').replace('file://', ''));
        if (filePath.match(/^\/[a-zA-Z]:/) !== null) filePath = filePath.slice(1);
      }
    } catch {
      /* noop */
    }

    const dataModelPath = getDataModelPath(rojoState.dataModel, filePath);
    if (dataModelPath !== undefined) currentDataModelPath = dataModelPath;
  }

  const lines = content.split('\n');
  let insertLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (line === '' || line.startsWith('--')) insertLine = i + 1;
    else break;
  }

  for (let i = insertLine; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (line.startsWith('local') && line.includes('require(')) insertLine = i + 1;
    else if (line !== '' && line.startsWith('--') === false) break;
  }

  const items: CompletionItem[] = [];
  const seenNames = new Set<string>();

  for (const exp of exports) {
    if (seenNames.has(exp.name)) continue;
    seenNames.add(exp.name);

    if (exp.filePath === currentDocUri) continue;

    let requirePath: string;
    if (currentDataModelPath.length > 0)
      requirePath = generateRequirePath(currentDataModelPath, exp.modulePath.split('.'));
    else requirePath = `game.${exp.modulePath}`;

    const pathParts = exp.modulePath.split('.');
    const moduleName = pathParts[pathParts.length - 1] ?? 'Module';

    const requireStatement = `local ${moduleName} = require(${requirePath})\n`;

    const item: CompletionItem = {
      'label': exp.name,
      'kind':
        exp.kind === 'function'
          ? CompletionItemKind.Function
          : exp.kind === 'type'
            ? CompletionItemKind.Interface
            : CompletionItemKind.Variable,
      'detail': `(auto-import) from ${exp.modulePath}`,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': `Import \`${exp.name}\` from \`${exp.modulePath}\`\n\n\`\`\`lua\n${requireStatement}\`\`\``,
      },
      'sortText': `2_${exp.name}`,
      'insertText': `${moduleName}.${exp.name}`,
      'additionalTextEdits': [TextEdit.insert(Position.create(insertLine, 0), requireStatement)],
    };

    items.push(item);
  }

  return items;
};

const formatModuleDetail = (entry: ModuleFileEntry): string => {
  if (entry.exports.length === 0) return entry.isFolder ? 'module' : 'Luau';

  const funcs = entry.exports.filter(e => e.kind === 'function');
  const values = entry.exports.filter(e => e.kind !== 'function');

  const parts: string[] = [];
  if (funcs.length > 0) parts.push(`${funcs.length} function${funcs.length > 1 ? 's' : ''}`);
  if (values.length > 0) parts.push(`${values.length} value${values.length > 1 ? 's' : ''}`);
  return parts.join(', ');
};

const formatModuleDoc = (entry: ModuleFileEntry): string => {
  if (entry.exports.length === 0) return '';

  const lines: string[] = ['```lua'];
  for (const exp of entry.exports.slice(0, 15)) {
    const icon = exp.kind === 'function' ? 'function' : exp.kind === 'table' ? 'table' : 'value';
    lines.push(`${exp.name}: ${icon}`);
  }
  if (entry.exports.length > 15) lines.push(`... and ${entry.exports.length - 15} more`);
  lines.push('```');
  return lines.join('\n');
};

/** Suggests relative module paths inside a `require` string. */
export const getLocalRequireCompletions = (beforeCursor: string, documentUri: string): CompletionItem[] | undefined => {
  const match = beforeCursor.match(/require\s*\(\s*["'](\.\.?\/[^"']*)$/);
  if (match === null) return undefined;

  const partialPath = match[1];
  if (partialPath === undefined) return undefined;

  let filePath: string;
  try {
    filePath = decodeURIComponent(new URL(documentUri).pathname);
    if (filePath.match(/^\/[A-Za-z]:/) !== null) filePath = filePath.slice(1);
  } catch {
    return undefined;
  }

  const currentDir = filePath.replace(/[/\\][^/\\]*$/, '');
  const lastSlash = partialPath.lastIndexOf('/');
  const dirPart = partialPath.slice(0, lastSlash + 1);
  const prefix = partialPath.slice(lastSlash + 1).toLowerCase();

  const searchDir = path.resolve(currentDir, dirPart);
  const entries = listModuleFiles(searchDir);
  if (entries.length === 0) return undefined;

  const items: CompletionItem[] = [];
  for (const entry of entries) {
    if (prefix.length > 0 && entry.name.toLowerCase().startsWith(prefix) === false) continue;

    const detail = formatModuleDetail(entry);
    const doc = formatModuleDoc(entry);

    const item: CompletionItem = {
      'label': entry.name,
      'labelDetails': { 'description': entry.ext },
      'kind': CompletionItemKind.Module,
      'detail': detail,
      'sortText': `0_${entry.name}`,
    };

    if (doc.length > 0) item.documentation = { 'kind': MarkupKind.Markdown, 'value': doc };

    items.push(item);
  }

  return items.length > 0 ? items : undefined;
};
