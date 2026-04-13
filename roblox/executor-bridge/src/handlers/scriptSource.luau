local protocol = require("protocol")

local M = {}

M.handleRequestScriptSource = function(message)
	local instance = protocol.resolveInstancePath(message.path)
	if instance == nil then
		protocol.sendResult('scriptSourceResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end

	if not (instance:IsA'LocalScript' or instance:IsA'ModuleScript' or instance:IsA'Script') then
		protocol.sendResult('scriptSourceResult', message.id, false, { error = instance.ClassName .. ' is not a script type' })
		return
	end

	local decompilerFunc = decompile or decompilescript or getscriptsource or getsourcescript or get_script_source or nil
	if decompilerFunc == nil then
		protocol.sendResult('scriptSourceResult', message.id, false, { error = 'No decompiler available in this executor' })
		return
	end

	local ok, source = pcall(decompilerFunc, instance)
	if not ok then
		protocol.sendResult('scriptSourceResult', message.id, false, { error = 'Decompilation failed: ' .. tostring(source) })
		return
	end

	protocol.sendResult('scriptSourceResult', message.id, true, { source = source, scriptType = instance.ClassName })
end

return M
