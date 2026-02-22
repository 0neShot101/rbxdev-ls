local protocol = require(script.Parent.Parent.protocol)

local instances = {}

instances.createInstance = function(className, parentPath, name)
	local parent = protocol.resolveInstancePath(parentPath)
	if parent == nil then
		return { success = false, error = 'Parent not found at: ' .. table.concat(parentPath, '.') }
	end

	local ok, result = pcall(function()
		local inst = Instance.new(className)
		if name ~= nil then inst.Name = name end
		inst.Parent = parent
		return inst.Name
	end)

	if not ok then
		return { success = false, error = tostring(result) }
	end

	return { success = true, instanceName = result }
end

instances.cloneInstance = function(path)
	local instance = protocol.resolveInstancePath(path)
	if instance == nil then
		return { success = false, error = 'Instance not found at: ' .. table.concat(path, '.') }
	end

	local ok, result = pcall(function()
		local clone = instance:Clone()
		if clone == nil then error('Instance cannot be cloned') end
		clone.Parent = instance.Parent
		return clone.Name
	end)

	if not ok then
		return { success = false, error = tostring(result) }
	end

	return { success = true, cloneName = result }
end

instances.deleteInstance = function(path)
	local instance = protocol.resolveInstancePath(path)
	if instance == nil then
		return { success = false, error = 'Instance not found at: ' .. table.concat(path, '.') }
	end

	local ok, err = pcall(instance.Destroy, instance)
	if not ok then
		return { success = false, error = tostring(err) }
	end

	return { success = true }
end

instances.reparentInstance = function(sourcePath, targetPath)
	local source = protocol.resolveInstancePath(sourcePath)
	if source == nil then
		return { success = false, error = 'Source not found at: ' .. table.concat(sourcePath, '.') }
	end

	local target = protocol.resolveInstancePath(targetPath)
	if target == nil then
		return { success = false, error = 'Target not found at: ' .. table.concat(targetPath, '.') }
	end

	local ok, err = pcall(function() source.Parent = target end)
	if not ok then
		return { success = false, error = tostring(err) }
	end

	return { success = true }
end

return instances
