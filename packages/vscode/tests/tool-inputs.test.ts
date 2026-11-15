import { describe, expect, test } from 'bun:test';

import { isJsonObject, parseJsonObject } from '@extension/utils/json';
import {
  isBlockListInput,
  isCreateInstanceInput,
  isPathInput,
  isRemoteCallsInput,
  isSetPropertyInput,
  isTreeInput,
} from '@extension/utils/toolInputs';

describe('tool input decoders', () => {
  test('accept valid inputs and absent optional fields', () => {
    expect(isPathInput({ 'path': ['Workspace', 'Part'] })).toBe(true);
    expect(isPathInput({})).toBe(true);
    expect(isTreeInput({ 'path': ['Workspace'], 'format': 'json' })).toBe(true);
    expect(isSetPropertyInput({ 'path': ['Workspace'], 'property': 'Name', 'value': 'A', 'valueType': 'string' })).toBe(
      true,
    );
    expect(isCreateInstanceInput({ 'className': 'Part', 'parentPath': ['Workspace'] })).toBe(true);
    expect(isBlockListInput({ 'blocks': [{ 'type': 'name', 'value': 'Remote' }] })).toBe(true);
  });

  test('reject non-string path segments', () => {
    expect(isPathInput({ 'path': ['Workspace', 1] })).toBe(false);
    expect(isCreateInstanceInput({ 'className': 'Part', 'parentPath': [null] })).toBe(false);
  });

  test('reject wrong scalar types and unknown enum values', () => {
    expect(isTreeInput({ 'format': 'xml' })).toBe(false);
    expect(isSetPropertyInput({ 'path': ['Workspace'], 'property': 3 })).toBe(false);
    expect(isRemoteCallsInput({ 'limit': '50' })).toBe(false);
    expect(isBlockListInput({ 'blocks': [{ 'type': 'id', 'value': 'Remote' }] })).toBe(false);
  });

  test('reject non-object input', () => {
    expect(isPathInput(undefined)).toBe(false);
    expect(isPathInput('Workspace')).toBe(false);
  });
});

describe('JSON object decoding', () => {
  test('parses objects and rejects other JSON documents', () => {
    expect(parseJsonObject('{"servers":{"a":{"args":[1,true,null]}}}')).toEqual({
      'servers': { 'a': { 'args': [1, true, null] } },
    });
    expect(parseJsonObject('[1, 2]')).toBeUndefined();
    expect(parseJsonObject('null')).toBeUndefined();
  });

  test('rejects values that are not JSON', () => {
    expect(isJsonObject({ 'callback': () => undefined })).toBe(false);
    expect(isJsonObject({ 'nested': { 'value': undefined } })).toBe(false);
  });
});
