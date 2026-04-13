local protocol = require(script.Parent.Parent.protocol)

local scriptSource = {}

local SCRIPT_TYPES = { Script = true, LocalScript = true, ModuleScript = true }

scriptSource.getSource = function(path)
	local instance = protocol.resolveInstancePath(path)
	if instance == nil then
		return { success = false, error = 'Instance not found at: ' .. table.concat(path, '.') }
	end

	if SCRIPT_TYPES[instance.ClassName] == nil then
		return { success = false, error = instance.ClassName .. ' is not a script type' }
	end

	local ok, source = pcall(function()
		return instance.Source
	end)

	if not ok then
		return { success = false, error = 'Failed to read script source: ' .. tostring(source) }
	end

	return { success = true, source = source, scriptType = instance.ClassName }
end

scriptSource.setSource = function(path, source)
	local instance = protocol.resolveInstancePath(path)
	if instance == nil then
		return { success = false, error = 'Instance not found at: ' .. table.concat(path, '.') }
	end

	if SCRIPT_TYPES[instance.ClassName] == nil then
		return { success = false, error = instance.ClassName .. ' is not a script type' }
	end

	local ok, err = pcall(function()
		instance.Source = source
	end)

	if not ok then
		return { success = false, error = 'Failed to write script source: ' .. tostring(err) }
	end

	return { success = true }
end

return scriptSource
