/** Semantic version component to increment. */
export type VersionBump = 'major' | 'minor' | 'patch';

/** Fields of the extension manifest the build pipeline rewrites. */
export interface PackageMetadata {
  readonly version: string;
  readonly displayName: string;
  readonly description: string;
}
