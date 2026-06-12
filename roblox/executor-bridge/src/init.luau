local config = require("config")
local executor = require("executor")
local state = require("state")
local protocol = require("protocol")
local gameTree = require("gameTree")

local executeHandler = require("handlers/execute")
local propertiesHandler = require("handlers/properties")
local instancesHandler = require("handlers/instances")
local scriptSourceHandler = require("handlers/scriptSource")
local teleportHandler = require("handlers/teleport")
local childrenHandler = require("handlers/children")
local remoteSpyHandler = require("handlers/remoteSpy")
local consoleHandler = require("handlers/console")
local moduleInterfaceHandler = require("handlers/moduleInterface")

-- Adopt a previous instance's live socket instead of tearing it down. Closing
-- and reopening a WebSocket to swap bridge code crashes some executors, so a
-- reload reuses the existing socket through the dispatch trampoline installed
-- below. Only a socket without that trampoline (a pre-reuse build) is closed.
local reuseSocket = nil
if getgenv and getgenv()._RBXDEV_BRIDGE then
	local old = getgenv()._RBXDEV_BRIDGE
	for _, conn in ipairs(old.refreshConnections or {}) do pcall(conn.Disconnect, conn) end
	if old.spyCleanup ~= nil then
		pcall(old.spyCleanup)
		old.spyCleanup = nil
	end
	if old.socketReusable == true and old.connection ~= nil then
		reuseSocket = old.connection
	elseif old.connection ~= nil then
		pcall(old.connection.Close, old.connection)
	end
	old.alive = false
end

-- Detect a hot-reloaded dev build pushed by `bun run dev:bridge`. The dev
-- watcher prepends a preamble that sets this global before this chunk runs.
-- It is read once and cleared so a later prod injection identifies as prod.
local isDevBuild = false
if getgenv ~= nil then
	isDevBuild = getgenv()._RBXDEV_DEV == true
	getgenv()._RBXDEV_DEV = nil
end
if isDevBuild then warn'[rbxdev-bridge] DEV BUILD active (hot-reloaded)' end

-- Apply user config from varargs
local userConfig = (...) or {}
config.applyUserConfig(userConfig)

-- A hot reload only swaps bridge code; the editor still holds the tree from
-- the prod connection it replaced. Serialising the whole DataModel at the
-- full first-connect depth again would freeze the game on every save, so a
-- dev build sends only a shallow tree and lets the editor refresh on demand.
if isDevBuild then config.CONFIG.firstConnectDepth = config.CONFIG.updateTreeDepth end

-- Initialize reconnect delay from config
state.reconnectAttemptDelay = config.CONFIG.reconnectDelay

-- Register this bridge instance globally for cleanup on re-execution
state.registerGlobal()

-- Bail out if no WebSocket implementation is available
if executor.WebSocket == nil then return end

-- Message handler dispatch table
local MESSAGE_HANDLERS = {}

MESSAGE_HANDLERS.execute = executeHandler.handleExecute

MESSAGE_HANDLERS.requestGameTree = function(message)
	local depth = message.depth or config.CONFIG.updateTreeDepth
	protocol.send{ type = 'gameTree', data = gameTree.getGameTree(message.services, depth) }
end

MESSAGE_HANDLERS.setAutoRefresh = function(message)
	gameTree.setAutoRefresh(message.enabled, message.intervalMs)
end

MESSAGE_HANDLERS.requestChildren = childrenHandler.handleRequestChildren
MESSAGE_HANDLERS.requestProperties = propertiesHandler.handleRequestProperties
MESSAGE_HANDLERS.requestModuleInterface = moduleInterfaceHandler.handleRequestModuleInterface
MESSAGE_HANDLERS.setProperty = propertiesHandler.handleSetProperty
MESSAGE_HANDLERS.teleportTo = teleportHandler.handleTeleportTo
MESSAGE_HANDLERS.deleteInstance = instancesHandler.handleDeleteInstance
MESSAGE_HANDLERS.reparentInstance = instancesHandler.handleReparentInstance
MESSAGE_HANDLERS.requestScriptSource = scriptSourceHandler.handleRequestScriptSource
MESSAGE_HANDLERS.createInstance = instancesHandler.handleCreateInstance
MESSAGE_HANDLERS.cloneInstance = instancesHandler.handleCloneInstance
MESSAGE_HANDLERS.setRemoteSpyEnabled = remoteSpyHandler.handleSetRemoteSpyEnabled
MESSAGE_HANDLERS.setRemoteSpyFilter = remoteSpyHandler.handleSetRemoteSpyFilter
MESSAGE_HANDLERS.setRemoteSpyBlockList = remoteSpyHandler.handleSetRemoteSpyBlockList

local handleMessage = function(rawMessage)
	local message = protocol.jsonDecode(rawMessage)
	if message == nil then return end
	local handler = MESSAGE_HANDLERS[message.type]
	if handler == nil then return end
	handler(message)
end

-- Connection logic
local connect
local scheduleReconnect

local onSocketClose = function()
	state.connected = false
	state.connection = nil
	gameTree.shutdownAutoRefresh()
	scheduleReconnect()
end

-- Marks the live socket as adopted by this instance: repoint the global
-- dispatch and close trampolines at this instance's handlers and record the
-- connection. The next reload reuses this same socket.
local adoptSocket = function(ws)
	state.connection = ws
	state.connected = true
	state.reconnectScheduled = false
	state.reconnectAttemptDelay = config.CONFIG.reconnectDelay
	state.healthProbeFailures = 0

	local bridge = getgenv and getgenv()._RBXDEV_BRIDGE
	if bridge ~= nil then
		bridge.connection = ws
		bridge.socketReusable = true
		bridge.dispatch = handleMessage
		bridge.onClose = onSocketClose
	end

	local clientName = isDevBuild and (executor.name .. ' (dev)') or executor.name
	protocol.send{ type = 'connected', executorName = clientName, version = executor.version }
	protocol.send{ type = 'gameTree', data = gameTree.getGameTree(nil, config.CONFIG.firstConnectDepth) }
end

scheduleReconnect = function()
	if state.reconnectScheduled or state.connected or not state.isBridgeAlive() then return end

	state.reconnectScheduled = true
	local delay = math.max(0, state.reconnectAttemptDelay or config.CONFIG.reconnectDelay or 0)

	task.delay(delay, function()
		state.reconnectScheduled = false

		if state.connected or not state.isBridgeAlive() then return end

		local connectState = connect(false)
		if connectState == 'connected' then
			state.reconnectAttemptDelay = config.CONFIG.reconnectDelay
			return
		end
		if connectState == 'blocked' then
			scheduleReconnect()
			return
		end

		local nextDelay = state.reconnectAttemptDelay
		if nextDelay == nil or nextDelay <= 0 then
			nextDelay = config.CONFIG.reconnectDelay
		elseif nextDelay < config.CONFIG.reconnectDelayMax then
			nextDelay = math.min(nextDelay * 2, config.CONFIG.reconnectDelayMax)
		end

		state.reconnectAttemptDelay = nextDelay
		scheduleReconnect()
	end)
end

connect = function(scheduleOnFailure)
	if not state.isBridgeAlive() then return false end
	if scheduleOnFailure == nil then scheduleOnFailure = true end

	-- Hot-reload fast path: a previous instance left a reusable live socket.
	-- Adopt it rather than opening a new one. The socket's OnMessage/OnClose
	-- trampolines already route through the global dispatch, so repointing
	-- that dispatch is all it takes to take over without any socket churn.
	if reuseSocket ~= nil then
		local ws = reuseSocket
		reuseSocket = nil
		adoptSocket(ws)
		return 'connected'
	end

	if not protocol.canAttemptConnect(config.CONFIG, executor.HttpRequest) then
		if scheduleOnFailure then
			scheduleReconnect()
		end
		return 'blocked'
	end

	local ok, ws = pcall(executor.WebSocket.connect, config.CONFIG.host)
	if not ok or ws == nil then
		if scheduleOnFailure then
			scheduleReconnect()
		end
		return 'failed'
	end

	-- Stable trampolines, connected once per socket. They read the current
	-- handlers from the global each time so a reload can adopt this socket by
	-- repointing the global instead of reconnecting the events.
	ws.OnMessage:Connect(function(raw)
		local bridge = getgenv and getgenv()._RBXDEV_BRIDGE
		local dispatch = bridge ~= nil and bridge.dispatch or nil
		if dispatch ~= nil then dispatch(raw) else handleMessage(raw) end
	end)

	ws.OnClose:Connect(function()
		local bridge = getgenv and getgenv()._RBXDEV_BRIDGE
		if bridge ~= nil then bridge.socketReusable = false end
		local closer = bridge ~= nil and bridge.onClose or nil
		if closer ~= nil then closer() else onSocketClose() end
	end)

	adoptSocket(ws)
	return 'connected'
end

task.defer(connect)
consoleHandler.setupLogHooks()
