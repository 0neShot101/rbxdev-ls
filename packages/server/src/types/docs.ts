/** Documentation for a single parameter of a documented API member. */
export interface DocsParam {
  readonly name: string;
  readonly documentation: string;
}

/** Documentation record for one API symbol in a docs database; every field is optional upstream. */
export interface DocsEntry {
  readonly documentation?: string;
  readonly learn_more_link?: string;
  readonly code_sample?: string;
  readonly keys?: Readonly<Record<string, string>>;
  readonly overloads?: Readonly<Record<string, string>>;
  readonly params?: ReadonlyArray<DocsParam>;
  readonly returns?: ReadonlyArray<string>;
}

/** Roblox or Luau API documentation keyed by docs symbol (e.g. `@roblox/globaltype/Instance.Name`, `@luau/global/print`). */
export type DocsDatabase = Readonly<Record<string, DocsEntry>>;

/** Keyed access to documentation entries without requiring the whole database in memory. */
export interface DocsSource {
  readonly get: (symbol: string) => DocsEntry | undefined;
}
