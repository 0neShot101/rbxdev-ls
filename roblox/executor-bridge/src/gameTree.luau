local RunService = game:GetService'RunService'

local config = require("config")
local state = require("state")
local protocol = require("protocol")

local M = {}

local serializeInstance
serializeInstance = function(instance, depth)
	if depth <= 0 then return nil end

	local node = { name = instance.Name, className = instance.ClassName }
	local children = instance:GetChildren()

	if depth == 1 and #children > 0 then
		node.hasChildren = true
		return node
	end

	if #children > 0 then
		local serialized = {}
		for _, child in ipairs(children) do
			local childNode = serializeInstance(child, depth - 1)
			if childNode ~= nil then table.insert(serialized, childNode) end
		end
		if #serialized > 0 then node.children = serialized end
	end

	return node
end

M.getChildrenAtPath = function(path, depth)
	local instance = protocol.resolveInstancePath(path)
	if instance == nil then return nil end

	local result = {}
	for _, child in ipairs(instance:GetChildren()) do
		local childNode = serializeInstance(child, depth)
		if childNode ~= nil then table.insert(result, childNode) end
	end
	return result
end

M.getGameTree = function(services, depth)
	local tree = {}
	local treeDepth = depth or config.CONFIG.updateTreeDepth
	local added = {}

	for _, serviceName in ipairs(services or config.CONFIG.gameTreeServices) do
		local ok, service = pcall(game.GetService, game, serviceName)
		if ok and service ~= nil then
			local serviceNode = serializeInstance(service, treeDepth)
			if serviceNode ~= nil then
				table.insert(tree, serviceNode)
				added[service] = true
			end
		end
	end

	if services == nil then
		for _, child in ipairs(game:GetChildren()) do
			if added[child] == nil then
				local ok, serviceNode = pcall(serializeInstance, child, treeDepth)
				if ok and serviceNode ~= nil then table.insert(tree, serviceNode) end
			end
		end
	end

	return tree
end

-- Auto-refresh subsystem (opt-in). Event handlers do one flag write; a
-- RunService.Heartbeat-gated deadline coalesces flushes so bursty edits
-- (model pastes, respawns, StarterGui loads) don't flood the bridge.
-- This replaces the previous "no listeners at all" policy — the original
-- flood concern was the full serialisation per event, not the event
-- surface itself. Keeping the handlers to a single flag write and
-- debouncing the flush on Heartbeat makes it safe to opt into.
--
-- RBXScriptConnections live inside the top-level `refreshConnections`
-- table so the bridge's re-execution cleanup (at the top of the file)
-- disposes them when the script is re-run.

local MIN_AUTO_REFRESH_INTERVAL_SEC = 2.0
local MAX_COALESCE_SEC = 30.0

local autoRefreshEnabled = false
local autoRefreshIntervalSec = 5.0
local autoRefreshDirty = false
local autoRefreshFirstDirtyAt = nil
local autoRefreshFlushAt = nil
local autoRefreshHeartbeat = nil
local autoRefreshTopLevel = nil

local markAutoRefreshDirty
local attachAutoRefreshListeners
local detachAutoRefreshListeners
local autoRefreshHeartbeatTick

markAutoRefreshDirty = function()
	if not autoRefreshEnabled then return end
	autoRefreshDirty = true
	local now = os.clock()
	if autoRefreshFirstDirtyAt == nil then autoRefreshFirstDirtyAt = now end
	if autoRefreshFlushAt == nil then autoRefreshFlushAt = now + autoRefreshIntervalSec end
end

attachAutoRefreshListeners = function(instance)
	if instance == nil then return end
	local ok, addedConn = pcall(function() return instance.DescendantAdded:Connect(markAutoRefreshDirty) end)
	if ok and addedConn ~= nil then table.insert(state.refreshConnections, addedConn) end
	local ok2, removingConn = pcall(function() return instance.DescendantRemoving:Connect(markAutoRefreshDirty) end)
	if ok2 and removingConn ~= nil then table.insert(state.refreshConnections, removingConn) end
end

detachAutoRefreshListeners = function()
	for _, conn in ipairs(state.refreshConnections) do pcall(conn.Disconnect, conn) end
	-- Clear in-place so the getgenv()._RBXDEV_BRIDGE.refreshConnections
	-- reference at the top of the file keeps pointing at a valid table.
	for i = #state.refreshConnections, 1, -1 do state.refreshConnections[i] = nil end
	autoRefreshHeartbeat = nil
	autoRefreshTopLevel = nil
end

autoRefreshHeartbeatTick = function()
	if not autoRefreshEnabled or not autoRefreshDirty then return end
	local now = os.clock()
	local force = autoRefreshFirstDirtyAt ~= nil and (now - autoRefreshFirstDirtyAt) >= MAX_COALESCE_SEC
	if autoRefreshFlushAt ~= nil and now < autoRefreshFlushAt and not force then return end

	-- Clear state BEFORE building: a DescendantAdded firing during
	-- serialisation must re-arm the next flush, not be lost.
	autoRefreshDirty = false
	autoRefreshFirstDirtyAt = nil
	autoRefreshFlushAt = nil

	if not state.connected then return end
	local ok, tree = pcall(M.getGameTree, nil, config.CONFIG.updateTreeDepth)
	if ok and state.connected then
		pcall(protocol.send, { type = 'gameTree', data = tree })
	end
end

M.setAutoRefresh = function(enabled, intervalMs)
	local newEnabled = enabled == true
	local rawInterval = tonumber(intervalMs) or 5000
	local newIntervalSec = math.max(MIN_AUTO_REFRESH_INTERVAL_SEC, rawInterval / 1000)

	if newEnabled == autoRefreshEnabled and newIntervalSec == autoRefreshIntervalSec and newEnabled then
		return
	end

	detachAutoRefreshListeners()
	autoRefreshDirty = false
	autoRefreshFirstDirtyAt = nil
	autoRefreshFlushAt = nil

	autoRefreshEnabled = newEnabled
	autoRefreshIntervalSec = newIntervalSec

	if not autoRefreshEnabled then return end

	for _, serviceName in ipairs(config.CONFIG.gameTreeServices) do
		local ok, svc = pcall(game.GetService, game, serviceName)
		if ok and svc ~= nil then attachAutoRefreshListeners(svc) end
	end

	-- Cover top-level children not in the standard allowlist: when a new
	-- top-level service/child appears, attach listeners and mark dirty.
	autoRefreshTopLevel = game.ChildAdded:Connect(function(child)
		attachAutoRefreshListeners(child)
		markAutoRefreshDirty()
	end)
	if autoRefreshTopLevel ~= nil then table.insert(state.refreshConnections, autoRefreshTopLevel) end

	autoRefreshHeartbeat = RunService.Heartbeat:Connect(autoRefreshHeartbeatTick)
	if autoRefreshHeartbeat ~= nil then table.insert(state.refreshConnections, autoRefreshHeartbeat) end
end

M.shutdownAutoRefresh = function()
	detachAutoRefreshListeners()
	autoRefreshEnabled = false
	autoRefreshDirty = false
	autoRefreshFirstDirtyAt = nil
	autoRefreshFlushAt = nil
end

return M
