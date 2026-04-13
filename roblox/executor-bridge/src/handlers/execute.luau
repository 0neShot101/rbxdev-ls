local protocol = require("protocol")

local M = {}

M.handleExecute = function(message)
	local fn, loadError = loadstring(message.code)
	if fn == nil then
		protocol.sendResult('executeResult', message.id, false, { error = protocol.parseError(tostring(loadError)) })
		return
	end

	local ok, result = pcall(fn)
	if not ok then
		protocol.sendResult('executeResult', message.id, false, { error = protocol.parseError(tostring(result)) })
		return
	end

	protocol.sendResult('executeResult', message.id, true, { result = result ~= nil and tostring(result) or nil })
end

return M
