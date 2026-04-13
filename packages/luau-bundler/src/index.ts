/**
 * Luau module bundler that combines multiple .lua/.luau files into a single
 * self-contained script with a require shim.
 *
 * Based on work by Expo (https://codeberg.org/Expo).
 *
 * @module luau-bundler
 */

export { bundle, resolveRojoProject } from './bundler';
export type { BundleResult, BundlerOptions, RojoProject } from './types/bundler';
