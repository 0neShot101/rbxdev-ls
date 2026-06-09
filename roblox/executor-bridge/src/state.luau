local M = {}

M.BRIDGE_ID = tostring(math.random(1, 999999999))

M.connection = nil
M.connected = false
M.refreshConnections = {}
M.bridgeAlive = true
M.reconnectScheduled = false
M.reconnectAttemptDelay = nil -- set by init after config is loaded
M.healthProbeFailures = 0

M.remoteSpyEnabled = false
M.remoteSpyFilter = ''
M.remoteSpyBlockedNames = {}
M.remoteSpyBlockedPaths = {}
M.spyCleanup = nil

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

M.isBridgeAlive = function()
	if getgenv == nil then return M.bridgeAlive end
	local bridge = getgenv()._RBXDEV_BRIDGE
	return bridge ~= nil and bridge.id == M.BRIDGE_ID and bridge.alive
end

return M
