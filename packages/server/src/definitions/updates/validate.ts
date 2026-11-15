import { isBoolean, isObject, isString, isStringArray } from '@utils/guards';
import { once } from '@utils/once';

import type {
  RobloxApiDump,
  RobloxClass,
  RobloxEnum,
  RobloxMember,
  RobloxParameter,
  RobloxValueType,
  SuncApiDefinition,
  SuncFunction,
} from '@typings/definitions';
import type { DocsDatabase, DocsEntry } from '@typings/docs';
import type {
  BundledManifest,
  CachePointer,
  CheckRecord,
  DocsLayout,
  LockRecord,
  SnapshotManifest,
  StudioVersion,
  WireApiDump,
  WireClass,
  WireMember,
  WireReturnType,
  ApiHeader,
  ClassSummary,
} from '@typings/updates';

const VOID_TYPE: RobloxValueType = { 'Name': 'void', 'Category': 'Primitive' };
const REQUIRED_CLASSES = ['Instance', 'DataModel', 'Workspace'];
const ROOT_SUPERCLASS = '<<<ROOT>>>';

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const has = <Value>(value: unknown, key: string, guard: (member: unknown) => member is Value): value is object =>
  isObject(value) && guard(Object.getOwnPropertyDescriptor(value, key)?.value);

const hasOptional = <Value>(
  value: unknown,
  key: string,
  guard: (member: unknown) => member is Value,
): value is object => {
  if (isObject(value) === false) return false;
  const member = Object.getOwnPropertyDescriptor(value, key)?.value;
  return member === undefined || guard(member);
};

const isArrayOf =
  <Value>(guard: (item: unknown) => item is Value) =>
  (value: unknown): value is ReadonlyArray<Value> =>
    Array.isArray(value) && value.every(guard);

const isRecordOf =
  <Value>(guard: (item: unknown) => item is Value) =>
  (value: unknown): value is Readonly<Record<string, Value>> =>
    isObject(value) && Array.isArray(value) === false && Object.values(value).every(guard);

/**
 * Parses JSON text and accepts it only when it satisfies a named contract.
 * @param text - Candidate JSON document.
 * @param guard - Predicate establishing the contract.
 * @returns The decoded value, or `undefined` for malformed or non-conforming JSON.
 */
export const decodeJson = <T>(text: string, guard: (value: unknown) => value is T): T | undefined => {
  try {
    const value: unknown = JSON.parse(text);
    return guard(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

const isStringRecord = isRecordOf(isString);

const isTag = (value: unknown): value is string | Readonly<Record<string, string>> =>
  isString(value) || isStringRecord(value);

const isTags = isArrayOf(isTag);

const isCategory = (category: unknown): category is RobloxValueType['Category'] =>
  category === 'Primitive' ||
  category === 'Class' ||
  category === 'DataType' ||
  category === 'Enum' ||
  category === 'Group';

const isValueType = (value: unknown): value is RobloxValueType =>
  isObject(value) && 'Name' in value && isString(value.Name) && 'Category' in value && isCategory(value.Category);

const isValueTypes = isArrayOf(isValueType);

const isReturnType = (value: unknown): value is WireReturnType => isValueType(value) || isValueTypes(value);

const isParameter = (value: unknown): value is RobloxParameter =>
  isObject(value) &&
  'Name' in value &&
  isString(value.Name) &&
  'Type' in value &&
  isValueType(value.Type) &&
  ('Default' in value === false || isString(value.Default));

const isParameters = isArrayOf(isParameter);

const isMember = (value: unknown): value is WireMember => {
  if (isObject(value) === false || 'Name' in value === false || isString(value.Name) === false) return false;
  if ('Tags' in value && isTags(value.Tags) === false) return false;
  if ('MemberType' in value === false) return false;
  if (value.MemberType === 'Property') return 'ValueType' in value && isValueType(value.ValueType);
  const hasParameters = 'Parameters' in value && isParameters(value.Parameters);
  if (value.MemberType === 'Event') return hasParameters;
  if (value.MemberType === 'Function' || value.MemberType === 'Callback')
    return hasParameters && 'ReturnType' in value && isReturnType(value.ReturnType);
  return false;
};

const isMembers = isArrayOf(isMember);

const isClass = (value: unknown): value is WireClass =>
  has(value, 'Name', isString) &&
  has(value, 'Superclass', isString) &&
  has(value, 'Members', isMembers) &&
  hasOptional(value, 'Tags', isTags);

const isEnumItem = (value: unknown): value is RobloxEnum['Items'][number] =>
  isObject(value) && 'Name' in value && isString(value.Name) && 'Value' in value && isNumber(value.Value);

const isEnumItems = isArrayOf(isEnumItem);

const isEnum = (value: unknown): value is RobloxEnum =>
  has(value, 'Name', isString) && has(value, 'Items', isEnumItems);

const hasUniqueNames = (items: ReadonlyArray<{ readonly Name: string }>): boolean =>
  new Set(items.map(item => item.Name)).size === items.length;

const hasAcyclicInheritance = (classes: ReadonlyArray<ClassSummary>): boolean => {
  const superclasses = new Map(classes.map(item => [item.Name, item.Superclass]));
  return classes.every(item => {
    const visited = new Set<string>();
    for (
      let name: string | undefined = item.Name;
      name !== undefined && name !== ROOT_SUPERCLASS;
      name = superclasses.get(name)
    ) {
      if (visited.has(name)) return false;
      visited.add(name);
    }
    return true;
  });
};

const isWireApiDump = (value: unknown): value is WireApiDump =>
  has(value, 'Version', (version: unknown): version is 1 => version === 1) &&
  has(value, 'Classes', isArrayOf(isClass)) &&
  has(value, 'Enums', isArrayOf(isEnum));

const isSingleReturn = (member: WireMember): member is RobloxMember =>
  member.MemberType === 'Property' || member.MemberType === 'Event' || Array.isArray(member.ReturnType) === false;

const isValueTuple = (value: WireReturnType): value is ReadonlyArray<RobloxValueType> => Array.isArray(value);

const normalizeMember = (member: WireMember): RobloxMember => {
  if (isSingleReturn(member)) return member;
  const first = isValueTuple(member.ReturnType) ? member.ReturnType[0] : member.ReturnType;
  return { ...member, 'ReturnType': first ?? VOID_TYPE };
};

const normalizeClass = (item: WireClass): RobloxClass => {
  const members = item.Members.map(normalizeMember);
  return { ...item, 'Members': members };
};

const isCoherent = (classes: ReadonlyArray<ClassSummary>, enums: ReadonlyArray<RobloxEnum>): boolean => {
  if (classes.length === 0 || enums.length === 0) return false;
  if (hasUniqueNames(classes) === false || hasUniqueNames(enums) === false) return false;
  const names = new Set(classes.map(item => item.Name));
  return REQUIRED_CLASSES.every(name => names.has(name)) && hasAcyclicInheritance(classes);
};

/**
 * Decodes a Roblox API dump, reducing multi-value returns to their first value.
 * @param text - Full-API-Dump JSON.
 * @returns The dump, or `undefined` when it violates the consumed contract.
 */
export const decodeApiDump = (text: string): RobloxApiDump | undefined => {
  const dump = decodeJson(text, isWireApiDump);
  if (dump === undefined || isCoherent(dump.Classes, dump.Enums) === false) return undefined;
  const classes = dump.Classes.map(normalizeClass);
  return { 'Version': dump.Version, 'Classes': classes, 'Enums': dump.Enums };
};

const SUMMARY_KEYS = [
  'Version',
  'Index',
  'Enums',
  'Name',
  'Superclass',
  'Tags',
  'Items',
  'Value',
  'PreferredDescriptorName',
];
const CLASS_KEYS = [
  'Name',
  'Superclass',
  'Tags',
  'Members',
  'MemberType',
  'ValueType',
  'Category',
  'Parameters',
  'Type',
  'Default',
  'ReturnType',
  'PreferredDescriptorName',
];
const CLASSES_OPEN = ',"Classes":[';
const CLASSES_CLOSE = '\n]}\n';
const LINE_FEED = 10;
const COMMA = 44;

/**
 * Serialises a decoded API dump in the `class-lines` layout: a header line holding every class's name, superclass
 * and tags plus all enums, then one class per line. Only fields the language server consumes are kept. The result is
 * ordinary JSON, so `decodeApiDump` accepts it, while `openApiDump` reads the header and defers each class.
 * @param dump - Dump returned by `decodeApiDump`.
 * @returns File bytes.
 */
export const encodeApiDump = (dump: RobloxApiDump): Buffer => {
  const header = JSON.stringify({ 'Version': dump.Version, 'Index': dump.Classes, 'Enums': dump.Enums }, SUMMARY_KEYS);
  const classes = dump.Classes.map(item => JSON.stringify(item, CLASS_KEYS));
  return Buffer.from(`${header.slice(0, -1)}${CLASSES_OPEN}\n${classes.join(',\n')}${CLASSES_CLOSE}`);
};

const isClassSummary = (value: unknown): value is ClassSummary =>
  has(value, 'Name', isString) && has(value, 'Superclass', isString) && hasOptional(value, 'Tags', isTags);

const isApiHeader = (value: unknown): value is ApiHeader =>
  has(value, 'Version', (version: unknown): version is 1 => version === 1) &&
  has(value, 'Index', isArrayOf(isClassSummary)) &&
  has(value, 'Enums', isArrayOf(isEnum));

const lineStarts = (bytes: Buffer, from: number, to: number): ReadonlyArray<number> => {
  const starts: number[] = [];
  for (let start = from; start > 0 && start < to; start = bytes.indexOf(LINE_FEED, start) + 1) starts.push(start);
  return starts;
};

const readMembers = (bytes: Buffer, start: number, lineEnd: number, name: string): ReadonlyArray<RobloxMember> => {
  const end = bytes[lineEnd - 1] === COMMA ? lineEnd - 1 : lineEnd;
  const decoded = decodeJson(bytes.toString('utf-8', start, end), isClass);
  return decoded === undefined || decoded.Name !== name ? [] : decoded.Members.map(normalizeMember);
};

/**
 * Opens a `class-lines` API file without parsing its classes. The header is validated immediately (unique names,
 * required classes, acyclic inheritance, one line per class); each class's members are parsed and validated when
 * first read, and a class whose line is damaged then has no members.
 * @param bytes - File contents.
 * @returns The dump, or `undefined` when the file is not in this layout or its header is invalid.
 */
export const openApiDump = (bytes: Buffer): RobloxApiDump | undefined => {
  const headerEnd = bytes.indexOf(LINE_FEED);
  const closeStart = bytes.length - CLASSES_CLOSE.length;
  if (headerEnd < 0 || closeStart < headerEnd) return undefined;
  const headerText = bytes.toString('utf-8', 0, headerEnd);
  if (headerText.endsWith(CLASSES_OPEN) === false || bytes.toString('latin1', closeStart) !== CLASSES_CLOSE)
    return undefined;
  const header = decodeJson(`${headerText}]}`, isApiHeader);
  if (header === undefined || isCoherent(header.Index, header.Enums) === false) return undefined;
  const starts = lineStarts(bytes, headerEnd + 1, closeStart);
  if (starts.length !== header.Index.length) return undefined;

  const classes = header.Index.map((summary, index): RobloxClass => {
    const start = starts[index] ?? closeStart;
    const lineEnd = (starts[index + 1] ?? closeStart + 1) - 1;
    const members = once(() => readMembers(bytes, start, lineEnd, summary.Name));
    return {
      'Name': summary.Name,
      'Superclass': summary.Superclass,
      'Tags': summary.Tags ?? [],
      get 'Members'() {
        return members();
      },
    };
  });
  return { 'Version': header.Version, 'Classes': classes, 'Enums': header.Enums };
};

const isDocsParam = (value: unknown): value is NonNullable<DocsEntry['params']>[number] =>
  isObject(value) &&
  'name' in value &&
  isString(value.name) &&
  'documentation' in value &&
  isString(value.documentation);

const isDocsParams = isArrayOf(isDocsParam);

/** Checks one documentation entry; every field is optional upstream. */
export const isDocsEntry = (value: unknown): value is DocsEntry => {
  if (isObject(value) === false || Array.isArray(value)) return false;
  if ('documentation' in value && isString(value.documentation) === false) return false;
  if ('learn_more_link' in value && isString(value.learn_more_link) === false) return false;
  if ('code_sample' in value && isString(value.code_sample) === false) return false;
  if ('keys' in value && isStringRecord(value.keys) === false) return false;
  if ('overloads' in value && isStringRecord(value.overloads) === false) return false;
  if ('params' in value && isDocsParams(value.params) === false) return false;
  return 'returns' in value === false || isStringArray(value.returns);
};

const isDocsDatabase = (value: unknown): value is DocsDatabase =>
  isRecordOf(isDocsEntry)(value) && Object.keys(value).length > 0;

/**
 * Decodes an identifier-keyed documentation database.
 * @param text - Docs JSON.
 * @returns The database, or `undefined` when empty or malformed.
 */
export const decodeDocs = (text: string): DocsDatabase | undefined => decodeJson(text, isDocsDatabase);

const isSuncParameter = (value: unknown): value is SuncFunction['params'][number] =>
  has(value, 'name', isString) && has(value, 'type', isString) && hasOptional(value, 'optional', isBoolean);

const isSuncFunction = (value: unknown): value is SuncFunction =>
  has(value, 'name', isString) &&
  has(value, 'params', isArrayOf(isSuncParameter)) &&
  has(value, 'returnType', isString) &&
  hasOptional(value, 'description', isString) &&
  hasOptional(value, 'example', isString);

const isSuncNamespace = (value: unknown): value is SuncApiDefinition['namespaces'][number] =>
  has(value, 'name', isString) && has(value, 'functions', isArrayOf(isSuncFunction));

const isSuncApi = (value: unknown): value is SuncApiDefinition =>
  has(value, 'functions', isArrayOf(isSuncFunction)) && has(value, 'namespaces', isArrayOf(isSuncNamespace));

/**
 * Decodes a custom Sunc API definition.
 * @param text - Sunc API JSON.
 */
export const decodeSuncApi = (text: string): SuncApiDefinition | undefined => decodeJson(text, isSuncApi);

const VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;
const UPLOAD_PATTERN = /^version-[0-9a-f]{16}$/;
const GENERATION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const isVersionNumber = (version: unknown): version is string => isString(version) && VERSION_PATTERN.test(version);

const isStudioVersion = (value: unknown): value is StudioVersion =>
  has(value, 'version', isVersionNumber) &&
  has(
    value,
    'clientVersionUpload',
    (upload: unknown): upload is string => isString(upload) && UPLOAD_PATTERN.test(upload),
  );

/**
 * Decodes the client settings response naming the current Studio build.
 * @param text - Client version JSON.
 */
export const decodeStudioVersion = (text: string): StudioVersion | undefined => decodeJson(text, isStudioVersion);

const isSchema = (schema: unknown): schema is 1 => schema === 1;

const isDigest = (digest: unknown): digest is string => isString(digest) && /^[0-9a-f]{64}$/.test(digest);

const isTimestamp = (timestamp: unknown): timestamp is number => isNumber(timestamp) && timestamp >= 0;

const isGeneration = (generation: unknown): generation is string =>
  isString(generation) && GENERATION_PATTERN.test(generation);

const isDocsLayout = (layout: unknown): layout is DocsLayout => layout === 'sorted-lines';

const isSnapshotManifest = (value: unknown): value is SnapshotManifest =>
  has(value, 'schema', isSchema) &&
  has(value, 'checkedAt', isTimestamp) &&
  has(value, 'apiVersion', isVersionNumber) &&
  has(value, 'apiUpload', isString) &&
  has(value, 'apiFetchedAt', isTimestamp) &&
  has(value, 'docsFetchedAt', isTimestamp) &&
  has(value, 'apiSha256', isDigest) &&
  has(value, 'docsSha256', isDigest) &&
  hasOptional(value, 'docsEtag', isString) &&
  hasOptional(value, 'docsLayout', isDocsLayout);

const isBundledManifest = (value: unknown): value is BundledManifest =>
  has(value, 'schema', isSchema) &&
  hasOptional(value, 'apiVersion', isVersionNumber) &&
  hasOptional(value, 'apiUpload', isString) &&
  hasOptional(value, 'apiFetchedAt', isTimestamp) &&
  hasOptional(value, 'docsFetchedAt', isTimestamp) &&
  hasOptional(value, 'apiSha256', isDigest) &&
  hasOptional(value, 'docsSha256', isDigest) &&
  hasOptional(value, 'docsEtag', isString) &&
  hasOptional(value, 'docsLayout', isDocsLayout) &&
  hasOptional(value, 'luauDocsTag', isString);

/**
 * Decodes the manifest of a cache generation.
 * @param text - Manifest JSON.
 */
export const decodeSnapshotManifest = (text: string): SnapshotManifest | undefined =>
  decodeJson(text, isSnapshotManifest);

/**
 * Decodes the manifest shipped with bundled data.
 * @param text - Manifest JSON.
 */
export const decodeBundledManifest = (text: string): BundledManifest | undefined => decodeJson(text, isBundledManifest);

/**
 * Decodes `current.json`; generations must be plain UUID basenames.
 * @param text - Pointer JSON.
 */
export const decodePointer = (text: string): CachePointer | undefined =>
  decodeJson(
    text,
    (value: unknown): value is CachePointer => has(value, 'schema', isSchema) && has(value, 'generation', isGeneration),
  );

/**
 * Decodes `check.json`.
 * @param text - Check record JSON.
 */
export const decodeCheckRecord = (text: string): CheckRecord | undefined =>
  decodeJson(
    text,
    (value: unknown): value is CheckRecord => has(value, 'schema', isSchema) && has(value, 'attemptedAt', isTimestamp),
  );

/**
 * Decodes the contents of a lock file.
 * @param text - Lock JSON.
 */
export const decodeLock = (text: string): LockRecord | undefined =>
  decodeJson(
    text,
    (value: unknown): value is LockRecord => has(value, 'id', isString) && has(value, 'startedAt', isNumber),
  );

/**
 * Checks that a directory name is a cache generation identifier.
 * @param name - Directory basename.
 */
export const isGenerationName = (name: string): boolean => GENERATION_PATTERN.test(name);

/**
 * Compares dotted numeric versions.
 * @returns Negative, zero or positive like a sort comparator.
 */
export const compareVersions = (left: string, right: string): number => {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i++) {
    const difference = (leftParts[i] ?? 0) - (rightParts[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};
