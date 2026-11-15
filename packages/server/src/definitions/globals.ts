import { createTypeEnvironment } from '@analyzer/environment';
import { installBuiltins } from '@definitions/builtins';
import { installInstanceConstructors } from '@definitions/constructors/instances';
import { installMathConstructors } from '@definitions/constructors/math';
import { installValueConstructors } from '@definitions/constructors/values';
import { createDataTypeInstances } from '@definitions/dataTypes';
import { loadDefinitions } from '@definitions/loader';
import { addLuarmorGlobals } from '@definitions/luarmor';
import { addLuraphGlobals } from '@definitions/luraph';
import { collectClassCatalogues, convertRobloxApiToTypes } from '@definitions/roblox';
import { installRoots } from '@definitions/roots';
import { installSettings } from '@definitions/settings';
import { getDefaultSuncApi, installSunc } from '@definitions/sunc';
import { installVector } from '@definitions/vector';

import type { GlobalEnvironment, LoadedDefinitions } from '@typings/definitions';
import type { TypeEnvironment } from '@typings/environment';
import type { LuauType } from '@typings/types';

const publishGlobals = (globals: ReadonlyMap<string, LuauType>): TypeEnvironment => {
  const env = createTypeEnvironment();
  for (const [name, type] of globals)
    env.globalScope.symbols.set(name, {
      'kind': 'Global',
      'declarationLocation': undefined,
      'docComment': undefined,
      name,
      type,
      'mutable': false,
    });

  return env;
};

/** Builds the complete global environment by combining Roblox, standard library, and executor API definitions. */
export const buildGlobalEnvironment = (definitions?: LoadedDefinitions): GlobalEnvironment => {
  const loaded = definitions ?? loadDefinitions();
  const converted =
    loaded.roblox === undefined
      ? {
          'classes': new Map<string, LuauType>(),
          'enums': new Map<string, LuauType>(),
          'dataTypes': createDataTypeInstances(),
        }
      : convertRobloxApiToTypes(loaded.roblox);

  const globals = new Map<string, LuauType>();
  installRoots(globals, converted.classes, converted.enums);
  installMathConstructors(globals);
  installInstanceConstructors(globals);
  installValueConstructors(globals);
  installSettings(globals);
  installVector(globals);
  installBuiltins(globals);
  installSunc(globals, loaded.sunc ?? getDefaultSuncApi());

  const env = publishGlobals(globals);
  for (const [name, classType] of converted.classes) if (classType.kind === 'Class') env.classes.set(name, classType);

  addLuarmorGlobals(env);
  addLuraphGlobals(env);

  return {
    env,
    'robloxClasses': converted.classes,
    'robloxEnums': converted.enums,
    'robloxDataTypes': converted.dataTypes,
    get 'robloxDocs'() {
      return loaded.robloxDocs;
    },
    get 'luauDocs'() {
      return loaded.luauDocs;
    },
    ...collectClassCatalogues(loaded.roblox),
  };
};

/** Creates a minimal global environment with only the Luau builtins, standard libraries and legacy globals. */
export const createEmptyGlobalEnvironment = (): GlobalEnvironment => {
  const globals = new Map<string, LuauType>();
  installBuiltins(globals);
  return {
    'env': publishGlobals(globals),
    'robloxClasses': new Map(),
    'robloxEnums': new Map(),
    'robloxDataTypes': new Map(),
    ...collectClassCatalogues(undefined),
  };
};
