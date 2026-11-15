--[[ Module ]]--

local M = {}

M.BRIDGE_ID = tostring(math.random(1, 999999999))

M.connection = nil
M.connected = false
M.refreshConnections = {}
M.bridgeAlive = true
M.reconnectScheduled = false
M.reconnectAttemptDelay = nil
M.healthProbeFailures = 0

M.remoteSpyEnabled = false
M.remoteSpySource = 'game'
M.remoteSpyFilter = ''
M.remoteSpyBlockedNames = {}
M.remoteSpyBlockedPaths = {}
M.spyCleanup = nil

--[[ Functions ]]--

M.registerGlobal = function()
  if getgenv then
    getgenv()._RBXDEV_BRIDGE = {
      id = M.BRIDGE_ID,
      connection = nil,
      refreshConnections = M.refreshConnections,
      spyCleanup = nil,
      alive = true,
    }
  end
end

M.bindHandlers = function(dispatch, onClose)
  if getgenv == nil then
    return
  end
  local bridge = getgenv()._RBXDEV_BRIDGE
  if bridge == nil or bridge.id ~= M.BRIDGE_ID then
    return
  end
  bridge.dispatch = dispatch
  bridge.onClose = onClose
end

M.isBridgeAlive = function()
  if getgenv == nil then
    return M.bridgeAlive
  end
  local bridge = getgenv()._RBXDEV_BRIDGE
  return bridge ~= nil and bridge.id == M.BRIDGE_ID and bridge.alive
end

return M
