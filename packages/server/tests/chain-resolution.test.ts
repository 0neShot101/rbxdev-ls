import { describe, expect, test } from 'bun:test';
import { createDocumentManager } from '@lsp/documents';
import { resolveExpressionType, resolveTypeReference } from '@lsp/handlers/completion/expression';
import { extractExpressionChain } from '@lsp/handlers/completion/paths';
import { expectDefined } from '@tests/helpers/expect';
import type { LuauType } from '@typings/types';

const documentManager = createDocumentManager();

const classNameOf = (type: LuauType | undefined): string | undefined => {
  if (type === undefined) return undefined;
  const resolved = resolveTypeReference(type, documentManager);
  return resolved.kind === 'Class' ? resolved.name : undefined;
};

const expressionClass = (expression: string): string | undefined =>
  classNameOf(resolveExpressionType(expression, documentManager));

const completionClass = (beforeCursor: string): string | undefined =>
  classNameOf(resolveExpressionType(expectDefined(extractExpressionChain(beforeCursor)).expression, documentManager));

describe('Basic Expression Resolution', () =>
  test.each([
    ['game', 'DataModel'],
    ['workspace', 'Workspace'],
  ])('%s resolves to %s', (expression, className) => expect(expressionClass(expression)).toBe(className)));

describe('GetService Resolution', () =>
  test.each([
    ['game:GetService("Players")', 'Players'],
    ['game:GetService("Workspace")', 'Workspace'],
    ['game:GetService("RunService")', 'RunService'],
    ['game:GetService("TweenService")', 'TweenService'],
    ["game:GetService('Players')", 'Players'],
  ])('%s resolves to %s', (expression, className) => expect(expressionClass(expression)).toBe(className)));

describe('Property Access Resolution', () =>
  test.each([
    ['game.Players', 'Players'],
    ['game.Workspace', 'Workspace'],
    ['workspace.CurrentCamera', 'Camera'],
  ])('%s resolves to %s', (expression, className) => expect(expressionClass(expression)).toBe(className)));

describe('Chain Resolution', () =>
  test.each([
    ['game:GetService("Players").LocalPlayer', 'Player'],
    ['game.Players.LocalPlayer', 'Player'],
    ['game.Players.LocalPlayer.Character', 'Model'],
  ])('%s resolves to %s', (expression, className) => expect(expressionClass(expression)).toBe(className)));

describe('FindFirstChildOfClass/WhichIsA Resolution', () =>
  test.each([
    ['game.Workspace:FindFirstChildOfClass("Part")', 'Part'],
    ['game.Workspace:FindFirstChildWhichIsA("BasePart")', 'BasePart'],
  ])('%s resolves to %s', (expression, className) => expect(expressionClass(expression)).toBe(className)));

describe('Completion Handler Integration', () =>
  test.each([
    ['game.', 'DataModel'],
    ['game.Players.', 'Players'],
    ['game:GetService("Players").', 'Players'],
    ['game:GetService("Players").LocalPlayer.', 'Player'],
    ['game.Players.LocalPlayer.', 'Player'],
    ['game.Players.LocalPlayer.Character.', 'Model'],
    ['workspace.', 'Workspace'],
    ['workspace.CurrentCamera.', 'Camera'],
  ])('%s resolves to %s', (beforeCursor, className) => expect(completionClass(beforeCursor)).toBe(className)));

describe('Method Access Completions', () =>
  test.each([
    ['game:', 'DataModel'],
    ['game.Players:', 'Players'],
    ['game:GetService("Players"):', 'Players'],
    ['game.Players.LocalPlayer:', 'Player'],
  ])('%s resolves to %s', (beforeCursor, className) => expect(completionClass(beforeCursor)).toBe(className)));

describe('Edge Cases', () =>
  test.each([
    ["game:GetService('Players').", 'Players'],
    ["game:GetService('Players').LocalPlayer.", 'Player'],
    ["game : GetService ( 'Players' ) .", 'Players'],
  ])('%s resolves to %s', (beforeCursor, className) => expect(completionClass(beforeCursor)).toBe(className)));

describe('WaitForChild Chains', () => {
  test('Instance class has WaitForChild method', () => {
    const instanceClass = documentManager.globalEnv.robloxClasses.get('Instance');
    expect(instanceClass?.kind === 'Class' && instanceClass.methods.has('WaitForChild')).toBe(true);
  });

  test.each([
    'workspace:WaitForChild("X")',
    'workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds")',
    'workspace:FindFirstChild("X")',
    'workspace:FindFirstChild("X"):FindFirstChild("Y")',
    'workspace:WaitForChild("X"):FindFirstChild("Y")',
  ])('%s resolves to Instance', expression => expect(expressionClass(expression)).toBe('Instance'));

  test.each(['workspace:WaitForChild("X"):', 'workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds"):'])(
    '%s completion resolves to Instance',
    beforeCursor => expect(completionClass(beforeCursor)).toBe('Instance'),
  );

  test('extractExpressionChain parses WaitForChild chain correctly', () => {
    const chain = expectDefined(
      extractExpressionChain('workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds"):'),
    );
    expect(chain.expression).toBe('workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds")');
    expect(chain.isMethodAccess).toBe(true);
  });
});
