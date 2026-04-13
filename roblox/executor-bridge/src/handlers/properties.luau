local config = require("config")
local protocol = require("protocol")

local M = {}

M.handleRequestProperties = function(message)
	local instance = protocol.resolveInstancePath(message.path)
	if instance == nil then
		protocol.sendResult('propertiesResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end
	protocol.sendResult('propertiesResult', message.id, true, { properties = protocol.getInstanceProperties(instance, message.properties, config) })
end

M.handleSetProperty = function(message)
	local instance = protocol.resolveInstancePath(message.path)
	if instance == nil then
		protocol.sendResult('setPropertyResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end

	local ok, err = pcall(function() instance[message.property] = protocol.parseValue(message.value, message.valueType) end)
	if not ok then
		protocol.sendResult('setPropertyResult', message.id, false, { error = tostring(err) })
		return
	end

	protocol.sendResult('setPropertyResult', message.id, true)
end

return M
