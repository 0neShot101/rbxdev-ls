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
setupAutoRefresh()

print("[rbxdev-bridge] Bridge script loaded successfully")
print("[rbxdev-bridge] Press Ctrl+Shift+E in VS Code to execute code")
