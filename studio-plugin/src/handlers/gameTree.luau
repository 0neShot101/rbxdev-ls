local RunService = game:GetService'RunService'

local protocol = require(script.Parent.Parent.protocol)

local gameTree = {}

local CONFIG = {
	updateTreeDepth   = 3,
	expandedTreeDepth = 2,
	firstConnectDepth = 4,
	gameTreeServices  = {
		'Workspace', 'Players', 'ReplicatedStorage', 'ReplicatedFirst',
		'StarterGui', 'StarterPack', 'StarterPlayer', 'Lighting',
		'SoundService', 'Chat', 'Teams',
	},
}

-- Auto-refresh subsystem (opt-in). Event handlers do one flag write; a
-- RunService.Heartbeat-gated deadline coalesces flushes so bursty edits
-- (model pastes, respawns, StarterGui loads) don't flood the bridge.
local MIN_INTERVAL_SEC = 2.0
local MAX_COALESCE_SEC = 30.0

local autoRefreshEnabled = false
local autoRefreshIntervalSec = 5.0
local isDirty = false
local firstDirtyAt = nil
local flushAt = nil
local serviceConnections = {}
local topLevelConnection = nil
local heartbeatConnection = nil
local onFlushCallback = nil

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

gameTree.buildTree = function(services, depth)
	local tree = {}
	local treeDepth = depth or CONFIG.updateTreeDepth
	local added = {}

	for _, serviceName in ipairs(services or CONFIG.gameTreeServices) do
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

gameTree.buildFirstConnectTree = function()
	return gameTree.buildTree(nil, CONFIG.firstConnectDepth)
end

gameTree.getChildren = function(path)
	local instance = protocol.resolveInstancePath(path)
	if instance == nil then
		return { success = false, error = 'Instance not found at: ' .. table.concat(path, '.') }
	end

	local result = {}
	for _, child in ipairs(instance:GetChildren()) do
		local childNode = serializeInstance(child, CONFIG.expandedTreeDepth)
		if childNode ~= nil then table.insert(result, childNode) end
	end
	return { success = true, children = result }
end

local markDirty = function()
	if not autoRefreshEnabled then return end
	isDirty = true
	local now = os.clock()
	if firstDirtyAt == nil then firstDirtyAt = now end
	if flushAt == nil then flushAt = now + autoRefreshIntervalSec end
end

local attachServiceListeners = function(instance)
	if instance == nil then return end
	local ok, addedConn = pcall(function() return instance.DescendantAdded:Connect(markDirty) end)
	if ok and addedConn ~= nil then table.insert(serviceConnections, addedConn) end
	local ok2, removingConn = pcall(function() return instance.DescendantRemoving:Connect(markDirty) end)
	if ok2 and removingConn ~= nil then table.insert(serviceConnections, removingConn) end
end

local detachAllListeners = function()
	for _, conn in ipairs(serviceConnections) do pcall(conn.Disconnect, conn) end
	serviceConnections = {}
	if topLevelConnection ~= nil then
		pcall(topLevelConnection.Disconnect, topLevelConnection)
		topLevelConnection = nil
	end
	if heartbeatConnection ~= nil then
		pcall(heartbeatConnection.Disconnect, heartbeatConnection)
		heartbeatConnection = nil
	end
end

local heartbeatTick = function()
	if not autoRefreshEnabled or not isDirty then return end
	local now = os.clock()
	local force = firstDirtyAt ~= nil and (now - firstDirtyAt) >= MAX_COALESCE_SEC
	if flushAt ~= nil and now < flushAt and not force then return end

	-- Clear state BEFORE building: a DescendantAdded firing during
	-- serialisation must re-arm the next flush, not be lost.
	isDirty = false
	firstDirtyAt = nil
	flushAt = nil

	local ok, tree = pcall(gameTree.buildTree, nil)
	if ok and onFlushCallback ~= nil then
		pcall(onFlushCallback, tree)
	end
end

gameTree.setAutoRefresh = function(enabled, intervalMs, flushCallback)
	local newEnabled = enabled == true
	local rawInterval = tonumber(intervalMs) or 5000
	local newIntervalSec = math.max(MIN_INTERVAL_SEC, rawInterval / 1000)

	onFlushCallback = flushCallback

	if newEnabled == autoRefreshEnabled and newIntervalSec == autoRefreshIntervalSec and newEnabled then
		return
	end

	detachAllListeners()
	isDirty = false
	firstDirtyAt = nil
	flushAt = nil

	autoRefreshEnabled = newEnabled
	autoRefreshIntervalSec = newIntervalSec

	if not autoRefreshEnabled then return end

	for _, serviceName in ipairs(CONFIG.gameTreeServices) do
		local ok, svc = pcall(game.GetService, game, serviceName)
		if ok and svc ~= nil then attachServiceListeners(svc) end
	end

	-- Also cover top-level children that are not in the standard allowlist.
	topLevelConnection = game.ChildAdded:Connect(function(child)
		attachServiceListeners(child)
		markDirty()
	end)

	heartbeatConnection = RunService.Heartbeat:Connect(heartbeatTick)
end

gameTree.shutdownAutoRefresh = function()
	detachAllListeners()
	autoRefreshEnabled = false
	isDirty = false
	firstDirtyAt = nil
	flushAt = nil
	onFlushCallback = nil
end

return gameTree
