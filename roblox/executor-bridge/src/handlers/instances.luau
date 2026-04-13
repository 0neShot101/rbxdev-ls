local protocol = require("protocol")

local M = {}

M.handleCreateInstance = function(message)
	local parent = protocol.resolveInstancePath(message.parentPath)
	if parent == nil then
		protocol.sendResult('createInstanceResult', message.id, false, { error = 'Parent not found at: ' .. table.concat(message.parentPath, '.') })
		return
	end

	local ok, result = pcall(function()
		local inst = Instance.new(message.className)
		if message.name ~= nil then inst.Name = message.name end
		inst.Parent = parent
		return inst.Name
	end)

	if not ok then
		protocol.sendResult('createInstanceResult', message.id, false, { error = tostring(result) })
		return
	end

	protocol.sendResult('createInstanceResult', message.id, true, { instanceName = result })
end

M.handleCloneInstance = function(message)
	local instance = protocol.resolveInstancePath(message.path)
	if instance == nil then
		protocol.sendResult('cloneInstanceResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end

	local ok, result = pcall(function()
		local clone = instance:Clone()
		if clone == nil then error('Instance cannot be cloned') end
		clone.Parent = instance.Parent
		return clone.Name
	end)

	if not ok then
		protocol.sendResult('cloneInstanceResult', message.id, false, { error = tostring(result) })
		return
	end

	protocol.sendResult('cloneInstanceResult', message.id, true, { cloneName = result })
end

M.handleDeleteInstance = function(message)
	local instance = protocol.resolveInstancePath(message.path)
	if instance == nil then
		protocol.sendResult('deleteInstanceResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end

	local ok, err = pcall(instance.Destroy, instance)
	if not ok then
		protocol.sendResult('deleteInstanceResult', message.id, false, { error = tostring(err) })
		return
	end

	protocol.sendResult('deleteInstanceResult', message.id, true)
end

M.handleReparentInstance = function(message)
	local source = protocol.resolveInstancePath(message.sourcePath)
	if source == nil then
		protocol.sendResult('reparentInstanceResult', message.id, false, { error = 'Source not found at: ' .. table.concat(message.sourcePath, '.') })
		return
	end

	local target = protocol.resolveInstancePath(message.targetPath)
	if target == nil then
		protocol.sendResult('reparentInstanceResult', message.id, false, { error = 'Target not found at: ' .. table.concat(message.targetPath, '.') })
		return
	end

	local ok, err = pcall(function() source.Parent = target end)
	if not ok then
		protocol.sendResult('reparentInstanceResult', message.id, false, { error = tostring(err) })
		return
	end

	protocol.sendResult('reparentInstanceResult', message.id, true)
end

return M
