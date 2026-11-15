local source, scenario = arg[1], arg[2]
--[[ Functions ]]--

local function pack(...)
  return { n = select('#', ...), ... }
end
local function equal(actual, expected, label)
  assert(actual == expected, (label or 'value') .. ': expected ' .. tostring(expected) .. ', got ' .. tostring(actual))
end
local state = { connected = true, remoteSpyEnabled = false, remoteSpyFilter = '' }
local results, events, forwarded, targets, implementations = {}, {}, {}, {}, {}
local method, executorCaller, captureError, blocked, hookFailure, cleanupFailure
local nativeMode
local recursiveCapture = false
local debugInfo = function()
  return 'untouched'
end
local mt, readonly = {}, true
local env = setmetatable({}, { __index = _G })
env.debug = { info = debugInfo }
env.unpack = unpack or table.unpack
env.print = function() end
env.getgenv = function()
  return { _RBXDEV_BRIDGE = state }
end
env.typeof = function(value)
  if type(value) == 'table' and value.class then
    return 'Instance'
  end
  return type(value)
end
local native = function(...)
  local all = pack(...)
  if all.n == 0 then
    error('native missing receiver', 0)
  end
  local self = all[1]
  if env.typeof(self) ~= 'Instance' then
    error('native receiver error', 0)
  end
  local args = pack(select(2, ...))
  table.insert(forwarded, { self = self, args = args, method = method })
  if nativeMode == 'zero' then
    return
  end
  if nativeMode == 'nil' then
    return nil
  end
  if nativeMode == 'yield' then
    coroutine.yield('waiting')
  end
  return 'native result', nil, args.n
end
local function remote(class, name)
  return { class = class, Name = name or class, Destroy = function() end }
end
for _, class in ipairs({ 'RemoteEvent', 'UnreliableRemoteEvent', 'RemoteFunction' }) do
  local dispatch = native
  local target = function(...)
    return dispatch(...)
  end
  targets[class] = target
  implementations[target] = {
    get = function()
      return dispatch
    end,
    set = function(fn)
      dispatch = fn
    end,
    class = class,
  }
end
mt.__namecall = native
local originalNamecall = mt.__namecall
env.game = {
  IsA = function(self, class)
    return self.class == class
  end,
}
env.Instance = {
  new = function(class)
    local value = remote(class)
    value[class == 'RemoteFunction' and 'InvokeServer' or 'FireServer'] = targets[class]
    return value
  end,
}
env.checkcaller = function()
  return executorCaller == true
end
env.getnamecallmethod = function()
  return method
end
env.setnamecallmethod = function(value)
  method = value
end
env.newcclosure = function(fn)
  return fn
end
env.hookfunction = function(target, replacement)
  local entry = assert(implementations[target], 'unexpected function hook')
  if hookFailure == entry.class then
    error('hook rejected', 0)
  end
  if cleanupFailure and replacement == native then
    error('cleanup rejected', 0)
  end
  local previous = entry.get()
  entry.set(replacement)
  return previous
end
env.hookmetamethod = function(_, key, replacement)
  local previous = mt[key]
  mt[key] = replacement
  return previous
end
env.getrawmetatable = function()
  return mt
end
env.rawset = function(target, key, value)
  if target == mt and readonly then
    error('readonly', 0)
  end
  return rawset(target, key, value)
end
env.isreadonly = function()
  return readonly
end
env.setreadonly = function(_, value)
  readonly = value
end
local protocol = {
  getRemoteBlockState = function(self)
    if captureError then
      error('capture failed', 0)
    end

    if recursiveCapture then
      local previous = method
      method = 'FireServer'
      mt.__namecall(remote('RemoteEvent', 'Observer'))
      method = previous
    end

    method = 'GetFullName'
    return blocked == true, self.Name, { 'ReplicatedStorage', self.Name }
  end,
  serializeArguments = function(...)
    return pack(...)
  end,
  generateRemoteCode = function(_, _, ...)
    return pack(...)
  end,
  send = function(event)
    local snapshot = {}
    for key, value in pairs(event.call) do
      snapshot[key] = value
    end
    table.insert(events, { type = event.type, call = snapshot })
  end,
  sendResult = function(_, id, success, payload)
    table.insert(results, { id = id, success = success, payload = payload })
  end,
}
env.require = function(name)
  if name == 'state' then
    return state
  end
  if name == 'protocol' then
    return protocol
  end
  error('unexpected require: ' .. name)
end

local nativeMetamethodHook = env.hookmetamethod
local nativeRawMetatable   = env.getrawmetatable

local methodScenarios = {
  ['method-hooks'] = true,
  ['rollback-failure'] = true,
  ['native-errors'] = true,
  ['capture-failure'] = true,
  ['block-and-caller'] = true,
  ['pattern-filter'] = true,
  ['disable-retry'] = true,
}

if methodScenarios[scenario] then
  env.hookmetamethod = false
  env.getrawmetatable = false
end
local chunk
if setfenv then
  chunk = assert(loadfile(source))
  setfenv(chunk, env)
else
  chunk = assert(loadfile(source, 't', env))
end
local handler = chunk()
local function toggle(enabled, captureSource)
  handler.handleSetRemoteSpyEnabled({ id = 'test', enabled = enabled, source = captureSource })
  return results[#results]
end
local function enable()
  local result = toggle(true)
  assert(result.success, result.payload.error)
  equal(state.remoteSpyEnabled, true, 'enabled')
  if env.debug then
    equal(env.debug.info, debugInfo, 'debug.info unchanged')
  end
end
local function namecall(self, name, ...)
  method = name
  return mt.__namecall(self, ...)
end

if scenario == 'namecall-priority' or scenario == 'raw-priority' then
  if scenario == 'raw-priority' then
    env.hookmetamethod = false
  end

  enable()

  equal(implementations[targets.RemoteEvent].get(), native, 'method hooks must not preempt namecall capture')
  assert(mt.__namecall ~= originalNamecall, 'native namecall dispatch must be intercepted')

  for _, class in ipairs({ 'RemoteEvent', 'UnreliableRemoteEvent', 'RemoteFunction' }) do
    local name     = class == 'RemoteFunction' and 'InvokeServer' or 'FireServer'
    local returned = pack(namecall(remote(class), name, 'value', nil))

    equal(returned.n, 3, 'return tuple preserved')
    equal(returned[3], 2, 'arguments forwarded once with trailing nil')
    equal(forwarded[#forwarded].method, name, 'namecall method restored')
  end

  equal(#forwarded, 3, 'one dispatch per invocation')
  equal(#events, 4, 'three calls plus function completion')
  equal(events[4].call.returnStatus, 'returned')

  assert(toggle(false).success)
  equal(mt.__namecall, originalNamecall, 'cleanup restores dispatch')

elseif scenario == 'method-hooks' then
  enable()
  equal(mt.__namecall, originalNamecall, '__namecall unchanged')
  for _, class in ipairs({ 'RemoteEvent', 'UnreliableRemoteEvent', 'RemoteFunction' }) do
    local returned = pack(targets[class](remote(class), 'value', nil))
    equal(returned.n, 3, 'return arity')
    equal(returned[1], 'native result')
    equal(returned[2], nil)
    equal(returned[3], 2, 'native argument arity')
  end
  equal(#events, 4, 'all remote classes and function completion captured')
  equal(events[3].call.arguments.n, 2, 'serialized trailing nil')
  equal(events[3].call.code.n, 2, 'replay trailing nil')
  assert(toggle(false).success)
  targets.RemoteEvent(remote('RemoteEvent'))
  equal(#events, 4, 'capture stopped')
elseif scenario == 'capability-fallback' then
  env.hookfunction = false
  env.getrawmetatable = false
  env.debug = false
  enable()
  namecall(remote('RemoteEvent'), 'FireServer', 1)
  equal(#events, 1, 'metamethod-only capture')
  equal(forwarded[1].method, 'FireServer', 'namecall restored')
  env.hookmetamethod = false
  assert(toggle(false).success, 'disable uses cached hook')
  equal(mt.__namecall, originalNamecall)
elseif scenario == 'raw-lock' then
  env.hookfunction = false
  env.hookmetamethod = false
  enable()
  equal(readonly, true, 'lock restored after install')
  namecall(remote('RemoteFunction'), 'InvokeServer')
  equal(#events, 2)
  assert(toggle(false).success)
  equal(readonly, true, 'lock restored after cleanup')
  equal(mt.__namecall, originalNamecall)
elseif scenario == 'raw-writable' then
  env.hookfunction = false
  env.hookmetamethod = false
  readonly = false
  enable()
  assert(toggle(false).success)
  equal(readonly, false, 'writable state preserved')
elseif scenario == 'raw-ownership' then
  env.hookfunction = false
  env.hookmetamethod = false
  enable()
  local laterHook = function()
    return 'later'
  end
  mt.__namecall = laterHook
  assert(toggle(false).success)
  equal(mt.__namecall, laterHook, 'later hook retained')
elseif scenario == 'missing-capabilities' then
  env.hookfunction = false
  env.hookmetamethod = false
  env.getrawmetatable = false
  local result = toggle(true)
  equal(result.success, false)
  assert(result.payload.error:find('hookfunction unavailable', 1, true))
  assert(result.payload.error:find('hookmetamethod unavailable', 1, true))
  equal(state.remoteSpyEnabled, false)
  assert(toggle(false).success, 'disable never requires install capabilities')
elseif scenario == 'partial-rollback' then
  env.hookmetamethod = false
  env.getrawmetatable = false
  hookFailure = 'RemoteFunction'

  local result = toggle(true)
  equal(result.success, false, 'partial method fallback must not enable capture')

  targets.RemoteEvent(remote('RemoteEvent'))
  equal(#events, 0)
  equal(implementations[targets.RemoteEvent].get(), native, 'earlier method hooks rolled back')
  assert(toggle(false).success)
elseif scenario == 'rollback-failure' then
  hookFailure = 'RemoteFunction'
  cleanupFailure = true
  local result = toggle(true)
  equal(result.success, false)
  assert(result.payload.error:find('rollback failed', 1, true))
  equal(mt.__namecall, originalNamecall, 'no fallback after unsafe rollback')
  equal(state.remoteSpyEnabled, false)
  equal(type(state.spyCleanup), 'function', 'failed rollback remains recoverable')
  equal(toggle(true).success, false, 'do not layer hooks over failed cleanup')
  cleanupFailure = false
  assert(toggle(false).success, 'disable retries cleanup even while capture is off')
  equal(implementations[targets.RemoteEvent].get(), native, 'partial hook removed')
  hookFailure = nil
  enable()
  targets.RemoteEvent(remote('RemoteEvent'), 1)
  equal(#events, 1, 'recovered install captures once')
  assert(toggle(false).success)
elseif scenario == 'native-errors' then
  enable()
  local ok, err = pcall(targets.RemoteEvent, {}, 1)
  equal(ok, false)
  equal(err, 'native receiver error', 'native error retained')
  local okMissing, missingError = pcall(targets.RemoteEvent)
  equal(okMissing, false)
  equal(missingError, 'native missing receiver', 'zero arguments preserved')
  equal(#events, 0)
  assert(toggle(false).success)
elseif scenario == 'namecall-native-errors' then
  env.hookfunction = false
  enable()
  method = 'FireServer'
  local okMissing, missingError = pcall(mt.__namecall)
  equal(okMissing, false)
  equal(missingError, 'native missing receiver')
  local okInvalid, invalidError = pcall(mt.__namecall, {})
  equal(okInvalid, false)
  equal(invalidError, 'native receiver error')
  equal(#events, 0)
  assert(toggle(false).success)
elseif scenario == 'capture-failure' then
  enable()
  captureError = true
  local returned = pack(targets.RemoteEvent(remote('RemoteEvent'), nil, 'value', nil))
  equal(returned[1], 'native result', 'capture failure passes through')
  equal(returned[3], 3)
  equal(#events, 0)
  assert(toggle(false).success)
elseif scenario == 'block-and-caller' then
  enable()
  blocked = true
  targets.RemoteEvent(remote('RemoteEvent'), 1)
  equal(#forwarded, 0, 'blocked call not forwarded')
  equal(events[1].call._blocked, true)
  executorCaller = true
  targets.RemoteEvent(remote('RemoteEvent'), 2)
  equal(#forwarded, 1, 'executor caller forwarded')
  equal(#events, 1, 'executor caller not captured')

  executorCaller = false
  targets.RemoteEvent(remote('Part'), 3)
  equal(#forwarded, 2)
  equal(#events, 1)
  assert(toggle(false).success)
elseif scenario == 'pattern-filter' then
  enable()
  state.remoteSpyFilter = 'event%d'
  targets.RemoteEvent(remote('RemoteEvent', 'Event1'), nil)
  equal(#events, 1, 'valid filter patterns retained')
  equal(events[1].call.arguments.n, 1)
  assert(toggle(false).success)
elseif scenario == 'disable-retry' then
  enable()
  cleanupFailure = true
  local result = toggle(false)
  equal(result.success, false)
  equal(state.remoteSpyEnabled, true, 'failed cleanup not reported disabled')
  cleanupFailure = false
  assert(toggle(false).success)
  equal(state.spyCleanup, nil)
  equal(state.remoteSpyEnabled, false)
elseif scenario == 'returns' then
  for _, strategy in ipairs({ 'method', 'namecall' }) do
    env.hookmetamethod = strategy == 'namecall' and nativeMetamethodHook or false
    env.getrawmetatable = strategy == 'namecall' and nativeRawMetatable or false
    enable()

    for _, mode in ipairs({ 'tuple', 'zero', 'nil', 'yield' }) do
      nativeMode = mode
      local before = #forwarded
      local invoke = function()
        if strategy == 'method' then
          return targets.RemoteFunction(remote('RemoteFunction'), 'argument')
        end
        return namecall(remote('RemoteFunction'), 'InvokeServer', 'argument')
      end
      local returned
      if mode == 'yield' then
        local thread = coroutine.create(invoke)
        local ok, value = coroutine.resume(thread)
        equal(ok, true)
        equal(value, 'waiting')
        equal(events[#events].call.returnStatus, 'pending')
        local resumed = pack(coroutine.resume(thread))
        equal(resumed[1], true)
        returned = pack(unpack(resumed, 2, resumed.n))
      else
        returned = pack(invoke())
      end

      local pending  = events[#events - 1].call
      local response = events[#events].call
      local count    = mode == 'zero' and 0 or mode == 'nil' and 1 or 3
      equal(#forwarded, before + 1, 'native invocation happens exactly once')
      equal(returned.n, count, 'caller return arity')
      equal(response.returnCount, count, 'captured return arity')
      equal(response.returns.n, count, 'serialized return arity')
      equal(pending.id, response.id, 'response correlated to invocation')
      equal(pending.returnStatus, 'pending')
      equal(response.returnStatus, 'returned')
      if count == 3 then
        equal(response.returns[1], 'native result')
        equal(response.returns[2], nil)
        equal(response.returns[3], 1)
      end
    end
    assert(toggle(false).success)
  end
elseif scenario == 'capture-source' then
  enable()
  local installed = mt.__namecall

  for _, captureSource in ipairs({ 'game', 'executor', 'both' }) do
    local result = toggle(true, captureSource)
    equal(result.success, true)
    equal(result.payload.source, captureSource)
    equal(mt.__namecall, installed, 'mode switch must not reinstall hooks')

    for _, caller in ipairs({ false, true }) do
      executorCaller = caller
      local beforeEvents    = #events
      local beforeForwarded = #forwarded
      local origin          = caller and 'executor' or 'game'
      local accepted        = captureSource == 'both' or captureSource == origin
      blocked = true

      namecall(remote('RemoteEvent'), 'FireServer', 'value')

      equal(#events, beforeEvents + (accepted and 1 or 0), 'selected origins captured')
      equal(#forwarded, beforeForwarded + (accepted and 0 or 1), 'unselected origins pass through')

      if accepted then
        equal(events[#events].call.source, origin, 'caller origin recorded')
      end
    end
  end

  equal(toggle(true, 'invalid').success, false)
  equal(state.remoteSpySource, 'both', 'invalid mode must not change selection')
  assert(toggle(false).success)

elseif scenario == 'source-classification' then
  env.checkcaller = false
  local rejected = toggle(true, 'game')
  equal(rejected.success, false)
  assert(rejected.payload.error:find('checkcaller', 1, true))
  equal(state.remoteSpyEnabled, false)

  assert(toggle(true, 'both').success)
  namecall(remote('RemoteEvent'), 'FireServer')
  equal(events[1].call.source, 'unknown')

  env.checkcaller = function()
    error('classification rejected')
  end
  equal(toggle(true, 'executor').success, false)
  equal(state.remoteSpySource, 'both')
  assert(toggle(false).success)

elseif scenario == 'source-reentrance' then
  assert(toggle(true, 'both').success)
  executorCaller = true
  recursiveCapture = true

  namecall(remote('RemoteEvent'), 'FireServer', 'value')

  equal(#events, 1, 'observer work must not recursively capture itself in Both mode')
  equal(#forwarded, 2, 'original and observer calls forwarded once each')
  equal(events[1].call.source, 'executor')
  assert(toggle(false).success)
else
  error('unknown scenario: ' .. tostring(scenario))
end
print('PASS ' .. scenario)
