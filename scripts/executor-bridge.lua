--[[
  rbxdev-ls Executor Bridge Client

  This script connects to the rbxdev-ls VS Code extension via WebSocket,
  enabling code execution and live game tree syncing.

  Usage: Execute this script in your Roblox exploit executor while
  VS Code with rbxdev-ls is running.
]]

local HttpService = game:GetService("HttpService")

-- Configuration
local CONFIG = {
  host = "ws://127.0.0.1:21324",
  reconnectDelay = 5,
  gameTreeDepth = 999,  -- How deep to traverse the game tree
  gameTreeRefreshInterval = 2,  -- How often to check for changes (seconds)
  gameTreeServices = { -- Services to include in game tree
    "Workspace",
    "Players",
    "ReplicatedStorage",
    "ReplicatedFirst",
    "StarterGui",
    "StarterPack",
    "StarterPlayer",
    "Lighting",
    "SoundService",
    "Chat",
    "Teams",
  },
}

-- Detect WebSocket implementation
local WebSocket = (function()
  if WebSocket then return WebSocket end
  if syn and syn.websocket then return syn.websocket end
  if Fluxus and Fluxus.websocket then return Fluxus.websocket end
  if krnl and krnl.websocket then return krnl.websocket end
  if Xeno and Xeno.websocket then return Xeno.websocket end
  if websocket then return websocket end
  return nil
end)()

if WebSocket == nil then
  warn("[rbxdev-bridge] No WebSocket implementation found!")
  return
end

-- Detect executor name and version
local executorName, executorVersion = (function()
  if identifyexecutor then
    local name, version = identifyexecutor()
    return name or "Unknown", version or "1.0"
  end
  return "Unknown", "1.0"
end)()

-- JSON encode/decode helpers
local function jsonEncode(data)
  return HttpService:JSONEncode(data)
end

local function jsonDecode(data)
  local success, result = pcall(function()
    return HttpService:JSONDecode(data)
  end)
  if success then return result end
  return nil
end

-- Serialize game tree
local function serializeInstance(instance, depth)
  if depth <= 0 then return nil end

  local node = {
    name = instance.Name,
    className = instance.ClassName,
  }

  local children = {}
  for _, child in ipairs(instance:GetChildren()) do
    local childNode = serializeInstance(child, depth - 1)
    if childNode then
      table.insert(children, childNode)
    end
  end

  if #children > 0 then
    node.children = children
  end

  return node
end

local function getGameTree(services)
  local tree = {}

  for _, serviceName in ipairs(services or CONFIG.gameTreeServices) do
    local success, service = pcall(function()
      return game:GetService(serviceName)
    end)

    if success and service then
      local serviceNode = serializeInstance(service, CONFIG.gameTreeDepth)
      if serviceNode then
        table.insert(tree, serviceNode)
      end
    end
  end

  return tree
end

-- Extract error info from Lua error string
local function parseError(errorString)
  local file, line, message = errorString:match("(%S+):(%d+): (.+)")

  return {
    message = message or errorString,
    file = file,
    line = line and tonumber(line) or nil,
  }
end

-- Default properties to fetch for each class type
local DEFAULT_PROPERTIES = {
  BasePart = {"Name", "Transparency", "Color", "Material", "Anchored", "CanCollide", "Position", "Size"},
  Part = {"Name", "Transparency", "Color", "Material", "Anchored", "CanCollide", "Position", "Size", "Shape"},
  Model = {"Name", "PrimaryPart"},
  Script = {"Name", "Enabled"},
  LocalScript = {"Name", "Enabled"},
  ModuleScript = {"Name"},
  Sound = {"Name", "Volume", "Playing", "SoundId", "TimePosition"},
  PointLight = {"Name", "Enabled", "Brightness", "Color", "Range"},
  SpotLight = {"Name", "Enabled", "Brightness", "Color", "Range", "Angle"},
  SurfaceLight = {"Name", "Enabled", "Brightness", "Color", "Range", "Angle"},
  Folder = {"Name"},
  Frame = {"Name", "Visible", "BackgroundColor3", "BackgroundTransparency", "Position", "Size"},
  TextLabel = {"Name", "Visible", "Text", "TextColor3", "TextSize", "Font"},
  TextButton = {"Name", "Visible", "Text", "TextColor3", "TextSize", "Font"},
  ImageLabel = {"Name", "Visible", "Image", "ImageColor3", "ImageTransparency"},
  ImageButton = {"Name", "Visible", "Image", "ImageColor3", "ImageTransparency"},
}

-- Get default properties for a class (check inheritance)
local function getDefaultProperties(className)
  local props = DEFAULT_PROPERTIES[className]
  if props then return props end

  -- Check BasePart for Part-derived classes
  if className:find("Part") then
    return DEFAULT_PROPERTIES.BasePart
  end

  return {"Name", "ClassName"}
end

-- Serialize a property value to a JSON-safe format
local function serializePropertyValue(name, value)
  local valueType = typeof(value)
  local serialized = {
    name = name,
    valueType = valueType,
  }

  if valueType == "string" then
    serialized.value = value
  elseif valueType == "number" then
    serialized.value = tostring(value)
  elseif valueType == "boolean" then
    serialized.value = tostring(value)
  elseif value == nil then
    serialized.value = "nil"
    serialized.valueType = "nil"
  elseif valueType == "Instance" then
    serialized.value = value:GetFullName()
    serialized.className = value.ClassName
    serialized.valueType = "Instance"
  elseif valueType == "Vector3" then
    serialized.value = string.format("%.3f, %.3f, %.3f", value.X, value.Y, value.Z)
  elseif valueType == "Vector2" then
    serialized.value = string.format("%.3f, %.3f", value.X, value.Y)
  elseif valueType == "CFrame" then
    serialized.value = string.format("%.3f, %.3f, %.3f", value.X, value.Y, value.Z)
  elseif valueType == "Color3" then
    serialized.value = string.format("%.3f, %.3f, %.3f", value.R, value.G, value.B)
  elseif valueType == "BrickColor" then
    serialized.value = value.Name
    serialized.valueType = "BrickColor"
  elseif valueType == "UDim" then
    serialized.value = string.format("%.3f, %d", value.Scale, value.Offset)
  elseif valueType == "UDim2" then
    serialized.value = string.format("{%.3f, %d}, {%.3f, %d}", value.X.Scale, value.X.Offset, value.Y.Scale, value.Y.Offset)
  elseif valueType == "EnumItem" then
    serialized.value = tostring(value)
    serialized.valueType = "EnumItem"
  else
    serialized.value = tostring(value)
    serialized.valueType = "other"
  end

  return serialized
end

-- Resolve an instance from a path array
local function resolveInstancePath(path)
  local instance = game
  for _, segment in ipairs(path) do
    local success, child = pcall(function()
      return instance:FindFirstChild(segment)
    end)
    if not success or child == nil then
      return nil
    end
    instance = child
  end
  return instance
end

-- Parse a string value into the correct Lua type
local function parseValue(value, valueType)
  if valueType == "string" then
    return value
  elseif valueType == "number" then
    return tonumber(value)
  elseif valueType == "boolean" then
    return value == "true"
  elseif valueType == "nil" then
    return nil
  elseif valueType == "Vector3" then
    local x, y, z = value:match("([^,]+),%s*([^,]+),%s*([^,]+)")
    return Vector3.new(tonumber(x), tonumber(y), tonumber(z))
  elseif valueType == "Vector2" then
    local x, y = value:match("([^,]+),%s*([^,]+)")
    return Vector2.new(tonumber(x), tonumber(y))
  elseif valueType == "Color3" then
    local r, g, b = value:match("([^,]+),%s*([^,]+),%s*([^,]+)")
    return Color3.new(tonumber(r), tonumber(g), tonumber(b))
  elseif valueType == "BrickColor" then
    return BrickColor.new(value)
  elseif valueType == "UDim2" then
    local xs, xo, ys, yo = value:match("{([^,]+),%s*([^}]+)},%s*{([^,]+),%s*([^}]+)}")
    return UDim2.new(tonumber(xs), tonumber(xo), tonumber(ys), tonumber(yo))
  elseif valueType == "UDim" then
    local s, o = value:match("([^,]+),%s*([^,]+)")
    return UDim.new(tonumber(s), tonumber(o))
  elseif valueType == "EnumItem" then
    -- Parse enum like "Enum.Material.Plastic"
    local enumPath = value:match("Enum%.(.+)")
    if enumPath then
      local parts = {}
      for part in enumPath:gmatch("[^%.]+") do
        table.insert(parts, part)
      end
      if #parts == 2 then
        return Enum[parts[1]][parts[2]]
      end
    end
    return nil
  else
    -- Try to evaluate as a simple expression for other types
    return value
  end
end

-- WebSocket connection
local connection = nil
local connected = false

local function send(data)
  if connection and connected then
    connection:Send(jsonEncode(data))
  end
end

local function handleMessage(rawMessage)
  local message = jsonDecode(rawMessage)
  if message == nil then return end

  if message.type == "execute" then
    -- Execute code
    local code = message.code
    local id = message.id

    local fn, loadError = loadstring(code)
    if fn then
      local success, result = pcall(fn)

      if success then
        send({
          type = "executeResult",
          id = id,
          success = true,
          result = result ~= nil and tostring(result) or nil,
        })
      else
        send({
          type = "executeResult",
          id = id,
          success = false,
          error = parseError(tostring(result)),
        })
      end
    else
      send({
        type = "executeResult",
        id = id,
        success = false,
        error = parseError(tostring(loadError)),
      })
    end

  elseif message.type == "requestGameTree" then
    -- Send game tree
    local services = message.services
    local tree = getGameTree(services)

    send({
      type = "gameTree",
      data = tree,
    })

  elseif message.type == "requestProperties" then
    -- Get properties of an instance
    local path = message.path
    local requestedProps = message.properties
    local id = message.id

    -- Resolve instance from path
    local instance = resolveInstancePath(path)
    if instance == nil then
      send({
        type = "propertiesResult",
        id = id,
        success = false,
        error = "Instance not found at: " .. table.concat(path, "."),
      })
      return
    end

    -- Get properties
    local props = {}
    local propsToGet = requestedProps or getDefaultProperties(instance.ClassName)

    for _, propName in ipairs(propsToGet) do
      local success, value = pcall(function()
        return instance[propName]
      end)
      if success then
        table.insert(props, serializePropertyValue(propName, value))
      end
    end

    send({
      type = "propertiesResult",
      id = id,
      success = true,
      properties = props,
    })

  elseif message.type == "requestModuleInterface" then
    -- Get interface of a module
    local moduleRef = message.moduleRef
    local id = message.id
    local module = nil

    if moduleRef.kind == "path" then
      local instance = resolveInstancePath(moduleRef.path)
      if instance == nil then
        send({
          type = "moduleInterface",
          id = id,
          success = false,
          error = "Module not found at: " .. table.concat(moduleRef.path, "."),
        })
        return
      end

      if instance:IsA("ModuleScript") then
        local success, result = pcall(function()
          return require(instance)
        end)
        if success then
          module = result
        else
          send({
            type = "moduleInterface",
            id = id,
            success = false,
            error = tostring(result),
          })
          return
        end
      else
        send({
          type = "moduleInterface",
          id = id,
          success = false,
          error = "Instance is not a ModuleScript",
        })
        return
      end

    elseif moduleRef.kind == "assetId" then
      local success, result = pcall(function()
        return require(moduleRef.id)
      end)
      if success then
        module = result
      else
        send({
          type = "moduleInterface",
          id = id,
          success = false,
          error = tostring(result),
        })
        return
      end
    end

    if module == nil then
      send({
        type = "moduleInterface",
        id = id,
        success = false,
        error = "Failed to load module",
      })
      return
    end

    -- Reflect module interface
    local moduleType = type(module)
    local interface = { kind = moduleType }

    if moduleType == "function" then
      local info = debug.getinfo(module, "u")
      interface.functionArity = info and info.nparams or 0
    elseif moduleType == "table" then
      local props = {}
      for key, value in pairs(module) do
        if type(key) == "string" then
          local prop = { name = key, valueKind = type(value) }
          if type(value) == "function" then
            local info = debug.getinfo(value, "u")
            prop.functionArity = info and info.nparams or 0
          end
          table.insert(props, prop)
        end
      end
      interface.properties = props
    else
      interface.kind = "other"
    end

    send({
      type = "moduleInterface",
      id = id,
      success = true,
      interface = interface,
    })

  elseif message.type == "setProperty" then
    -- Set a property value on an instance
    local path = message.path
    local property = message.property
    local value = message.value
    local valueType = message.valueType
    local id = message.id

    -- Resolve instance from path
    local instance = resolveInstancePath(path)
    if instance == nil then
      send({
        type = "setPropertyResult",
        id = id,
        success = false,
        error = "Instance not found at: " .. table.concat(path, "."),
      })
      return
    end

    -- Parse and set the value based on type
    local success, err = pcall(function()
      local parsedValue = parseValue(value, valueType)
      instance[property] = parsedValue
    end)

    if success then
      send({
        type = "setPropertyResult",
        id = id,
        success = true,
      })
    else
      send({
        type = "setPropertyResult",
        id = id,
        success = false,
        error = tostring(err),
      })
    end

  elseif message.type == "teleportTo" then
    -- Teleport local player to an instance's position
    local path = message.path
    local id = message.id

    -- Resolve instance from path
    local instance = resolveInstancePath(path)
    if instance == nil then
      send({
        type = "teleportToResult",
        id = id,
        success = false,
        error = "Instance not found at: " .. table.concat(path, "."),
      })
      return
    end

    -- Get position to teleport to
    local success, err = pcall(function()
      local Players = game:GetService("Players")
      local player = Players.LocalPlayer
      if player == nil then
        error("No local player")
      end

      local character = player.Character
      if character == nil then
        error("No character")
      end

      local humanoidRootPart = character:FindFirstChild("HumanoidRootPart")
      if humanoidRootPart == nil then
        error("No HumanoidRootPart")
      end

      -- Get target position based on instance type
      local targetPosition
      if instance:IsA("BasePart") then
        targetPosition = instance.Position + Vector3.new(0, 5, 0) -- Offset above
      elseif instance:IsA("Model") then
        local primaryPart = instance.PrimaryPart
        if primaryPart then
          targetPosition = primaryPart.Position + Vector3.new(0, 5, 0)
        else
          -- Try to find any BasePart in the model
          local part = instance:FindFirstChildWhichIsA("BasePart", true)
          if part then
            targetPosition = part.Position + Vector3.new(0, 5, 0)
          else
            error("Model has no parts to teleport to")
          end
        end
      elseif instance:IsA("Attachment") then
        targetPosition = instance.WorldPosition + Vector3.new(0, 5, 0)
      else
        error("Cannot teleport to " .. instance.ClassName)
      end

      humanoidRootPart.CFrame = CFrame.new(targetPosition)
    end)

    if success then
      send({
        type = "teleportToResult",
        id = id,
        success = true,
      })
    else
      send({
        type = "teleportToResult",
        id = id,
        success = false,
        error = tostring(err),
      })
    end

  elseif message.type == "deleteInstance" then
    -- Delete an instance
    local path = message.path
    local id = message.id

    -- Resolve instance from path
    local instance = resolveInstancePath(path)
    if instance == nil then
      send({
        type = "deleteInstanceResult",
        id = id,
        success = false,
        error = "Instance not found at: " .. table.concat(path, "."),
      })
      return
    end

    -- Destroy the instance
    local success, err = pcall(function()
      instance:Destroy()
    end)

    if success then
      send({
        type = "deleteInstanceResult",
        id = id,
        success = true,
      })
      -- Trigger game tree update
      task.delay(0.1, sendGameTreeIfChanged)
    else
      send({
        type = "deleteInstanceResult",
        id = id,
        success = false,
        error = tostring(err),
      })
    end

  elseif message.type == "reparentInstance" then
    -- Move an instance to a new parent
    local sourcePath = message.sourcePath
    local targetPath = message.targetPath
    local id = message.id

    -- Resolve source instance
    local sourceInstance = resolveInstancePath(sourcePath)
    if sourceInstance == nil then
      send({
        type = "reparentInstanceResult",
        id = id,
        success = false,
        error = "Source instance not found at: " .. table.concat(sourcePath, "."),
      })
      return
    end

    -- Resolve target instance
    local targetInstance = resolveInstancePath(targetPath)
    if targetInstance == nil then
      send({
        type = "reparentInstanceResult",
        id = id,
        success = false,
        error = "Target instance not found at: " .. table.concat(targetPath, "."),
      })
      return
    end

    -- Reparent the instance
    local success, err = pcall(function()
      sourceInstance.Parent = targetInstance
    end)

    if success then
      send({
        type = "reparentInstanceResult",
        id = id,
        success = true,
      })
      -- Trigger game tree update
      task.delay(0.1, sendGameTreeIfChanged)
    else
      send({
        type = "reparentInstanceResult",
        id = id,
        success = false,
        error = tostring(err),
      })
    end
  end
end

local function connect()
  print("[rbxdev-bridge] Connecting to " .. CONFIG.host .. "...")

  local success, ws = pcall(function()
    return WebSocket.connect(CONFIG.host)
  end)

  if not success or not ws then
    warn("[rbxdev-bridge] Failed to connect: " .. tostring(ws))
    return false
  end

  connection = ws
  connected = true

  -- Send connected message
  send({
    type = "connected",
    executorName = executorName,
    version = executorVersion,
  })

  print("[rbxdev-bridge] Connected! Executor: " .. executorName .. " v" .. executorVersion)

  -- Handle incoming messages
  ws.OnMessage:Connect(function(message)
    handleMessage(message)
  end)

  -- Handle disconnection
  ws.OnClose:Connect(function()
    connected = false
    connection = nil
    print("[rbxdev-bridge] Disconnected from server")

    -- Attempt reconnection
    task.delay(CONFIG.reconnectDelay, function()
      if not connected then
        connect()
      end
    end)
  end)

  return true
end

-- Hook into error reporting (optional - catches runtime errors)
-- Note: Disabled by default as it can cause stack overflow issues with some executors
local function setupErrorHook()
  -- Uncomment below if your executor supports hookfunction without issues
  --[[
  if hookfunction and getfenv then
    local oldError = error
    local inHook = false
    hookfunction(error, function(message, level)
      if not inHook and connected then
        inHook = true
        send({
          type = "runtimeError",
          error = parseError(tostring(message)),
        })
        inHook = false
      end
      return oldError(message, level)
    end)
  end
  ]]
end

-- Hook print, warn, and error to send log messages to VS Code
local function setupLogHooks()
  local inHook = false -- Prevent recursive calls

  local function safeLog(level, ...)
    if inHook or not connected then return end
    inHook = true

    local args = {...}
    local parts = {}
    for i = 1, select("#", ...) do
      parts[i] = tostring(args[i])
    end

    pcall(function()
      send({
        type = "log",
        level = level,
        message = table.concat(parts, "\t"),
        timestamp = os.time(),
      })
    end)

    inHook = false
  end

  -- Try to use hookfunction for deeper hooking (catches game calls too)
  if hookfunction then
    local originalPrint = clonefunction(print)
    local originalWarn = clonefunction(warn)
    local originalError = clonefunction(error)

    hookfunction(print, function(...)
      safeLog("info", ...)
      return originalPrint(...)
    end)

    hookfunction(warn, function(...)
      safeLog("warn", ...)
      return originalWarn(...)
    end)

    hookfunction(error, function(message, level)
      safeLog("error", message)
      return originalError(message, level)
    end)

    print("[rbxdev-bridge] Log hooks installed (hookfunction)")
  else
    -- Fallback to getgenv approach (only catches our scripts)
    local originalPrint = print
    local originalWarn = warn

    getgenv().print = function(...)
      safeLog("info", ...)
      return originalPrint(...)
    end

    getgenv().warn = function(...)
      safeLog("warn", ...)
      return originalWarn(...)
    end

    print("[rbxdev-bridge] Log hooks installed (getgenv fallback)")
  end
end

-- Auto-refresh game tree
local lastTreeHash = ""
local refreshConnections = {}

local function getTreeHash(tree)
  -- Simple hash based on structure
  local parts = {}
  for _, service in ipairs(tree) do
    local count = service.children and #service.children or 0
    table.insert(parts, service.name .. ":" .. count)
  end
  return table.concat(parts, ",")
end

local function sendGameTreeIfChanged()
  if not connected then return end

  local tree = getGameTree()
  local hash = getTreeHash(tree)

  if hash ~= lastTreeHash then
    lastTreeHash = hash
    send({
      type = "gameTree",
      data = tree,
    })
    print("[rbxdev-bridge] Game tree updated")
  end
end

local function setupAutoRefresh()
  -- Clear any existing connections
  for _, conn in ipairs(refreshConnections) do
    pcall(function() conn:Disconnect() end)
  end
  refreshConnections = {}

  -- Listen for changes on key services
  for _, serviceName in ipairs(CONFIG.gameTreeServices) do
    local success, service = pcall(function()
      return game:GetService(serviceName)
    end)

    if success and service then
      -- Listen for direct children added/removed
      local addConn = service.ChildAdded:Connect(function()
        task.delay(0.1, sendGameTreeIfChanged)
      end)
      local remConn = service.ChildRemoved:Connect(function()
        task.delay(0.1, sendGameTreeIfChanged)
      end)
      table.insert(refreshConnections, addConn)
      table.insert(refreshConnections, remConn)
    end
  end

  -- Also do periodic refresh as backup (catches deeper changes)
  task.spawn(function()
    while true do
      task.wait(CONFIG.gameTreeRefreshInterval)
      if connected then
        sendGameTreeIfChanged()
      end
    end
  end)

  print("[rbxdev-bridge] Auto-refresh enabled")
end

-- Start connection
connect()
setupErrorHook()
setupLogHooks()
setupAutoRefresh()

print("[rbxdev-bridge] Bridge script loaded successfully")
print("[rbxdev-bridge] Press Ctrl+Shift+E in VS Code to execute code")
