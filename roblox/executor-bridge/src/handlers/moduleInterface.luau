local protocol = require("protocol")
local moduleReflect = require("moduleReflect")

local M = {}

M.handleRequestModuleInterface = function(message)
	local moduleRef = message.moduleRef
	local module = nil

	if moduleRef.kind == 'path' then
		local instance = protocol.resolveInstancePath(moduleRef.path)
		if instance == nil then
			protocol.sendResult('moduleInterface', message.id, false, { error = 'Module not found at: ' .. table.concat(moduleRef.path, '.') })
			return
		end
		if not instance:IsA'ModuleScript' then
			protocol.sendResult('moduleInterface', message.id, false, { error = 'Instance is not a ModuleScript' })
			return
		end
		local ok, result = pcall(require, instance)
		if not ok then
			protocol.sendResult('moduleInterface', message.id, false, { error = tostring(result) })
			return
		end
		module = result
	elseif moduleRef.kind == 'assetId' then
		local ok, result = pcall(require, moduleRef.id)
		if not ok then
			protocol.sendResult('moduleInterface', message.id, false, { error = tostring(result) })
			return
		end
		module = result
	end

	if module == nil then
		protocol.sendResult('moduleInterface', message.id, false, { error = 'Failed to load module' })
		return
	end

	protocol.sendResult('moduleInterface', message.id, true, { interface = moduleReflect.reflectModuleInterface(module) })
end

return M
