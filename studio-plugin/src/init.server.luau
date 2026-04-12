local HttpService = game:GetService'HttpService'

local protocol = require(script.protocol)
local gameTreeHandler = require(script.handlers.gameTree)
local propertiesHandler = require(script.handlers.properties)
local instancesHandler = require(script.handlers.instances)
local teleportHandler = require(script.handlers.teleport)
local consoleHandler = require(script.handlers.console)
local scriptSourceHandler = require(script.handlers.scriptSource)
local executeHandler = require(script.handlers.execute)

local BRIDGE_URL = 'ws://127.0.0.1:21324'
local RECONNECT_DELAY = 3
local PLUGIN_NAME = 'RbxdevStudio'
local PLUGIN_VERSION = '0.1.0'

print'[rbxdev-studio] Plugin loaded'

local client = nil
local isConnected = false

local sendMessage = function(data)
	if client == nil or not isConnected then return end
	local ok, encoded = pcall(protocol.jsonEncode, data)
	if ok then
		pcall(function() client:Send(encoded) end)
	end
end

local sendResult = function(messageType, id, success, payload)
	local result = { type = messageType, id = id, success = success }
	for k, v in pairs(payload or {}) do result[k] = v end
	sendMessage(result)
end

local notSupported = function(messageType, id, feature)
	sendResult(messageType, id, false, { error = feature .. ' is not supported in Studio mode' })
end

local MESSAGE_HANDLERS = {}

MESSAGE_HANDLERS.execute = function(message)
	local result = executeHandler.run(message.code)
	sendResult('executeResult', message.id, result.success, {
		result = result.result,
		error = result.error,
	})
end

MESSAGE_HANDLERS.requestGameTree = function(message)
	sendMessage{ type = 'gameTree', data = gameTreeHandler.buildTree(message.services) }
end

MESSAGE_HANDLERS.setAutoRefresh = function(message)
	gameTreeHandler.setAutoRefresh(message.enabled, message.intervalMs, function(tree)
		sendMessage{ type = 'gameTree', data = tree }
	end)
end

MESSAGE_HANDLERS.requestChildren = function(message)
	local result = gameTreeHandler.getChildren(message.path)
	sendResult('childrenResult', message.id, result.success, {
		children = result.children,
		error = result.error,
	})
end

MESSAGE_HANDLERS.requestProperties = function(message)
	local result = propertiesHandler.getProperties(message.path, message.properties)
	sendResult('propertiesResult', message.id, result.success, {
		properties = result.properties,
		error = result.error,
	})
end

MESSAGE_HANDLERS.setProperty = function(message)
	local result = propertiesHandler.setProperty(message.path, message.property, message.value, message.valueType)
	sendResult('setPropertyResult', message.id, result.success, { error = result.error })
end

MESSAGE_HANDLERS.teleportTo = function(message)
	local result = teleportHandler.teleportTo(message.path)
	sendResult('teleportToResult', message.id, result.success, { error = result.error })
end

MESSAGE_HANDLERS.deleteInstance = function(message)
	local result = instancesHandler.deleteInstance(message.path)
	sendResult('deleteInstanceResult', message.id, result.success, { error = result.error })
end

MESSAGE_HANDLERS.reparentInstance = function(message)
	local result = instancesHandler.reparentInstance(message.sourcePath, message.targetPath)
	sendResult('reparentInstanceResult', message.id, result.success, { error = result.error })
end

MESSAGE_HANDLERS.createInstance = function(message)
	local result = instancesHandler.createInstance(message.className, message.parentPath, message.name)
	sendResult('createInstanceResult', message.id, result.success, {
		instanceName = result.instanceName,
		error = result.error,
	})
end

MESSAGE_HANDLERS.cloneInstance = function(message)
	local result = instancesHandler.cloneInstance(message.path)
	sendResult('cloneInstanceResult', message.id, result.success, {
		cloneName = result.cloneName,
		error = result.error,
	})
end

MESSAGE_HANDLERS.requestScriptSource = function(message)
	local result = scriptSourceHandler.getSource(message.path)
	sendResult('scriptSourceResult', message.id, result.success, {
		source = result.source,
		scriptType = result.scriptType,
		error = result.error,
	})
end

MESSAGE_HANDLERS.setScriptSource = function(message)
	local result = scriptSourceHandler.setSource(message.path, message.source)
	sendResult('setScriptSourceResult', message.id, result.success, { error = result.error })
end

MESSAGE_HANDLERS.requestModuleInterface = function(message)
	local moduleRef = message.moduleRef
	if moduleRef == nil then
		sendResult('moduleInterface', message.id, false, { error = 'No module reference provided' })
		return
	end

	if moduleRef.kind == 'path' then
		local instance = protocol.resolveInstancePath(moduleRef.path)
		if instance == nil then
			sendResult('moduleInterface', message.id, false, { error = 'Module not found at: ' .. table.concat(moduleRef.path, '.') })
			return
		end
		if not instance:IsA'ModuleScript' then
			sendResult('moduleInterface', message.id, false, { error = 'Instance is not a ModuleScript' })
			return
		end

		local ok, module = pcall(require, instance)
		if not ok then
			sendResult('moduleInterface', message.id, false, { error = tostring(module) })
			return
		end

		local interface = { kind = type(module) }
		if type(module) == 'table' then
			local props = {}
			for key, value in pairs(module) do
				if type(key) ~= 'string' then continue end
				local prop = { name = key, valueKind = type(value) }
				if type(value) == 'function' then
					prop.functionArity = 0
				end
				table.insert(props, prop)
			end
			interface.properties = props
		end

		sendResult('moduleInterface', message.id, true, { interface = interface })
	else
		sendResult('moduleInterface', message.id, false, { error = 'Unsupported module reference kind' })
	end
end

MESSAGE_HANDLERS.setRemoteSpyEnabled = function(message)
	notSupported('setRemoteSpyEnabledResult', message.id, 'Remote Spy')
end

MESSAGE_HANDLERS.setRemoteSpyFilter = function(message)
	notSupported('setRemoteSpyFilterResult', message.id, 'Remote Spy')
end

MESSAGE_HANDLERS.setRemoteSpyBlockList = function(message)
	notSupported('setRemoteSpyBlockListResult', message.id, 'Remote Spy')
end

local handleServerMessage = function(raw)
	local message = protocol.jsonDecode(raw)
	if message == nil or type(message) ~= 'table' then return end

	local msgType = message.type
	if msgType == nil then return end

	local handler = MESSAGE_HANDLERS[msgType]
	if handler ~= nil then
		local ok, err = pcall(handler, message)
		if not ok then
			warn('[rbxdev-studio] Handler error for ' .. tostring(msgType) .. ': ' .. tostring(err))
		end
	end
end

local reconnecting = false

local scheduleReconnect = function()
	if reconnecting then return end
	reconnecting = true
	isConnected = false
	client = nil
	task.delay(RECONNECT_DELAY, function()
		reconnecting = false
		connect()
	end)
end

local connect
connect = function()
	local ok, wsClient = pcall(function()
		return HttpService:CreateWebStreamClient(
			Enum.WebStreamClientType.WebSocket,
			{ Url = BRIDGE_URL }
		)
	end)

	if not ok or wsClient == nil then
		warn('[rbxdev-studio] WebSocket connection failed, retrying in ' .. RECONNECT_DELAY .. 's')
		task.delay(RECONNECT_DELAY, connect)
		return
	end

	print('[rbxdev-studio] WebSocket connecting to ' .. BRIDGE_URL)

	client = wsClient

	wsClient.Opened:Connect(function()
		print'[rbxdev-studio] Connected to bridge'
		isConnected = true
		sendMessage{
			type = 'connected',
			executorName = PLUGIN_NAME,
			version = PLUGIN_VERSION,
			clientType = 'studio',
		}
		sendMessage{ type = 'gameTree', data = gameTreeHandler.buildFirstConnectTree() }
	end)

	wsClient.MessageReceived:Connect(function(message)
		handleServerMessage(message)
	end)

	wsClient.Closed:Connect(function()
		warn'[rbxdev-studio] Disconnected from bridge, reconnecting...'
		gameTreeHandler.shutdownAutoRefresh()
		scheduleReconnect()
	end)

	wsClient.Error:Connect(function(statusCode, errorMessage)
		warn('[rbxdev-studio] WebSocket error:', statusCode, errorMessage)
		gameTreeHandler.shutdownAutoRefresh()
		scheduleReconnect()
	end)
end

consoleHandler.setup(sendMessage)

if plugin ~= nil then
	plugin.Unloading:Connect(function()
		gameTreeHandler.shutdownAutoRefresh()
	end)
end

connect()
