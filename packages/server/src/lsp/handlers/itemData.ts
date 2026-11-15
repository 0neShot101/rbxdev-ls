import { isObject, isString } from '@utils/guards';

import type { CompletionItemData, NamedItemData } from '@typings/handlers';

/** Checks whether a client-echoed item payload carries the symbol name and document URI this server attached. */
export const isNamedItemData = (value: unknown): value is NamedItemData =>
  isObject(value) && 'name' in value && isString(value.name) && 'uri' in value && isString(value.uri);

/** Checks whether a client-echoed completion payload is a member or global documentation request. */
export const isCompletionItemData = (value: unknown): value is CompletionItemData => {
  if (isObject(value) === false || 'resolve' in value === false) return false;
  if (value.resolve === 'member')
    return 'class' in value && isString(value.class) && 'member' in value && isString(value.member);
  return value.resolve === 'global' && 'name' in value && isString(value.name);
};
