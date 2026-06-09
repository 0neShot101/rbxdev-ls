export const escapeLuaString = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/"/g, '\\"');

export const createLuaLookupFromPath = (segments: ReadonlyArray<string>): string => {
  const serviceName = segments[0];
  if (serviceName === undefined) return 'nil';

  let lookup = `game:GetService("${escapeLuaString(serviceName)}")`;
  for (const segment of segments.slice(1)) lookup += `:FindFirstChild("${escapeLuaString(segment)}")`;
  return lookup;
};
