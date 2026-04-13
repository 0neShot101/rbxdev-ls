local execute = {}

execute.run = function(code)
	local fn, loadError = loadstring(code)
	if fn == nil then
		local file, line, message = tostring(loadError):match'(%S+):(%d+): (.+)'
		return {
			success = false,
			error = {
				message = message or tostring(loadError),
				file = file,
				line = line and tonumber(line) or nil,
			},
		}
	end

	local ok, result = pcall(fn)
	if not ok then
		local file, line, message = tostring(result):match'(%S+):(%d+): (.+)'
		return {
			success = false,
			error = {
				message = message or tostring(result),
				file = file,
				line = line and tonumber(line) or nil,
			},
		}
	end

	return { success = true, result = result ~= nil and tostring(result) or nil }
end

return execute
