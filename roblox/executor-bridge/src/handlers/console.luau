local state = require("state")
local protocol = require("protocol")

local M = {}

M.setupLogHooks = function()
	-- Prevent double-hooking on re-execution
	if getgenv and getgenv()._RBXDEV_LOG_HOOKED then return end

	local inHook = false

	local safeLog = function(level, ...)
		if inHook or not state.connected then return end
		inHook = true

		local args = { ... }
		local parts = {}
		for i = 1, select('#', ...) do parts[i] = tostring(args[i]) end

		pcall(protocol.send, {
			type = 'log',
			level = level,
			message = table.concat(parts, '\t'),
			timestamp = os.time(),
		})

		inHook = false
	end

	if hookfunction ~= nil then
		local originalPrint = clonefunction(print)
		local originalWarn = clonefunction(warn)
		local originalError = clonefunction(error)

		hookfunction(print, function(...)
			safeLog('info', ...)
			return originalPrint(...)
		end)

		hookfunction(warn, function(...)
			safeLog('warn', ...)
			return originalWarn(...)
		end)

		hookfunction(error, function(message, level)
			safeLog('error', message)
			return originalError(message, level)
		end)

		if getgenv then getgenv()._RBXDEV_LOG_HOOKED = true end
		return
	end

	local originalPrint = print
	local originalWarn = warn

	getgenv().print = function(...)
		safeLog('info', ...)
		return originalPrint(...)
	end

	getgenv().warn = function(...)
		safeLog('warn', ...)
		return originalWarn(...)
	end

	if getgenv then getgenv()._RBXDEV_LOG_HOOKED = true end
end

return M
