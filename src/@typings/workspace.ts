export interface RojoTree {
  readonly $className?: string;
  readonly $path?: string;
  readonly $ignoreUnknownInstances?: boolean;
  readonly [childName: string]: RojoTree | string | boolean | undefined;
}

export interface RojoProject {
  readonly name: string;
  readonly tree: RojoTree;
  readonly globIgnorePaths?: ReadonlyArray<string>;
  readonly servePort?: number;
  readonly servePlaceIds?: ReadonlyArray<number>;
}

export interface DataModelNode {
  readonly name: string;
  readonly className: string;
  readonly filePath?: string;
  readonly children: Map<string, DataModelNode>;
}

export interface RojoState {
  readonly project: RojoProject | undefined;
  readonly dataModel: DataModelNode | undefined;
  readonly projectPath: string | undefined;
}

export interface ModuleExport {
  readonly name: string;
  readonly kind: 'function' | 'table' | 'value' | 'type';
  readonly modulePath: string;
  readonly filePath: string;
}

export interface ModuleInfo {
  readonly filePath: string;
  readonly dataModelPath: string[];
  readonly exports: ModuleExport[];
  readonly lastModified: number;
}

export interface ModuleFileEntry {
  readonly name: string;
  readonly ext: '.lua' | '.luau';
  readonly isFolder: boolean;
  readonly filePath: string;
  readonly exports: ModuleExport[];
}

export interface Position {
  readonly line: number;
  readonly character: number;
}

export interface Range {
  readonly start: Position;
  readonly end: Position;
}

export interface Location {
  readonly uri: string;
  readonly range: Range;
}
