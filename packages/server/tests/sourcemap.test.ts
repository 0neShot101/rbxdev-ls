import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import {
  buildDataModelTreeFromSourcemap,
  findSourcemap,
  loadSourcemapState,
  parseSourcemap,
} from '@workspace/sourcemap';
import type { SourcemapNode } from '@typings/workspace';

describe('sourcemap parser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rbxdev-sourcemap-'));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { 'recursive': true, 'force': true });
    } catch {
      /* noop */
    }
  });

  test('findSourcemap returns undefined when no sourcemap.json exists', () => {
    expect(findSourcemap(tempDir)).toBeUndefined();
  });

  test('findSourcemap returns the path when sourcemap.json exists at workspace root', () => {
    const sourcemapPath = path.join(tempDir, 'sourcemap.json');
    writeFileSync(sourcemapPath, '{}');
    expect(findSourcemap(tempDir)).toBe(sourcemapPath);
  });

  test('parseSourcemap returns undefined for missing files', () => {
    expect(parseSourcemap(path.join(tempDir, 'nope.json'))).toBeUndefined();
  });

  test('parseSourcemap returns undefined for invalid JSON', () => {
    const p = path.join(tempDir, 'sourcemap.json');
    writeFileSync(p, '{ not json');
    expect(parseSourcemap(p)).toBeUndefined();
  });

  test('parseSourcemap returns undefined when required fields are missing', () => {
    const p = path.join(tempDir, 'sourcemap.json');
    writeFileSync(p, JSON.stringify({ 'className': 'DataModel' })); // missing name
    expect(parseSourcemap(p)).toBeUndefined();
  });

  test('parseSourcemap accepts minimal valid sourcemap', () => {
    const p = path.join(tempDir, 'sourcemap.json');
    writeFileSync(p, JSON.stringify({ 'name': 'Root', 'className': 'DataModel' }));
    const parsed = parseSourcemap(p);
    expect(parsed).toBeDefined();
    expect(parsed?.name).toBe('Root');
    expect(parsed?.className).toBe('DataModel');
  });

  test('buildDataModelTreeFromSourcemap copies name and className verbatim', () => {
    const root: SourcemapNode = { 'name': 'Place1', 'className': 'DataModel' };
    const tree = buildDataModelTreeFromSourcemap(root, tempDir);
    expect(tree.name).toBe('Place1');
    expect(tree.className).toBe('DataModel');
    expect(tree.children.size).toBe(0);
    expect(tree.filePath).toBeUndefined();
  });

  test('buildDataModelTreeFromSourcemap does not hard-code DataModel as root className', () => {
    // Library projects use Folder / ModuleScript as the root.
    const root: SourcemapNode = { 'name': 'MyLib', 'className': 'Folder' };
    const tree = buildDataModelTreeFromSourcemap(root, tempDir);
    expect(tree.className).toBe('Folder');
  });

  test('buildDataModelTreeFromSourcemap recurses into children', () => {
    const root: SourcemapNode = {
      'name': 'Game',
      'className': 'DataModel',
      'children': [
        {
          'name': 'ReplicatedStorage',
          'className': 'ReplicatedStorage',
          'children': [{ 'name': 'Module', 'className': 'ModuleScript' }],
        },
      ],
    };
    const tree = buildDataModelTreeFromSourcemap(root, tempDir);
    const rs = tree.children.get('ReplicatedStorage');
    expect(rs).toBeDefined();
    expect(rs?.className).toBe('ReplicatedStorage');
    const module = rs?.children.get('Module');
    expect(module).toBeDefined();
    expect(module?.className).toBe('ModuleScript');
  });

  test('buildDataModelTreeFromSourcemap prefers .lua/.luau over directory path', () => {
    // Folder-backed ModuleScript emits both the dir and the init file.
    const root: SourcemapNode = {
      'name': 'Root',
      'className': 'DataModel',
      'children': [
        {
          'name': 'FolderModule',
          'className': 'ModuleScript',
          'filePaths': ['src/FolderModule', 'src/FolderModule/init.lua'],
        },
      ],
    };
    const tree = buildDataModelTreeFromSourcemap(root, tempDir);
    const child = tree.children.get('FolderModule');
    expect(child).toBeDefined();
    expect(child?.filePath).toBe(path.normalize(path.join(tempDir, 'src/FolderModule/init.lua')));
  });

  test('buildDataModelTreeFromSourcemap resolves relative paths against baseDir', () => {
    const root: SourcemapNode = {
      'name': 'Root',
      'className': 'DataModel',
      'children': [
        {
          'name': 'Module',
          'className': 'ModuleScript',
          'filePaths': ['src/Module.lua'],
        },
      ],
    };
    const tree = buildDataModelTreeFromSourcemap(root, tempDir);
    const child = tree.children.get('Module');
    expect(child?.filePath).toBe(path.normalize(path.join(tempDir, 'src/Module.lua')));
  });

  test('buildDataModelTreeFromSourcemap preserves absolute paths', () => {
    const absolute = path.normalize(path.join(tempDir, 'absolute', 'Module.lua'));
    const root: SourcemapNode = {
      'name': 'Root',
      'className': 'DataModel',
      'children': [
        {
          'name': 'Module',
          'className': 'ModuleScript',
          'filePaths': [absolute],
        },
      ],
    };
    const tree = buildDataModelTreeFromSourcemap(root, tempDir);
    expect(tree.children.get('Module')?.filePath).toBe(absolute);
  });

  test('buildDataModelTreeFromSourcemap keeps first child when duplicate names exist', () => {
    const root: SourcemapNode = {
      'name': 'Root',
      'className': 'DataModel',
      'children': [
        { 'name': 'Foo', 'className': 'Folder' },
        { 'name': 'Foo', 'className': 'ModuleScript' },
      ],
    };
    const tree = buildDataModelTreeFromSourcemap(root, tempDir);
    expect(tree.children.size).toBe(1);
    expect(tree.children.get('Foo')?.className).toBe('Folder');
  });

  test('buildDataModelTreeFromSourcemap leaves filePath undefined when filePaths is missing', () => {
    const root: SourcemapNode = {
      'name': 'Root',
      'className': 'DataModel',
      'children': [{ 'name': 'Service', 'className': 'ReplicatedStorage' }],
    };
    const tree = buildDataModelTreeFromSourcemap(root, tempDir);
    expect(tree.children.get('Service')?.filePath).toBeUndefined();
  });

  test('loadSourcemapState returns empty state when sourcemap.json is missing', () => {
    const state = loadSourcemapState(tempDir);
    expect(state.dataModel).toBeUndefined();
    expect(state.projectPath).toBeUndefined();
    expect(state.project).toBeUndefined();
  });

  test('loadSourcemapState returns projectPath but no dataModel when file is invalid', () => {
    const p = path.join(tempDir, 'sourcemap.json');
    writeFileSync(p, '{ broken');
    const state = loadSourcemapState(tempDir);
    expect(state.dataModel).toBeUndefined();
    expect(state.projectPath).toBe(p);
  });

  test('loadSourcemapState builds a DataModelNode tree from a valid file', () => {
    const p = path.join(tempDir, 'sourcemap.json');
    mkdirSync(path.join(tempDir, 'src'), { 'recursive': true });
    writeFileSync(path.join(tempDir, 'src', 'Module.lua'), '-- empty\n');
    writeFileSync(
      p,
      JSON.stringify({
        'name': 'Place1',
        'className': 'DataModel',
        'children': [
          {
            'name': 'ReplicatedStorage',
            'className': 'ReplicatedStorage',
            'children': [
              {
                'name': 'Module',
                'className': 'ModuleScript',
                'filePaths': ['src/Module.lua'],
              },
            ],
          },
        ],
      }),
    );

    const state = loadSourcemapState(tempDir);
    expect(state.dataModel).toBeDefined();
    expect(state.projectPath).toBe(p);
    expect(state.project).toBeUndefined();

    const rs = state.dataModel?.children.get('ReplicatedStorage');
    expect(rs).toBeDefined();
    const module = rs?.children.get('Module');
    expect(module?.filePath).toBe(path.normalize(path.join(tempDir, 'src/Module.lua')));
  });

  test('loadSourcemapState uses the sourcemap directory as the path base', () => {
    // Put the sourcemap in a subdirectory; filePaths resolve against that
    // subdirectory, not the workspace root.
    const project = path.join(tempDir, 'game');
    mkdirSync(project, { 'recursive': true });
    mkdirSync(path.join(project, 'src'), { 'recursive': true });
    writeFileSync(path.join(project, 'src', 'Module.lua'), '');
    writeFileSync(
      path.join(project, 'sourcemap.json'),
      JSON.stringify({
        'name': 'Root',
        'className': 'DataModel',
        'children': [
          {
            'name': 'M',
            'className': 'ModuleScript',
            'filePaths': ['src/Module.lua'],
          },
        ],
      }),
    );

    const state = loadSourcemapState(project);
    expect(state.dataModel?.children.get('M')?.filePath).toBe(path.normalize(path.join(project, 'src/Module.lua')));
  });
});
