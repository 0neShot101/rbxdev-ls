local state = require("state")
local protocol = require("protocol")

local M = {}

local isOthHookAvailable = function()
	return type(oth) == 'table' and type(oth.hook) == 'function'
end

local hasAnyHookStrategy = function()
	if type(hookmetamethod) == 'function' then return true end
	if type(hookfunction) == 'function' and type(getrawmetatable) == 'function' then return true end
	if isOthHookAvailable() then return true end
	return false
end

local getNamecallMethodSafe = function()
	if type(getnamecallmethod) ~= 'function' then return nil end
	local ok, method = pcall(getnamecallmethod)
	if not ok or type(method) ~= 'string' then return nil end
	return method
end

local restoreNamecallMethodSafe = function(method)
	if type(setnamecallmethod) ~= 'function' then return end
	if type(method) ~= 'string' then return end
	pcall(setnamecallmethod, method)
end

local createNamecallProxy = function(logRemoteCall)
	local oldNamecall = nil
	local proxy = function(self, ...)
		local method = getNamecallMethodSafe()
		if method == 'FireServer' or method == 'InvokeServer' then
			local blocked, remoteName, remotePath = protocol.getRemoteBlockState(self)
			logRemoteCall(self, method, blocked, remoteName, remotePath, ...)
			if blocked then
				restoreNamecallMethodSafe(method)
				return nil
			end
		end

		restoreNamecallMethodSafe(method)
		if oldNamecall == nil then return nil end
		return oldNamecall(self, ...)
	end

	local bindOriginal = function(original)
		oldNamecall = original
	end

	return proxy, bindOriginal
end

local installWithHookMetamethod = function(logRemoteCall)
	if type(hookmetamethod) ~= 'function' then
		return nil, 'hookmetamethod unavailable'
	end

	local proxy, bindOriginal = createNamecallProxy(logRemoteCall)
	if type(newcclosure) == 'function' then
		proxy = newcclosure(proxy)
	end

	local oldNamecall = hookmetamethod(game, '__namecall', proxy)
	if type(oldNamecall) ~= 'function' then
		return nil, 'hookmetamethod did not return a callable original'
	end
	bindOriginal(oldNamecall)

	return function()
		hookmetamethod(game, '__namecall', oldNamecall)
	end, 'hookmetamethod'
end

local installWithHookfunction = function(logRemoteCall)
	if type(hookfunction) ~= 'function' then
		return nil, 'hookfunction unavailable'
	end
	if type(getrawmetatable) ~= 'function' then
		return nil, 'getrawmetatable unavailable'
	end

	local mt = getrawmetatable(game)
	if type(mt) ~= 'table' then
		return nil, 'raw metatable unavailable'
	end

	local ncFunc = rawget(mt, '__namecall')
	if type(ncFunc) ~= 'function' then
		return nil, '__namecall missing from raw metatable'
	end

	local proxy, bindOriginal = createNamecallProxy(logRemoteCall)
	local oldNamecall = hookfunction(ncFunc, proxy)
	if type(oldNamecall) ~= 'function' then
		return nil, 'hookfunction did not return a callable original'
	end
	bindOriginal(oldNamecall)

	return function()
		hookfunction(ncFunc, oldNamecall)
	end, 'hookfunction'
end

local installWithOthHook = function(logRemoteCall)
	if not isOthHookAvailable() then
		return nil, 'oth.hook unavailable'
	end
	if type(getrawmetatable) ~= 'function' then
		return nil, 'getrawmetatable unavailable for oth.hook'
	end

	local mt = getrawmetatable(game)
	if type(mt) ~= 'table' then
		return nil, 'raw metatable unavailable for oth.hook'
	end

	local ncFunc = rawget(mt, '__namecall')
	if type(ncFunc) ~= 'function' then
		return nil, '__namecall missing for oth.hook'
	end

	local proxy, bindOriginal = createNamecallProxy(logRemoteCall)
	local oldNamecall = oth.hook(ncFunc, proxy)
	if type(oldNamecall) ~= 'function' then
		return nil, 'oth.hook did not return a callable original'
	end
	bindOriginal(oldNamecall)

	return function()
		if type(oth.unhook) == 'function' then
			oth.unhook(ncFunc)
		else
			oth.hook(ncFunc, oldNamecall)
		end
	end, 'oth.hook'
end

local installNamecallHook = function(logRemoteCall)
	local errors = {}
	local strategies = {
		installWithHookMetamethod,
		installWithHookfunction,
		installWithOthHook,
	}

	for _, installer in ipairs(strategies) do
		local ok, cleanup, strategyOrError = pcall(installer, logRemoteCall)
		if ok and type(cleanup) == 'function' then
			return cleanup, strategyOrError
		end
		if ok then
			table.insert(errors, tostring(cleanup))
		else
			table.insert(errors, tostring(cleanup))
		end
	end

	return nil, table.concat(errors, '; ')
end

M.handleSetRemoteSpyEnabled = function(message)
	if not hasAnyHookStrategy() then
		protocol.sendResult('setRemoteSpyEnabledResult', message.id, false, { error = 'No hooking method available in this executor' })
		return
	end

	local ok, err = pcall(function()
		if message.enabled and not state.remoteSpyEnabled then
			local logRemoteCall = function(self, method, blocked, remoteName, remotePath, ...)
				local args = { ... }
				pcall(function()
					if not state.remoteSpyEnabled or not state.connected then return end
					if typeof(self) ~= 'Instance' then return end

					local className = self.ClassName
					if className ~= 'RemoteEvent' and className ~= 'RemoteFunction' and className ~= 'UnreliableRemoteEvent' then return end

					if blocked ~= true and state.remoteSpyFilter ~= '' and remoteName:lower():find(state.remoteSpyFilter:lower()) == nil then return end

					protocol.send({
						type = 'remoteSpy',
						call = {
							remoteName = remoteName,
							remotePath = remotePath,
							remoteType = className,
							method = method,
							arguments = protocol.serializeArguments(unpack(args)),
							code = protocol.generateRemoteCode(self, method, unpack(args)),
							timestamp = os.time(),
							_blocked = blocked == true,
						},
					})
				end)
			end

			local cleanup, strategyOrError = installNamecallHook(logRemoteCall)
			if cleanup == nil then
				error('Failed to install remote spy hook: ' .. tostring(strategyOrError))
			end

			state.spyCleanup = cleanup
			print('[rbxdev-bridge] Remote spy enabled (' .. tostring(strategyOrError) .. ')')

			state.remoteSpyEnabled = true

		elseif not message.enabled and state.remoteSpyEnabled then
			if state.spyCleanup ~= nil then
				pcall(state.spyCleanup)
				state.spyCleanup = nil
			end
			state.remoteSpyEnabled = false
			print'[rbxdev-bridge] Remote spy disabled'
		end
	end)

	if not ok then
		protocol.sendResult('setRemoteSpyEnabledResult', message.id, false, { error = tostring(err) })
		return
	end

	protocol.sendResult('setRemoteSpyEnabledResult', message.id, true, { enabled = state.remoteSpyEnabled })
end

M.handleSetRemoteSpyFilter = function(message)
	state.remoteSpyFilter = message.filter or ''
	protocol.sendResult('setRemoteSpyFilterResult', message.id, true)
end

M.handleSetRemoteSpyBlockList = function(message)
	protocol.rebuildRemoteSpyBlockMaps(message.blocks)
	protocol.sendResult('setRemoteSpyBlockListResult', message.id, true)
end

return M
