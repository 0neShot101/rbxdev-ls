/**
 * Escapes a value for safe embedding inside a double-quoted Lua string literal, including NUL bytes.
 * @param value - Raw text to embed.
 * @returns The escaped literal body.
 */
export const escapeLuaString = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/"/g, '\\"')
    .replace(/\0/g, '\\000');

/**
 * Removes the game tree's `\0index` duplicate-name marker from a path segment.
 * @param segment - Path segment, possibly carrying a marker.
 * @returns The instance name without its marker.
 */
export const stripMarker = (segment: string): string =>
  segment.includes('\0') ? segment.slice(0, segment.indexOf('\0')) : segment;

/**
 * Removes duplicate-name markers from every path segment.
 * @param segments - Game tree path segments.
 * @returns The instance names without markers.
 */
export const stripMarkers = (segments: ReadonlyArray<string>): string[] => segments.map(stripMarker);

/**
 * Formats game tree path segments as a `game.` dotted path.
 * @param segments - Game tree path segments.
 * @returns The dotted path without markers.
 */
export const formatGamePath = (segments: ReadonlyArray<string>): string => `game.${stripMarkers(segments).join('.')}`;

/**
 * Builds a Lua expression that resolves an instance from path segments.
 * @param segments - Service name followed by child names.
 * @returns A GetService/FindFirstChild chain, or `nil` for an empty path.
 */
export const toLuaLookup = (segments: ReadonlyArray<string>): string => {
  const serviceName = segments[0];
  if (serviceName === undefined) return 'nil';

  let lookup = `game:GetService("${escapeLuaString(serviceName)}")`;
  for (const segment of segments.slice(1)) lookup += `:FindFirstChild("${escapeLuaString(segment)}")`;
  return lookup;
};
