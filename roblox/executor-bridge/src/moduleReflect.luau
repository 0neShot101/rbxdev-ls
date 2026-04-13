local M = {}

M.reflectModuleInterface = function(module)
	local moduleType = type(module)
	local interface = { kind = moduleType }

	if moduleType == 'function' then
		local info = debug.getinfo(module, 'u')
		interface.functionArity = info and info.nparams or 0
		return interface
	end

	if moduleType == 'table' then
		local props = {}
		for key, value in pairs(module) do
			if type(key) ~= 'string' then continue end
			local prop = { name = key, valueKind = type(value) }
			if type(value) == 'function' then
				local info = debug.getinfo(value, 'u')
				prop.functionArity = info and info.nparams or 0
			end
			table.insert(props, prop)
		end
		interface.properties = props
		return interface
	end

	interface.kind = 'other'
	return interface
end

return M
