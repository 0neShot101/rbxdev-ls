--[[ Dependencies ]]--

local state    = require('state')
local protocol = require('protocol')

local M = {}

local nativeIsA = game.IsA
local nextCall  = 0

--[[ Functions ]]--

local shouldCaptureCaller = function()
  local source = state.remoteSpySource or 'game'

  if type(checkcaller) ~= 'function' then
    return source == 'both', 'unknown'
  end

  local ok, isExecutorCaller = pcall(checkcaller)

  if not ok or type(isExecutorCaller) ~= 'boolean' then
    return source == 'both', 'unknown'
  end

  local origin = isExecutorCaller and 'executor' or 'game'
  return source == 'both' or source == origin, origin
end

local observing = setmetatable({}, { __mode = 'k' })

local observe = function(callback, ...)
  local thread = coroutine.running() or state

  if observing[thread] then
    return false
  end

  observing[thread] = true
  local ok, first, second = pcall(callback, ...)
  observing[thread] = nil

  return ok, first, second
end

local getNamecallMethodSafe = function()
  if type(getnamecallmethod) ~= 'function' then
    return nil
  end
  local ok, method = pcall(getnamecallmethod)
  if not ok or type(method) ~= 'string' then
    return nil
  end
  return method
end

local restoreNamecallMethodSafe = function(method)
  if type(setnamecallmethod) ~= 'function' then
    return
  end
  if type(method) ~= 'string' then
    return
  end
  pcall(setnamecallmethod, method)
end

local getRemoteClass = function(self, method)
  if typeof(self) ~= 'Instance' then
    return nil
  end

  if method == 'FireServer' then
    local okEvent, isEvent = pcall(nativeIsA, self, 'RemoteEvent')
    if okEvent and isEvent == true then
      return 'RemoteEvent'
    end

    local okUnreliable, isUnreliable = pcall(nativeIsA, self, 'UnreliableRemoteEvent')
    if okUnreliable and isUnreliable == true then
      return 'UnreliableRemoteEvent'
    end
  elseif method == 'InvokeServer' then
    local okFunction, isFunction = pcall(nativeIsA, self, 'RemoteFunction')
    if okFunction and isFunction == true then
      return 'RemoteFunction'
    end
  end

  return nil
end

local createCapture = function(logRemoteCall)
  return function(method, self, ...)
    if not state.remoteSpyEnabled then
      return false
    end

    local accepted, origin = shouldCaptureCaller()

    if not accepted then
      return false
    end
    local className = getRemoteClass(self, method)
    if className == nil then
      return false
    end

    local blocked, remoteName, remotePath = protocol.getRemoteBlockState(self)
    local onReturn = logRemoteCall(self, method, className, blocked, remoteName, remotePath, origin, ...)
    return blocked == true, onReturn
  end
end

local forwardReturns = function(onReturn, method, ...)
  observe(onReturn, ...)
  restoreNamecallMethodSafe(method)
  return ...
end

local wrapProxy = function(proxy)
  if type(newcclosure) == 'function' then
    local ok, wrapped = pcall(newcclosure, proxy)
    if ok and type(wrapped) == 'function' then
      return wrapped
    end
  end
  return proxy
end

local createNamecallProxy = function(logRemoteCall)
  local original
  local capture = createCapture(logRemoteCall)
  local proxy = wrapProxy(function(...)
    local method = getNamecallMethodSafe()
    local onReturn
    if method == 'FireServer' or method == 'InvokeServer' then
      local ok, blocked, finish = observe(capture, method, ...)
      if ok and blocked == true then
        restoreNamecallMethodSafe(method)
        return nil
      end
      if ok then
        onReturn = finish
      end
    end
    restoreNamecallMethodSafe(method)
    if type(onReturn) == 'function' then
      return forwardReturns(onReturn, method, original(...))
    end
    return original(...)
  end)
  return proxy, function(fn)
    original = fn
  end
end

local rememberCleanup = function(cleanup)
  state.spyCleanup = cleanup
  if getgenv and getgenv()._RBXDEV_BRIDGE then
    getgenv()._RBXDEV_BRIDGE.spyCleanup = cleanup
  end
end

local installMethodHooks = function(logRemoteCall)
  local hook = hookfunction
  if type(hook) ~= 'function' then
    return nil, 'hookfunction unavailable'
  end

  local installed = {}
  local cleanup = function()
    local errors = {}
    for i = #installed, 1, -1 do
      local entry = installed[i]
      local ok, err = pcall(hook, entry.target, entry.original)
      if ok then
        table.remove(installed, i)
      else
        table.insert(errors, tostring(err))
      end
    end
    if #errors > 0 then
      error(table.concat(errors, '; '))
    end
  end
  local capture         = createCapture(logRemoteCall)
  local missingOriginal = false
  local install = function(className, method)
    local instance = Instance.new(className)
    local okTarget, target = pcall(function()
      return instance[method]
    end)
    instance:Destroy()
    if not okTarget or type(target) ~= 'function' then
      error(className .. '.' .. method .. ' unavailable')
    end
    for _, entry in ipairs(installed) do
      if entry.target == target then
        return
      end
    end

    local original
    local proxy = wrapProxy(function(...)
      local ok, blocked, onReturn = observe(capture, method, ...)
      if ok and blocked == true then
        return nil
      end
      if ok and type(onReturn) == 'function' then
        return forwardReturns(onReturn, method, original(...))
      end
      return original(...)
    end)
    original = hook(target, proxy)
    if type(original) ~= 'function' then
      missingOriginal = true
      error(className .. '.' .. method .. ' hook returned no original')
    end
    table.insert(installed, { target = target, original = original })
  end

  local ok, err = pcall(function()
    install('RemoteEvent', 'FireServer')
    install('UnreliableRemoteEvent', 'FireServer')
    install('RemoteFunction', 'InvokeServer')
  end)
  if not ok then

    local okCleanup, cleanupError = pcall(cleanup)
    if not okCleanup then
      rememberCleanup(cleanup)
      return nil, tostring(err) .. '; rollback failed: ' .. tostring(cleanupError), true
    end
    return nil, tostring(err), missingOriginal
  end
  return cleanup, 'method hooks'
end

local installMetamethodHook = function(logRemoteCall)
  local hook = hookmetamethod
  if type(hook) ~= 'function' then
    return nil, 'hookmetamethod unavailable'
  end
  if type(getnamecallmethod) ~= 'function' then
    return nil, 'getnamecallmethod unavailable'
  end
  if type(setnamecallmethod) ~= 'function' then
    return nil, 'setnamecallmethod unavailable'
  end
  local proxy, bindOriginal = createNamecallProxy(logRemoteCall)
  local original = hook(game, '__namecall', proxy)
  if type(original) ~= 'function' then
    return nil, 'namecall hook returned no original', true
  end
  bindOriginal(original)
  return function()
    hook(game, '__namecall', original)
  end, 'namecall hook'
end

local installRawNamecallHook = function(logRemoteCall)
  if type(getrawmetatable) ~= 'function' then
    return nil, 'getrawmetatable unavailable'
  end
  if type(getnamecallmethod) ~= 'function' then
    return nil, 'getnamecallmethod unavailable'
  end
  if type(setnamecallmethod) ~= 'function' then
    return nil, 'setnamecallmethod unavailable'
  end
  local mt = getrawmetatable(game)
  if type(mt) ~= 'table' then
    return nil, 'raw metatable unavailable'
  end
  local original = rawget(mt, '__namecall')
  if type(original) ~= 'function' then
    return nil, 'native dispatch handler unavailable'
  end

  local proxy, bindOriginal = createNamecallProxy(logRemoteCall)
  bindOriginal(original)
  local readLock, setLock = isreadonly, setreadonly
  local swap = function(expected, replacement)

    if rawget(mt, '__namecall') ~= expected then
      return
    end
    local okWrite, writeError = pcall(rawset, mt, '__namecall', replacement)
    if okWrite then
      return
    end

    if type(readLock) ~= 'function' or type(setLock) ~= 'function' then
      error('metatable write rejected: ' .. tostring(writeError))
    end
    local wasReadonly = readLock(mt)
    if wasReadonly ~= true then
      error(tostring(writeError))
    end
    setLock(mt, false)
    local okSwap, swapError = pcall(rawset, mt, '__namecall', replacement)
    local okRestore, restoreError = pcall(setLock, mt, wasReadonly)
    if not okRestore then

      pcall(rawset, mt, '__namecall', expected)
      error('metatable lock restore failed: ' .. tostring(restoreError))
    end
    if not okSwap then
      error(tostring(swapError))
    end
  end
  swap(original, proxy)
  return function()
    swap(proxy, original)
  end, 'raw namecall'
end

local installRemoteSpy = function(logRemoteCall)
  local errors = {}

  for _, install in ipairs({ installMetamethodHook, installRawNamecallHook, installMethodHooks }) do
    local ok, cleanup, detail, fatal = pcall(install, logRemoteCall)
    if ok and type(cleanup) == 'function' then
      return cleanup, detail
    end
    table.insert(errors, tostring(ok and detail or cleanup))
    if fatal then
      break
    end
  end
  return nil, table.concat(errors, '; ')
end

M.handleSetRemoteSpyEnabled = function(message)

  local ok, err = pcall(function()
    local source = message.source or state.remoteSpySource or 'game'

    if source ~= 'game' and source ~= 'executor' and source ~= 'both' then
      error('Invalid capture source: expected game, executor, or both')
    end

    if message.enabled and source ~= 'both' then
      local classified, caller

      if type(checkcaller) == 'function' then
        classified, caller = pcall(checkcaller)
      end

      if not classified or type(caller) ~= 'boolean' then
        error('Capture source filtering requires a working checkcaller; select Both with this executor')
      end
    end

    if message.enabled and not state.remoteSpyEnabled then
      if state.spyCleanup ~= nil then
        state.spyCleanup()
        rememberCleanup(nil)
      end
      local logRemoteCall = function(self, method, className, blocked, remoteName, remotePath, origin, ...)
        local args    = { ... }
        local numArgs = select('#', ...)
        local ok, onReturn = pcall(function()
          if not state.remoteSpyEnabled or not state.connected then
            return
          end
          if
            blocked ~= true
            and state.remoteSpyFilter ~= ''
            and remoteName:lower():find(state.remoteSpyFilter:lower()) == nil
          then
            return
          end

          nextCall = nextCall + 1
          local call = {
            id = tostring(state.BRIDGE_ID or 'spy') .. ':' .. tostring(nextCall),
            remoteName = remoteName,
            remotePath = remotePath,
            remoteType = className,
            method = method,
            arguments = protocol.serializeArguments(unpack(args, 1, numArgs)),
            code = protocol.generateRemoteCode(self, method, unpack(args, 1, numArgs)),
            timestamp = os.time(),
            source = origin,
            _blocked = blocked == true,
          }
          if method == 'InvokeServer' then
            call.returnStatus = blocked == true and 'blocked' or 'pending'
          end
          protocol.send({ type = 'remoteSpy', call = call })
          if method ~= 'InvokeServer' or blocked == true then
            return nil
          end
          return function(...)
            if not state.connected then
              return
            end
            if state.isBridgeAlive and not state.isBridgeAlive() then
              return
            end
            call.returnCount = select('#', ...)
            local serialized, values = pcall(protocol.serializeArguments, ...)
            call.returnStatus = serialized and 'returned' or 'unavailable'
            call.returns = serialized and values or nil
            protocol.send({ type = 'remoteSpy', call = call })
          end
        end)
        if ok then
          return onReturn
        end
      end

      local cleanup, strategyOrError = installRemoteSpy(logRemoteCall)
      if cleanup == nil then
        error('Failed to install remote spy hook: ' .. tostring(strategyOrError))
      end

      rememberCleanup(cleanup)
      print('[rbxdev-bridge] Remote spy enabled (' .. tostring(strategyOrError) .. ')')

      if strategyOrError == 'method hooks' then
        print(
          '[rbxdev-bridge] Method-hook fallback: namecall capture is unavailable; game colon-call coverage is executor-dependent'
        )
      end

      state.remoteSpyEnabled = true

    elseif not message.enabled and (state.remoteSpyEnabled or state.spyCleanup ~= nil) then
      if state.spyCleanup ~= nil then
        state.spyCleanup()
        rememberCleanup(nil)
      end
      state.remoteSpyEnabled = false
      print('[rbxdev-bridge] Remote spy disabled')
    end

    state.remoteSpySource = source
  end)

  if not ok then
    protocol.sendResult('setRemoteSpyEnabledResult', message.id, false, { error = tostring(err) })
    return
  end

  protocol.sendResult('setRemoteSpyEnabledResult', message.id, true, {
    enabled = state.remoteSpyEnabled,
    source = state.remoteSpySource or 'game',
  })
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
