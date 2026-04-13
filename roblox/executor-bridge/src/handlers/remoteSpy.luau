local state = require("state")
local protocol = require("protocol")

local M = {}

M.handleSetRemoteSpyEnabled = function(message)
	if oth == nil and hookmetamethod == nil then
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

			if oth ~= nil and type(oth.hook) == 'function' then
				local mt = getrawmetatable(game)
				local ncFunc = rawget(mt, '__namecall')
				local oldNamecall
				oldNamecall = oth.hook(ncFunc, function(self, ...)
					local method = getnamecallmethod()
					if method == 'FireServer' or method == 'InvokeServer' then
						local blocked, remoteName, remotePath = protocol.getRemoteBlockState(self)
						logRemoteCall(self, method, blocked, remoteName, remotePath, ...)
						if blocked then
							setnamecallmethod(method)
							return nil
						end
					end
					setnamecallmethod(method)
					return oldNamecall(self, ...)
				end)

				state.spyCleanup = function()
					if type(oth.unhook) == 'function' then
						oth.unhook(ncFunc)
					else
						oth.hook(ncFunc, oldNamecall)
					end
				end
				print'[rbxdev-bridge] Remote spy enabled (oth)'

			else
				local oldNamecall
				oldNamecall = hookmetamethod(game, '__namecall', newcclosure(function(self, ...)
					local method = getnamecallmethod()
					if method == 'FireServer' or method == 'InvokeServer' then
						local blocked, remoteName, remotePath = protocol.getRemoteBlockState(self)
						logRemoteCall(self, method, blocked, remoteName, remotePath, ...)
						if blocked then
							setnamecallmethod(method)
							return nil
						end
					end
					setnamecallmethod(method)
					return oldNamecall(self, ...)
				end))

				state.spyCleanup = function()
					hookmetamethod(game, '__namecall', oldNamecall)
				end
				print'[rbxdev-bridge] Remote spy enabled (hookmetamethod)'
			end

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
