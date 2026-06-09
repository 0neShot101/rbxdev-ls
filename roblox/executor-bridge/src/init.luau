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

-- Cleanup previous bridge instance
if getgenv and getgenv()._RBXDEV_BRIDGE then
	local old = getgenv()._RBXDEV_BRIDGE
	if old.connection then pcall(old.connection.Close, old.connection) end
	for _, conn in ipairs(old.refreshConnections or {}) do pcall(conn.Disconnect, conn) end
	if old.spyCleanup ~= nil then
		pcall(old.spyCleanup)
		old.spyCleanup = nil
	end
	old.alive = false
end

-- Apply user config from varargs
local userConfig = (...) or {}
config.applyUserConfig(userConfig)

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

	state.connection = ws
	state.connected = true
	state.reconnectScheduled = false
	state.reconnectAttemptDelay = config.CONFIG.reconnectDelay
	state.healthProbeFailures = 0

	if getgenv and getgenv()._RBXDEV_BRIDGE then
		getgenv()._RBXDEV_BRIDGE.connection = ws
	end

	protocol.send{ type = 'connected', executorName = executor.name, version = executor.version }
	protocol.send{ type = 'gameTree', data = gameTree.getGameTree(nil, config.CONFIG.firstConnectDepth) }

	ws.OnMessage:Connect(handleMessage)

	ws.OnClose:Connect(function()
		state.connected = false
		state.connection = nil
		gameTree.shutdownAutoRefresh()
		scheduleReconnect()
	end)

	return 'connected'
end

task.defer(connect)
consoleHandler.setupLogHooks()
