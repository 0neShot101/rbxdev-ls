import type { LuauType } from '@typings/types';

/** One instance entry of a Rojo `sourcemap.json` tree. */
export interface SourcemapNode {
  readonly name: string;
  readonly className: string;
  readonly filePaths?: ReadonlyArray<string>;
  readonly children?: ReadonlyArray<SourcemapNode>;
}

/** A Rojo project tree node; `$`-prefixed keys are metadata, other keys are child instances. */
export interface RojoTree {
  readonly $className?: string;
  readonly $path?: string;
  readonly $ignoreUnknownInstances?: boolean;
  readonly [childName: string]: RojoTree | string | boolean | undefined;
}

/** The consumed fields of a Rojo `*.project.json` file. */
export interface RojoProject {
  readonly name: string;
  readonly tree: RojoTree;
  readonly globIgnorePaths?: ReadonlyArray<string>;
  readonly servePort?: number;
  readonly servePlaceIds?: ReadonlyArray<number>;
}

/** An instance in the DataModel reconstructed from a Rojo project or sourcemap. */
export interface DataModelNode {
  readonly name: string;
  readonly className: string;
  readonly filePath?: string;
  readonly children: Map<string, DataModelNode>;
}

/** The loaded Rojo project and its DataModel, when a project file was found. */
export interface RojoState {
  readonly project: RojoProject | undefined;
  readonly dataModel: DataModelNode | undefined;
  readonly projectPath: string | undefined;
}

/** A parameter of an exported module function signature. */
export interface ModuleExportSignatureParam {
  readonly name: string | undefined;
  readonly type: LuauType;
  readonly optional: boolean;
}

/** The callable signature of an exported module function. */
export interface ModuleExportSignature {
  readonly params: ReadonlyArray<ModuleExportSignatureParam>;
  readonly returnType: LuauType;
  readonly isVariadic: boolean;
}

/** A symbol exported by a workspace ModuleScript. */
export interface ModuleExport {
  readonly name: string;
  readonly kind: 'function' | 'table' | 'value' | 'type';
  readonly modulePath: string;
  readonly filePath: string;
  readonly signature?: ModuleExportSignature;
}

/** Indexed information about one workspace module. */
export interface ModuleInfo {
  readonly filePath: string;
  readonly dataModelPath: string[];
  readonly exports: ModuleExport[];
  readonly lastModified: number;
}

/** A module file or folder candidate found while listing a directory. */
export interface ModuleFileEntry {
  readonly name: string;
  readonly ext: '.lua' | '.luau';
  readonly isFolder: boolean;
  readonly filePath: string;
  readonly exports: ModuleExport[];
}

/** A zero-based line/character position. */
export interface Position {
  readonly line: number;
  readonly character: number;
}

/** A half-open range between two positions. */
export interface Range {
  readonly start: Position;
  readonly end: Position;
}

/** A range inside a document identified by URI. */
export interface Location {
  readonly uri: string;
  readonly range: Range;
}
