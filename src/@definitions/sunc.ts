/**
 * Sunc Executor API Definitions
 *
 * This module provides type definitions and conversion utilities for the Sunc executor API.
 * Sunc is a Roblox script executor, and this module defines types for its custom functions,
 * namespaces, and HTTP request/response structures. Based on https://sunc.su/ documentation.
 */

import {
  AnyType,
  BooleanType,
  createFunctionType,
  createTableType,
  NilType,
  NumberType,
  StringType,
  type FunctionParam,
  type FunctionType,
  type LuauType,
  type TableType,
} from '@typings/types';

/**
 * HTTP Request Options table type for the request() function.
 *
 * This type defines the structure of the options table passed to HTTP request functions
 * in executor environments. It includes URL, HTTP method, headers, body, and cookies.
 */
export const RequestOptionsType: TableType = createTableType(
  new Map([
    ['Url', { 'type': StringType, 'readonly': false, 'optional': false }],
    ['Method', { 'type': StringType, 'readonly': false, 'optional': true }],
    [
      'Headers',
      {
        'type': createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': StringType } }),
        'readonly': false,
        'optional': true,
      },
    ],
    ['Body', { 'type': StringType, 'readonly': false, 'optional': true }],
    [
      'Cookies',
      {
        'type': createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': StringType } }),
        'readonly': false,
        'optional': true,
      },
    ],
  ]),
);

/**
 * HTTP Response table type returned by the request() function.
 *
 * This type defines the structure of the response object returned from HTTP requests,
 * including success status, status code, status message, response headers, and body.
 */
export const RequestResponseType: TableType = createTableType(
  new Map([
    ['Success', { 'type': BooleanType, 'readonly': true, 'optional': false }],
    ['StatusCode', { 'type': NumberType, 'readonly': true, 'optional': false }],
    ['StatusMessage', { 'type': StringType, 'readonly': true, 'optional': false }],
    [
      'Headers',
      {
        'type': createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': StringType } }),
        'readonly': true,
        'optional': false,
      },
    ],
    ['Body', { 'type': StringType, 'readonly': true, 'optional': false }],
  ]),
);

/**
 * Represents the complete Sunc API definition structure.
 *
 * This interface models the top-level structure of the Sunc API, containing
 * global functions and namespaces (like debug, Drawing, etc.).
 */
export interface SuncApiDefinition {
  /** Array of all global functions provided by the executor */
  readonly functions: ReadonlyArray<SuncFunction>;
  /** Array of namespaces containing grouped functions */
  readonly namespaces: ReadonlyArray<SuncNamespace>;
}

/**
 * Represents a function definition in the Sunc API.
 *
 * This interface models a single function with its parameters, return type,
 * and optional documentation.
 */
export interface SuncFunction {
  /** The name of the function (e.g., 'hookfunction', 'getgenv', 'readfile') */
  readonly name: string;
  /** Array of parameters the function accepts */
  readonly params: ReadonlyArray<SuncParameter>;
  /** The return type as a string (e.g., 'boolean', 'table', 'Instance') */
  readonly returnType: string;
  /** Optional description of what the function does */
  readonly description?: string;
  /** Optional code example demonstrating usage */
  readonly example?: string;
}

/**
 * Represents a parameter in a Sunc function definition.
 */
export interface SuncParameter {
  /** The name of the parameter */
  readonly name: string;
  /** The type of the parameter as a string */
  readonly type: string;
  /** Whether the parameter is optional (defaults to false) */
  readonly optional?: boolean;
}

/**
 * Represents a namespace in the Sunc API.
 *
 * Namespaces group related functions together, such as the 'debug' namespace
 * for debugging utilities or the 'Drawing' namespace for rendering.
 */
export interface SuncNamespace {
  /** The name of the namespace (e.g., 'debug', 'Drawing') */
  readonly name: string;
  /** Array of functions contained within this namespace */
  readonly functions: ReadonlyArray<SuncFunction>;
}

/**
 * Converts a Sunc type name string to a Luau type representation.
 *
 * This function handles common type names used in the Sunc API, including
 * primitives (string, number, boolean), special types (function, table, thread),
 * and union types (using '|' separator).
 *
 * @param typeName - The type name as a string from the Sunc API definition
 * @returns The corresponding LuauType representation
 */
const suncTypeToLuau = (typeName: string): LuauType => {
  switch (typeName.toLowerCase()) {
    case 'string':
      return StringType;
    case 'number':
    case 'int':
    case 'integer':
      return NumberType;
    case 'boolean':
    case 'bool':
      return BooleanType;
    case 'nil':
    case 'void':
      return NilType;
    case 'any':
      return AnyType;
    case 'function':
      return createFunctionType([], AnyType, { 'isVariadic': true });
    case 'table':
      return createTableType(new Map());
    case 'thread':
      return { 'kind': 'Primitive', 'name': 'thread' };
    case 'userdata':
      return AnyType;
    case 'instance':
      return { 'kind': 'TypeReference', 'name': 'Instance' };
    default:
      if (typeName.includes('|')) {
        const types = typeName.split('|').map(t => suncTypeToLuau(t.trim()));
        return { 'kind': 'Union', 'types': types };
      }
      return { 'kind': 'TypeReference', 'name': typeName };
  }
};

/**
 * Converts an array of Sunc parameters to Luau function parameters.
 *
 * @param params - Array of Sunc parameter definitions to convert
 * @returns Array of FunctionParam objects for use in Luau function types
 */
const convertSuncParams = (params: ReadonlyArray<SuncParameter>): FunctionParam[] =>
  params.map(p => ({
    'name': p.name,
    'type': suncTypeToLuau(p.type),
    'optional': p.optional === true,
  }));

/**
 * Converts a Sunc function definition to a Luau FunctionType.
 *
 * This function converts all parameters and the return type, and preserves
 * any description or example documentation from the original definition.
 *
 * @param func - The Sunc function definition to convert
 * @returns A FunctionType representing the function in the Luau type system
 */
const convertSuncFunction = (func: SuncFunction): FunctionType => {
  const options: { description?: string; example?: string } = {};
  if (func.description !== undefined) options.description = func.description;
  if (func.example !== undefined) options.example = func.example;
  return createFunctionType(convertSuncParams(func.params), suncTypeToLuau(func.returnType), options);
};

/**
 * Returns the default Sunc API definition with all standard executor functions.
 *
 * This function provides a comprehensive set of executor API definitions including:
 * - Closure manipulation (hookfunction, clonefunction, newcclosure, etc.)
 * - Drawing utilities (cleardrawcache, isrenderobj, etc.)
 * - Encoding functions (base64encode, base64decode, lz4compress, lz4decompress)
 * - Environment access (getgenv, getrenv, getgc, filtergc)
 * - Filesystem operations (readfile, writefile, isfile, isfolder, etc.)
 * - Instance utilities (cloneref, gethui, getinstances, etc.)
 * - Metatable manipulation (getrawmetatable, setreadonly, hookmetamethod)
 * - Reflection (gethiddenproperty, setthreadidentity, isscriptable)
 * - Script utilities (getscripts, getsenv, loadstring)
 * - Signal manipulation (firesignal, getconnections)
 * - Miscellaneous (identifyexecutor, request, setclipboard)
 *
 * @returns A complete SuncApiDefinition with all standard functions and namespaces
 */
export const getDefaultSuncApi = (): SuncApiDefinition => ({
  'functions': [
    // Closures
    {
      'name': 'checkcaller',
      'params': [],
      'returnType': 'boolean',
      'description':
        'Returns true if the current thread was created by the executor. Useful for detecting if code is running in an executor context.',
      'example': 'if checkcaller() then\n    print("Running from executor")\nend',
    },
    {
      'name': 'clonefunction',
      'params': [{ 'name': 'func', 'type': 'function' }],
      'returnType': 'function',
      'description':
        'Creates and returns a copy of the given function. The cloned function behaves identically to the original.',
      'example':
        'local original = function() return "hello" end\nlocal cloned = clonefunction(original)\nprint(cloned()) -- "hello"',
    },
    {
      'name': 'hookfunction',
      'params': [
        { 'name': 'target', 'type': 'function' },
        { 'name': 'hook', 'type': 'function' },
      ],
      'returnType': 'function',
      'description':
        'Replaces the target function with the hook function. Returns the original function so it can still be called.',
      'example': 'local oldPrint = hookfunction(print, function(...)\n    return oldPrint("[Hook]", ...)\nend)',
    },
    {
      'name': 'hookmetamethod',
      'params': [
        { 'name': 'object', 'type': 'any' },
        { 'name': 'metamethod', 'type': 'string' },
        { 'name': 'hook', 'type': 'function' },
      ],
      'returnType': 'function',
      'description': 'Hooks a metamethod on the given object. Returns the original metamethod function.',
      'example':
        'local old = hookmetamethod(game, "__namecall", function(self, ...)\n    local method = getnamecallmethod()\n    return old(self, ...)\nend)',
    },
    {
      'name': 'iscclosure',
      'params': [{ 'name': 'func', 'type': 'function' }],
      'returnType': 'boolean',
      'description': 'Returns true if the given function is a C closure (written in C/C++), false otherwise.',
      'example': 'print(iscclosure(print)) -- true\nprint(iscclosure(function() end)) -- false',
    },
    {
      'name': 'isexecutorclosure',
      'params': [{ 'name': 'func', 'type': 'function' }],
      'returnType': 'boolean',
      'description': 'Returns true if the given function was created by the executor.',
      'example':
        'local myFunc = function() end\nprint(isexecutorclosure(myFunc)) -- true\nprint(isexecutorclosure(print)) -- false',
    },
    {
      'name': 'islclosure',
      'params': [{ 'name': 'func', 'type': 'function' }],
      'returnType': 'boolean',
      'description': 'Returns true if the given function is a Lua closure (written in Lua), false otherwise.',
      'example': 'print(islclosure(function() end)) -- true\nprint(islclosure(print)) -- false',
    },
    {
      'name': 'newcclosure',
      'params': [{ 'name': 'func', 'type': 'function' }],
      'returnType': 'function',
      'description':
        'Wraps a Lua function in a C closure, making it appear as a C function. Useful for avoiding detection.',
      'example': 'local wrapped = newcclosure(function()\n    return "hello"\nend)\nprint(iscclosure(wrapped)) -- true',
    },
    {
      'name': 'restorefunction',
      'params': [{ 'name': 'func', 'type': 'function' }],
      'returnType': 'void',
      'description': 'Restores a hooked function to its original state.',
      'example': 'hookfunction(print, function() end)\nrestorefunction(print)\nprint("works again")',
    },

    // Drawing
    {
      'name': 'cleardrawcache',
      'params': [],
      'returnType': 'void',
      'description': 'Clears all cached drawing objects from memory.',
      'example': 'cleardrawcache()',
    },
    {
      'name': 'getrenderproperty',
      'params': [
        { 'name': 'obj', 'type': 'any' },
        { 'name': 'property', 'type': 'string' },
      ],
      'returnType': 'any',
      'description': 'Gets a property value from a Drawing object.',
      'example': 'local line = Drawing.new("Line")\nlocal thickness = getrenderproperty(line, "Thickness")',
    },
    {
      'name': 'isrenderobj',
      'params': [{ 'name': 'obj', 'type': 'any' }],
      'returnType': 'boolean',
      'description': 'Returns true if the given object is a valid Drawing object.',
      'example': 'local line = Drawing.new("Line")\nprint(isrenderobj(line)) -- true',
    },
    {
      'name': 'setrenderproperty',
      'params': [
        { 'name': 'obj', 'type': 'any' },
        { 'name': 'property', 'type': 'string' },
        { 'name': 'value', 'type': 'any' },
      ],
      'returnType': 'void',
      'description': 'Sets a property value on a Drawing object.',
      'example': 'local line = Drawing.new("Line")\nsetrenderproperty(line, "Thickness", 2)',
    },

    // Encoding
    {
      'name': 'base64decode',
      'params': [{ 'name': 'data', 'type': 'string' }],
      'returnType': 'string',
      'description': 'Decodes a Base64 encoded string back to its original form.',
      'example': 'local decoded = base64decode("SGVsbG8gV29ybGQ=")\nprint(decoded) -- "Hello World"',
    },
    {
      'name': 'base64encode',
      'params': [{ 'name': 'data', 'type': 'string' }],
      'returnType': 'string',
      'description': 'Encodes a string to Base64 format.',
      'example': 'local encoded = base64encode("Hello World")\nprint(encoded) -- "SGVsbG8gV29ybGQ="',
    },
    {
      'name': 'lz4compress',
      'params': [{ 'name': 'data', 'type': 'string' }],
      'returnType': 'string',
      'description': 'Compresses a string using LZ4 compression algorithm.',
      'example': 'local compressed = lz4compress("Hello World")',
    },
    {
      'name': 'lz4decompress',
      'params': [{ 'name': 'data', 'type': 'string' }],
      'returnType': 'string',
      'description': 'Decompresses an LZ4 compressed string.',
      'example': 'local original = lz4decompress(compressed)',
    },

    // Environment
    {
      'name': 'getgc',
      'params': [{ 'name': 'includeTables', 'type': 'boolean', 'optional': true }],
      'returnType': 'table',
      'description': 'Returns all objects currently tracked by the garbage collector. Pass true to include tables.',
      'example':
        'local gc = getgc(true)\nfor _, obj in ipairs(gc) do\n    if type(obj) == "function" then\n        -- process function\n    end\nend',
    },
    {
      'name': 'getgenv',
      'params': [],
      'returnType': 'table',
      'description':
        "Returns the executor's global environment table. Variables set here persist across script executions.",
      'example': 'getgenv().myGlobal = "shared value"\nprint(getgenv().myGlobal)',
    },
    {
      'name': 'getreg',
      'params': [],
      'returnType': 'table',
      'description': 'Returns the Lua registry table.',
      'example': 'local registry = getreg()\nfor k, v in pairs(registry) do\n    print(k, v)\nend',
    },
    {
      'name': 'getrenv',
      'params': [],
      'returnType': 'table',
      'description': "Returns Roblox's global environment table (_G equivalent for the game).",
      'example': 'local renv = getrenv()\nprint(renv.game) -- same as game',
    },
    {
      'name': 'filtergc',
      'params': [
        { 'name': 'type', 'type': 'string' },
        { 'name': 'options', 'type': 'table' },
      ],
      'returnType': 'table',
      'description': 'Filters garbage collected objects by type and additional options.',
      'example': 'local funcs = filtergc("function", {\n    Name = "MyFunction"\n})',
    },

    // Filesystem
    {
      'name': 'appendfile',
      'params': [
        { 'name': 'path', 'type': 'string' },
        { 'name': 'content', 'type': 'string' },
      ],
      'returnType': 'void',
      'description': 'Appends content to the end of a file. Creates the file if it does not exist.',
      'example': 'appendfile("log.txt", "New log entry\\n")',
    },
    {
      'name': 'delfile',
      'params': [{ 'name': 'path', 'type': 'string' }],
      'returnType': 'void',
      'description': 'Deletes a file at the specified path.',
      'example': 'delfile("temp.txt")',
    },
    {
      'name': 'delfolder',
      'params': [{ 'name': 'path', 'type': 'string' }],
      'returnType': 'void',
      'description': 'Deletes a folder at the specified path.',
      'example': 'delfolder("MyFolder")',
    },
    {
      'name': 'getcustomasset',
      'params': [{ 'name': 'path', 'type': 'string' }],
      'returnType': 'string',
      'description': 'Returns a content URL for a local file that can be used with Roblox APIs.',
      'example': 'local imageLabel = Instance.new("ImageLabel")\nimageLabel.Image = getcustomasset("image.png")',
    },
    {
      'name': 'isfile',
      'params': [{ 'name': 'path', 'type': 'string' }],
      'returnType': 'boolean',
      'description': 'Returns true if the path points to an existing file.',
      'example': 'if isfile("config.json") then\n    local config = readfile("config.json")\nend',
    },
    {
      'name': 'isfolder',
      'params': [{ 'name': 'path', 'type': 'string' }],
      'returnType': 'boolean',
      'description': 'Returns true if the path points to an existing folder.',
      'example': 'if isfolder("MyData") == false then\n    makefolder("MyData")\nend',
    },
    {
      'name': 'listfiles',
      'params': [{ 'name': 'path', 'type': 'string' }],
      'returnType': 'table',
      'description': 'Returns an array of file and folder paths within the specified directory.',
      'example': 'local files = listfiles("MyFolder")\nfor _, file in ipairs(files) do\n    print(file)\nend',
    },
    {
      'name': 'makefolder',
      'params': [{ 'name': 'path', 'type': 'string' }],
      'returnType': 'void',
      'description': 'Creates a new folder at the specified path.',
      'example': 'makefolder("MyData")\nmakefolder("MyData/SubFolder")',
    },
    {
      'name': 'readfile',
      'params': [{ 'name': 'path', 'type': 'string' }],
      'returnType': 'string',
      'description': 'Reads and returns the contents of a file as a string.',
      'example':
        'local content = readfile("config.json")\nlocal config = game:GetService("HttpService"):JSONDecode(content)',
    },
    {
      'name': 'writefile',
      'params': [
        { 'name': 'path', 'type': 'string' },
        { 'name': 'content', 'type': 'string' },
      ],
      'returnType': 'void',
      'description': 'Writes content to a file, creating it if it does not exist or overwriting it if it does.',
      'example': 'writefile("config.json", \'{"enabled": true}\')',
    },
    {
      'name': 'loadfile',
      'params': [{ 'name': 'path', 'type': 'string' }],
      'returnType': 'function|nil',
      'description': 'Loads a Lua file and returns it as a function. Returns nil on error.',
      'example': 'local fn = loadfile("script.lua")\nif fn then fn() end',
    },

    // Instances
    {
      'name': 'cloneref',
      'params': [{ 'name': 'instance', 'type': 'Instance' }],
      'returnType': 'Instance',
      'description':
        'Creates a reference clone of an Instance. The clone shares the same underlying object but has a different reference.',
      'example':
        'local ref = cloneref(game.Players.LocalPlayer)\nprint(ref == game.Players.LocalPlayer) -- false\nprint(ref.Name == game.Players.LocalPlayer.Name) -- true',
    },
    {
      'name': 'compareinstances',
      'params': [
        { 'name': 'a', 'type': 'Instance' },
        { 'name': 'b', 'type': 'Instance' },
      ],
      'returnType': 'boolean',
      'description':
        'Compares two instances, returning true if they reference the same underlying object (works with cloneref).',
      'example': 'local ref = cloneref(workspace)\nprint(compareinstances(ref, workspace)) -- true',
    },
    {
      'name': 'fireclickdetector',
      'params': [{ 'name': 'detector', 'type': 'Instance' }],
      'returnType': 'void',
      'description': 'Simulates a click on a ClickDetector.',
      'example': 'local detector = workspace.Part.ClickDetector\nfireclickdetector(detector)',
    },
    {
      'name': 'fireproximityprompt',
      'params': [{ 'name': 'prompt', 'type': 'Instance' }],
      'returnType': 'void',
      'description': 'Triggers a ProximityPrompt as if the player interacted with it.',
      'example': 'local prompt = workspace.Part.ProximityPrompt\nfireproximityprompt(prompt)',
    },
    {
      'name': 'firetouchinterest',
      'params': [
        { 'name': 'part', 'type': 'Instance' },
        { 'name': 'touchingPart', 'type': 'Instance' },
        { 'name': 'toggle', 'type': 'number' },
      ],
      'returnType': 'void',
      'description': 'Fires a touch event between two parts. Toggle 0 = TouchEnded, 1 = Touched.',
      'example':
        'local hrp = game.Players.LocalPlayer.Character.HumanoidRootPart\nfiretouchinterest(hrp, workspace.TouchPart, 1)',
    },
    {
      'name': 'getcallbackvalue',
      'params': [
        { 'name': 'instance', 'type': 'Instance' },
        { 'name': 'name', 'type': 'string' },
      ],
      'returnType': 'function|nil',
      'description': 'Gets the callback function assigned to an Instance property like OnClientInvoke.',
      'example': 'local callback = getcallbackvalue(remoteFunction, "OnClientInvoke")',
    },
    {
      'name': 'gethui',
      'params': [],
      'returnType': 'Instance',
      'description': 'Returns a hidden GUI container that is not visible in the Explorer.',
      'example': 'local gui = Instance.new("ScreenGui")\ngui.Parent = gethui()',
    },
    {
      'name': 'getinstances',
      'params': [],
      'returnType': 'table',
      'description': 'Returns an array of all Instances in the game.',
      'example':
        'local instances = getinstances()\nfor _, inst in ipairs(instances) do\n    print(inst.ClassName)\nend',
    },
    {
      'name': 'getnilinstances',
      'params': [],
      'returnType': 'table',
      'description': 'Returns an array of all Instances with nil parent.',
      'example':
        'local nilInstances = getnilinstances()\nfor _, inst in ipairs(nilInstances) do\n    print(inst.Name)\nend',
    },

    // Metatable
    {
      'name': 'getnamecallmethod',
      'params': [],
      'returnType': 'string',
      'description': 'Returns the method name used in the current __namecall metamethod invocation.',
      'example':
        'hookmetamethod(game, "__namecall", function(self, ...)\n    local method = getnamecallmethod()\n    print("Called:", method)\nend)',
    },
    {
      'name': 'getrawmetatable',
      'params': [{ 'name': 'obj', 'type': 'any' }],
      'returnType': 'table|nil',
      'description': 'Returns the metatable of an object, bypassing __metatable protection.',
      'example': 'local mt = getrawmetatable(game)\nprint(mt.__index)',
    },
    {
      'name': 'isreadonly',
      'params': [{ 'name': 'tbl', 'type': 'table' }],
      'returnType': 'boolean',
      'description': 'Returns true if the table is marked as read-only.',
      'example': 'local mt = getrawmetatable(game)\nprint(isreadonly(mt)) -- true',
    },
    {
      'name': 'setrawmetatable',
      'params': [
        { 'name': 'obj', 'type': 'any' },
        { 'name': 'mt', 'type': 'table|nil' },
      ],
      'returnType': 'void',
      'description': 'Sets the metatable of an object, bypassing __metatable protection.',
      'example': 'setrawmetatable(myTable, { __index = function() return "default" end })',
    },
    {
      'name': 'setreadonly',
      'params': [
        { 'name': 'tbl', 'type': 'table' },
        { 'name': 'readonly', 'type': 'boolean' },
      ],
      'returnType': 'void',
      'description': 'Sets whether a table is read-only. Must disable read-only to modify protected tables.',
      'example':
        'local mt = getrawmetatable(game)\nsetreadonly(mt, false)\n-- now you can modify mt\nsetreadonly(mt, true)',
    },

    // Reflection
    {
      'name': 'gethiddenproperty',
      'params': [
        { 'name': 'instance', 'type': 'Instance' },
        { 'name': 'property', 'type': 'string' },
      ],
      'returnType': 'any',
      'description': 'Gets the value of a hidden/non-scriptable property on an Instance.',
      'example': 'local size = gethiddenproperty(workspace.Terrain, "MaxExtents")',
    },
    {
      'name': 'getthreadidentity',
      'params': [],
      'returnType': 'number',
      'description': "Returns the current thread's security identity level.",
      'example': 'print(getthreadidentity()) -- typically 2 for executor scripts',
    },
    {
      'name': 'isscriptable',
      'params': [
        { 'name': 'instance', 'type': 'Instance' },
        { 'name': 'property', 'type': 'string' },
      ],
      'returnType': 'boolean',
      'description': 'Returns true if the property is scriptable (accessible from Lua).',
      'example': 'print(isscriptable(workspace, "Name")) -- true',
    },
    {
      'name': 'sethiddenproperty',
      'params': [
        { 'name': 'instance', 'type': 'Instance' },
        { 'name': 'property', 'type': 'string' },
        { 'name': 'value', 'type': 'any' },
      ],
      'returnType': 'void',
      'description': 'Sets the value of a hidden/non-scriptable property on an Instance.',
      'example': 'sethiddenproperty(part, "Archivable", true)',
    },
    {
      'name': 'setscriptable',
      'params': [
        { 'name': 'instance', 'type': 'Instance' },
        { 'name': 'property', 'type': 'string' },
        { 'name': 'scriptable', 'type': 'boolean' },
      ],
      'returnType': 'void',
      'description': 'Sets whether a property is scriptable (accessible from Lua).',
      'example': 'setscriptable(part, "HiddenProp", true)',
    },
    {
      'name': 'setthreadidentity',
      'params': [{ 'name': 'identity', 'type': 'number' }],
      'returnType': 'void',
      'description': "Sets the current thread's security identity level.",
      'example': 'setthreadidentity(8) -- Set to highest identity',
    },

    // Scripts
    {
      'name': 'getcallingscript',
      'params': [],
      'returnType': 'Instance|nil',
      'description': 'Returns the script that called the current function, or nil if called from executor.',
      'example': 'local caller = getcallingscript()\nif caller then print(caller:GetFullName()) end',
    },
    {
      'name': 'getloadedmodules',
      'params': [],
      'returnType': 'table',
      'description': 'Returns an array of all loaded ModuleScripts.',
      'example': 'local modules = getloadedmodules()\nfor _, mod in ipairs(modules) do\n    print(mod.Name)\nend',
    },
    {
      'name': 'getrunningscripts',
      'params': [],
      'returnType': 'table',
      'description': 'Returns an array of all currently running scripts.',
      'example':
        'local scripts = getrunningscripts()\nfor _, script in ipairs(scripts) do\n    print(script:GetFullName())\nend',
    },
    {
      'name': 'getscriptbytecode',
      'params': [{ 'name': 'script', 'type': 'Instance' }],
      'returnType': 'string',
      'description': 'Returns the compiled Luau bytecode of a script.',
      'example': 'local bytecode = getscriptbytecode(script)\nprint(#bytecode .. " bytes")',
    },
    {
      'name': 'getscriptclosure',
      'params': [{ 'name': 'script', 'type': 'Instance' }],
      'returnType': 'function',
      'description': 'Returns the function that would be executed when the script runs.',
      'example': 'local closure = getscriptclosure(moduleScript)\nlocal result = closure()',
    },
    {
      'name': 'getscripthash',
      'params': [{ 'name': 'script', 'type': 'Instance' }],
      'returnType': 'string',
      'description': "Returns a hash of the script's bytecode. Useful for detecting script changes.",
      'example': 'local hash = getscripthash(script)\nprint("Script hash:", hash)',
    },
    {
      'name': 'getscripts',
      'params': [],
      'returnType': 'table',
      'description': 'Returns an array of all scripts in the game.',
      'example': 'local scripts = getscripts()\nprint("Total scripts:", #scripts)',
    },
    {
      'name': 'getsenv',
      'params': [{ 'name': 'script', 'type': 'Instance' }],
      'returnType': 'table',
      'description': 'Returns the environment table of a running script.',
      'example': 'local env = getsenv(script)\nfor k, v in pairs(env) do\n    print(k, type(v))\nend',
    },
    {
      'name': 'loadstring',
      'params': [
        { 'name': 'source', 'type': 'string' },
        { 'name': 'chunkname', 'type': 'string', 'optional': true },
      ],
      'returnType': 'function|nil',
      'description': 'Compiles Lua source code and returns it as a function. Returns nil and error message on failure.',
      'example':
        'local fn, err = loadstring("return 1 + 1")\nif fn then\n    print(fn()) -- 2\nelse\n    warn(err)\nend',
    },

    // Signals
    {
      'name': 'firesignal',
      'params': [
        { 'name': 'signal', 'type': 'any' },
        { 'name': 'args', 'type': 'any', 'optional': true },
      ],
      'returnType': 'void',
      'description': 'Fires a signal with the given arguments, triggering all connected handlers.',
      'example': 'firesignal(part.Touched, otherPart)',
    },
    {
      'name': 'getconnections',
      'params': [{ 'name': 'signal', 'type': 'any' }],
      'returnType': 'table',
      'description':
        'Returns an array of connection objects for a signal. Each has :Fire(), :Disconnect(), and other methods.',
      'example':
        'local connections = getconnections(part.Touched)\nfor _, conn in ipairs(connections) do\n    conn:Disable()\nend',
    },
    {
      'name': 'replicatesignal',
      'params': [
        { 'name': 'signal', 'type': 'any' },
        { 'name': 'args', 'type': 'any', 'optional': true },
      ],
      'returnType': 'void',
      'description': 'Fires a signal and replicates it to the server.',
      'example': 'replicatesignal(remoteEvent.OnClientEvent, "data")',
    },

    // Misc
    {
      'name': 'identifyexecutor',
      'params': [],
      'returnType': 'string',
      'description': 'Returns the name and version of the current executor.',
      'example': 'local name, version = identifyexecutor()\nprint(name, version)',
    },
    {
      'name': 'request',
      'params': [{ 'name': 'options', 'type': 'table' }],
      'returnType': 'table',
      'description':
        'Makes an HTTP request. Options include Url, Method, Headers, Body. Returns response with StatusCode, Body, Headers.',
      'example':
        'local response = request({\n    Url = "https://httpbin.org/get",\n    Method = "GET"\n})\nprint(response.Body)',
    },
    {
      'name': 'setclipboard',
      'params': [{ 'name': 'text', 'type': 'string' }],
      'returnType': 'void',
      'description': 'Copies text to the system clipboard.',
      'example': 'setclipboard("Hello, clipboard!")',
    },
    {
      'name': 'getclipboard',
      'params': [],
      'returnType': 'string',
      'description': 'Returns the current contents of the system clipboard.',
      'example': 'local text = getclipboard()\nprint("Clipboard:", text)',
    },
  ],
  'namespaces': [
    {
      'name': 'debug',
      'functions': [
        {
          'name': 'getconstant',
          'params': [
            { 'name': 'func', 'type': 'function' },
            { 'name': 'index', 'type': 'number' },
          ],
          'returnType': 'any',
          'description': 'Gets a constant value from a function at the specified index.',
          'example': 'local constant = debug.getconstant(myFunc, 1)',
        },
        {
          'name': 'getconstants',
          'params': [{ 'name': 'func', 'type': 'function' }],
          'returnType': 'table',
          'description': 'Returns an array of all constants used by a function.',
          'example':
            'local constants = debug.getconstants(myFunc)\nfor i, v in ipairs(constants) do\n    print(i, v)\nend',
        },
        {
          'name': 'getproto',
          'params': [
            { 'name': 'func', 'type': 'function' },
            { 'name': 'index', 'type': 'number' },
            { 'name': 'activate', 'type': 'boolean', 'optional': true },
          ],
          'returnType': 'function|table',
          'description': 'Gets a nested function (proto) from a function. Pass activate=true to get all instances.',
          'example': 'local innerFunc = debug.getproto(outerFunc, 1)',
        },
        {
          'name': 'getprotos',
          'params': [{ 'name': 'func', 'type': 'function' }],
          'returnType': 'table',
          'description': 'Returns an array of all nested functions (protos) within a function.',
          'example':
            'local protos = debug.getprotos(myFunc)\nfor i, proto in ipairs(protos) do\n    print(i, proto)\nend',
        },
        {
          'name': 'getstack',
          'params': [
            { 'name': 'level', 'type': 'number' },
            { 'name': 'index', 'type': 'number', 'optional': true },
          ],
          'returnType': 'any',
          'description':
            'Gets a value from the stack at the specified level. If index is nil, returns all stack values.',
          'example': 'local stackValue = debug.getstack(1, 1)',
        },
        {
          'name': 'getupvalue',
          'params': [
            { 'name': 'func', 'type': 'function' },
            { 'name': 'index', 'type': 'number' },
          ],
          'returnType': 'any',
          'description': 'Gets an upvalue from a function at the specified index.',
          'example': 'local upvalue = debug.getupvalue(myFunc, 1)',
        },
        {
          'name': 'getupvalues',
          'params': [{ 'name': 'func', 'type': 'function' }],
          'returnType': 'table',
          'description': 'Returns an array of all upvalues captured by a function.',
          'example':
            'local upvalues = debug.getupvalues(myFunc)\nfor i, v in ipairs(upvalues) do\n    print(i, v)\nend',
        },
        {
          'name': 'setconstant',
          'params': [
            { 'name': 'func', 'type': 'function' },
            { 'name': 'index', 'type': 'number' },
            { 'name': 'value', 'type': 'any' },
          ],
          'returnType': 'void',
          'description': 'Sets a constant value in a function at the specified index.',
          'example': 'debug.setconstant(myFunc, 1, "newValue")',
        },
        {
          'name': 'setstack',
          'params': [
            { 'name': 'level', 'type': 'number' },
            { 'name': 'index', 'type': 'number' },
            { 'name': 'value', 'type': 'any' },
          ],
          'returnType': 'void',
          'description': 'Sets a value on the stack at the specified level and index.',
          'example': 'debug.setstack(1, 1, "newValue")',
        },
        {
          'name': 'setupvalue',
          'params': [
            { 'name': 'func', 'type': 'function' },
            { 'name': 'index', 'type': 'number' },
            { 'name': 'value', 'type': 'any' },
          ],
          'returnType': 'void',
          'description': 'Sets an upvalue in a function at the specified index.',
          'example': 'debug.setupvalue(myFunc, 1, "newValue")',
        },
      ],
    },
    {
      'name': 'Drawing',
      'functions': [
        {
          'name': 'new',
          'params': [{ 'name': 'type', 'type': 'string' }],
          'returnType': 'any',
          'description': 'Creates a new Drawing object. Types: Line, Text, Circle, Square, Quad, Triangle, Image.',
          'example':
            'local line = Drawing.new("Line")\nline.From = Vector2.new(0, 0)\nline.To = Vector2.new(100, 100)\nline.Color = Color3.new(1, 0, 0)\nline.Visible = true',
        },
      ],
    },
  ],
});

/**
 * Converts a Sunc API definition to Luau type definitions.
 *
 * This function processes all global functions and namespaces from the Sunc API,
 * converting them to Luau types. It also adds additional common executor globals
 * not in the standard Sunc API (found in various executors like Synapse, KRNL, etc.)
 * and the 'syn' namespace for Synapse X specific functions.
 *
 * @param api - The Sunc API definition to convert
 * @returns An object containing maps of global functions and namespaces
 */
export const convertSuncApiToTypes = (
  api: SuncApiDefinition,
): {
  globals: Map<string, LuauType>;
  namespaces: Map<string, LuauType>;
} => {
  const globals = new Map<string, LuauType>();
  const namespaces = new Map<string, LuauType>();

  for (const func of api.functions) {
    globals.set(func.name, convertSuncFunction(func));
  }

  for (const ns of api.namespaces) {
    const nsFuncs = new Map<string, { type: LuauType; readonly: boolean; optional: boolean }>();
    for (const func of ns.functions) {
      nsFuncs.set(func.name, {
        'type': convertSuncFunction(func),
        'readonly': true,
        'optional': false,
      });
    }
    namespaces.set(ns.name, createTableType(nsFuncs));
  }

  // Add additional common executor globals not in standard Sunc API
  // These are found in various exploits like Synapse, KRNL, etc.
  const additionalGlobals: Array<{ name: string; type: LuauType }> = [
    // Simulation/Physics
    {
      'name': 'setsimulationradius',
      'type': createFunctionType([{ 'name': 'radius', 'type': NumberType, 'optional': false }], NilType),
    },
    {
      'name': 'set_simulation_radius',
      'type': createFunctionType([{ 'name': 'radius', 'type': NumberType, 'optional': false }], NilType),
    },

    // Hidden properties
    {
      'name': 'set_hidden_prop',
      'type': createFunctionType(
        [
          { 'name': 'obj', 'type': AnyType, 'optional': false },
          { 'name': 'prop', 'type': StringType, 'optional': false },
          { 'name': 'value', 'type': AnyType, 'optional': false },
        ],
        NilType,
      ),
    },
    {
      'name': 'get_hidden_prop',
      'type': createFunctionType(
        [
          { 'name': 'obj', 'type': AnyType, 'optional': false },
          { 'name': 'prop', 'type': StringType, 'optional': false },
        ],
        AnyType,
      ),
    },
    {
      'name': 'getpropvalue',
      'type': createFunctionType(
        [
          { 'name': 'obj', 'type': AnyType, 'optional': false },
          { 'name': 'prop', 'type': StringType, 'optional': false },
        ],
        AnyType,
      ),
    },
    {
      'name': 'setpropvalue',
      'type': createFunctionType(
        [
          { 'name': 'obj', 'type': AnyType, 'optional': false },
          { 'name': 'prop', 'type': StringType, 'optional': false },
          { 'name': 'value', 'type': AnyType, 'optional': false },
        ],
        NilType,
      ),
    },

    // Signal connections
    {
      'name': 'get_signal_cons',
      'type': createFunctionType(
        [{ 'name': 'signal', 'type': AnyType, 'optional': false }],
        createTableType(new Map()),
      ),
    },

    // Clipboard
    {
      'name': 'setclipboard',
      'type': createFunctionType([{ 'name': 'text', 'type': StringType, 'optional': false }], NilType),
    },
    { 'name': 'getclipboard', 'type': createFunctionType([], StringType) },
    {
      'name': 'toclipboard',
      'type': createFunctionType([{ 'name': 'text', 'type': StringType, 'optional': false }], NilType),
    },

    // Loadstring variants
    {
      'name': 'loadstring',
      'type': createFunctionType(
        [
          { 'name': 'source', 'type': StringType, 'optional': false },
          { 'name': 'chunkname', 'type': StringType, 'optional': true },
        ],
        AnyType,
      ),
    },

    // Hash functions
    {
      'name': 'Hash',
      'type': createFunctionType([{ 'name': 'data', 'type': StringType, 'optional': false }], StringType),
    },
    {
      'name': 'crypt',
      'type': createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }),
    },

    // Executor detection flags (common across exploits)
    { 'name': 'PROTOSMASHER_LOADED', 'type': BooleanType },
    { 'name': 'KRNL_LOADED', 'type': BooleanType },
    { 'name': 'SENTINEL_LOADED', 'type': BooleanType },
    { 'name': 'SIRHURT_LOADED', 'type': BooleanType },

    // HTTP
    {
      'name': 'http_request',
      'type': createFunctionType(
        [{ 'name': 'options', 'type': RequestOptionsType, 'optional': false }],
        RequestResponseType,
      ),
    },
    {
      'name': 'syn_request',
      'type': createFunctionType(
        [{ 'name': 'options', 'type': RequestOptionsType, 'optional': false }],
        RequestResponseType,
      ),
    },

    // Misc common functions
    {
      'name': 'rconsoleprint',
      'type': createFunctionType([{ 'name': 'text', 'type': StringType, 'optional': false }], NilType),
    },
    { 'name': 'rconsoleclear', 'type': createFunctionType([], NilType) },
    {
      'name': 'rconsolename',
      'type': createFunctionType([{ 'name': 'name', 'type': StringType, 'optional': false }], NilType),
    },
    { 'name': 'rconsoleinput', 'type': createFunctionType([], StringType) },
    {
      'name': 'printconsole',
      'type': createFunctionType([{ 'name': 'text', 'type': StringType, 'optional': false }], NilType),
    },
    {
      'name': 'queueonteleport',
      'type': createFunctionType([{ 'name': 'script', 'type': StringType, 'optional': false }], NilType),
    },
    {
      'name': 'queue_on_teleport',
      'type': createFunctionType([{ 'name': 'script', 'type': StringType, 'optional': false }], NilType),
    },

    // Mouse functions
    { 'name': 'mouse1click', 'type': createFunctionType([], NilType) },
    { 'name': 'mouse1press', 'type': createFunctionType([], NilType) },
    { 'name': 'mouse1release', 'type': createFunctionType([], NilType) },
    { 'name': 'mouse2click', 'type': createFunctionType([], NilType) },
    { 'name': 'mouse2press', 'type': createFunctionType([], NilType) },
    { 'name': 'mouse2release', 'type': createFunctionType([], NilType) },
    {
      'name': 'mousemoverel',
      'type': createFunctionType(
        [
          { 'name': 'x', 'type': NumberType, 'optional': false },
          { 'name': 'y', 'type': NumberType, 'optional': false },
        ],
        NilType,
      ),
    },
    {
      'name': 'mousemoveabs',
      'type': createFunctionType(
        [
          { 'name': 'x', 'type': NumberType, 'optional': false },
          { 'name': 'y', 'type': NumberType, 'optional': false },
        ],
        NilType,
      ),
    },
    {
      'name': 'mousescroll',
      'type': createFunctionType([{ 'name': 'pixels', 'type': NumberType, 'optional': false }], NilType),
    },

    // Keyboard functions
    {
      'name': 'keypress',
      'type': createFunctionType([{ 'name': 'keycode', 'type': NumberType, 'optional': false }], NilType),
    },
    {
      'name': 'keyrelease',
      'type': createFunctionType([{ 'name': 'keycode', 'type': NumberType, 'optional': false }], NilType),
    },
    { 'name': 'isrbxactive', 'type': createFunctionType([], BooleanType) },
    { 'name': 'isgameactive', 'type': createFunctionType([], BooleanType) },
  ];

  for (const g of additionalGlobals) {
    globals.set(g.name, g.type);
  }

  // Add syn namespace (Synapse X specific)
  const synNamespace = createTableType(
    new Map([
      [
        'request',
        {
          'type': createFunctionType(
            [{ 'name': 'options', 'type': RequestOptionsType, 'optional': false }],
            RequestResponseType,
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'cache_invalidate',
        {
          'type': createFunctionType([{ 'name': 'obj', 'type': AnyType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'cache_isbached',
        {
          'type': createFunctionType([{ 'name': 'obj', 'type': AnyType, 'optional': false }], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'cache_replace',
        {
          'type': createFunctionType(
            [
              { 'name': 'obj', 'type': AnyType, 'optional': false },
              { 'name': 'newObj', 'type': AnyType, 'optional': false },
            ],
            NilType,
          ),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'crypt',
        {
          'type': createTableType(new Map(), { 'indexer': { 'keyType': StringType, 'valueType': AnyType } }),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'set_thread_identity',
        {
          'type': createFunctionType([{ 'name': 'identity', 'type': NumberType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      ['get_thread_identity', { 'type': createFunctionType([], NumberType), 'readonly': true, 'optional': false }],
      [
        'is_cached',
        {
          'type': createFunctionType([{ 'name': 'obj', 'type': AnyType, 'optional': false }], BooleanType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'write_clipboard',
        {
          'type': createFunctionType([{ 'name': 'text', 'type': StringType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'queue_on_teleport',
        {
          'type': createFunctionType([{ 'name': 'script', 'type': StringType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'protect_gui',
        {
          'type': createFunctionType([{ 'name': 'gui', 'type': AnyType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'unprotect_gui',
        {
          'type': createFunctionType([{ 'name': 'gui', 'type': AnyType, 'optional': false }], NilType),
          'readonly': true,
          'optional': false,
        },
      ],
      [
        'secure_call',
        {
          'type': createFunctionType([{ 'name': 'func', 'type': AnyType, 'optional': false }], AnyType, {
            'isVariadic': true,
          }),
          'readonly': true,
          'optional': false,
        },
      ],
    ]),
    { 'indexer': { 'keyType': StringType, 'valueType': AnyType } },
  );
  namespaces.set('syn', synNamespace);

  return { globals, namespaces };
};
