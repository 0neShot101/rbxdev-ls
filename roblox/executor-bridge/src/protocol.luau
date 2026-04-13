local HttpService = game:GetService'HttpService'

local state = require("state")

local M = {}

M.VALUE_SERIALIZERS = {
	string    = function(v) return v, 'string' end,
	number    = function(v) return tostring(v), 'number' end,
	boolean   = function(v) return tostring(v), 'boolean' end,
	Instance  = function(v) return v:GetFullName(), 'Instance', v.ClassName end,
	Vector3   = function(v) return string.format('%.3f, %.3f, %.3f', v.X, v.Y, v.Z), 'Vector3' end,
	Vector2   = function(v) return string.format('%.3f, %.3f', v.X, v.Y), 'Vector2' end,
	CFrame    = function(v) return string.format('%.3f, %.3f, %.3f', v.X, v.Y, v.Z), 'CFrame' end,
	Color3    = function(v) return string.format('%.3f, %.3f, %.3f', v.R, v.G, v.B), 'Color3' end,
	BrickColor = function(v) return v.Name, 'BrickColor' end,
	UDim      = function(v) return string.format('%.3f, %d', v.Scale, v.Offset), 'UDim' end,
	UDim2     = function(v) return string.format('{%.3f, %d}, {%.3f, %d}', v.X.Scale, v.X.Offset, v.Y.Scale, v.Y.Offset), 'UDim2' end,
	EnumItem  = function(v) return tostring(v), 'EnumItem' end,
}

M.VALUE_PARSERS = {
	string  = function(v) return v end,
	number  = function(v) return tonumber(v) end,
	boolean = function(v) return v == 'true' end,
	['nil'] = function() return nil end,
	Vector3 = function(v)
		local x, y, z = v:match'([^,]+),%s*([^,]+),%s*([^,]+)'
		return Vector3.new(tonumber(x), tonumber(y), tonumber(z))
	end,
	Vector2 = function(v)
		local x, y = v:match'([^,]+),%s*([^,]+)'
		return Vector2.new(tonumber(x), tonumber(y))
	end,
	Color3 = function(v)
		local r, g, b = v:match'([^,]+),%s*([^,]+),%s*([^,]+)'
		return Color3.new(tonumber(r), tonumber(g), tonumber(b))
	end,
	BrickColor = function(v) return BrickColor.new(v) end,
	UDim2 = function(v)
		local xs, xo, ys, yo = v:match'{([^,]+),%s*([^}]+)},%s*{([^,]+),%s*([^}]+)}'
		return UDim2.new(tonumber(xs), tonumber(xo), tonumber(ys), tonumber(yo))
	end,
	UDim = function(v)
		local s, o = v:match'([^,]+),%s*([^,]+)'
		return UDim.new(tonumber(s), tonumber(o))
	end,
	EnumItem = function(v)
		local enumPath = v:match'Enum%.(.+)'
		if enumPath == nil then return nil end
		local parts = {}
		for part in enumPath:gmatch'[^%.]+' do table.insert(parts, part) end
		if #parts ~= 2 then return nil end
		return Enum[parts[1]][parts[2]]
	end,
}

M.jsonEncode = function(data)
	return HttpService:JSONEncode(data)
end

M.jsonDecode = function(data)
	local success, result = pcall(HttpService.JSONDecode, HttpService, data)
	if not success then return nil end
	return result
end

M.resolveInstancePath = function(path)
	local instance = game
	for _, segment in ipairs(path) do
		local sep = segment:find("\0", 1, true)
		if sep then
			local name = segment:sub(1, sep - 1)
			local idx = tonumber(segment:sub(sep + 1))
			if idx == nil then return nil end
			local count = 0
			local found = nil
			for _, child in ipairs(instance:GetChildren()) do
				if child.Name == name then
					if count == idx then
						found = child
						break
					end
					count = count + 1
				end
			end
			if found == nil then return nil end
			instance = found
		else
			local ok, child = pcall(instance.FindFirstChild, instance, segment)
			if not ok or child == nil then return nil end
			instance = child
		end
	end
	return instance
end

M.getInstancePath = function(instance)
	local path = {}
	local current = instance
	while current ~= nil and current ~= game do
		table.insert(path, 1, current.Name)
		current = current.Parent
	end
	return path
end

M.instanceToPath = function(instance)
	if instance == nil then return 'nil' end
	if instance == game then return 'game' end

	local parts = {}
	local current = instance
	while current ~= nil and current ~= game do
		table.insert(parts, 1, current)
		current = current.Parent
	end

	if current == nil then
		return 'nil --[[' .. instance.Name .. ' (nil parent)]]'
	end

	local out = ''
	for i, part in ipairs(parts) do
		if i == 1 then
			local ok, service = pcall(game.FindService, game, part.ClassName)
			if ok and service ~= nil then
				out = part.ClassName == 'Workspace' and 'workspace' or ('game:GetService("' .. part.ClassName .. '")')
			elseif part.Name:match'^[%a_][%w_]*$' then
				out = 'game.' .. part.Name
			else
				out = 'game:FindFirstChild("' .. part.Name:gsub('\\', '\\\\'):gsub('"', '\\"') .. '")'
			end
		elseif part.Name:match'^[%a_][%w_]*$' then
			out = out .. '.' .. part.Name
		else
			out = out .. ':FindFirstChild("' .. part.Name:gsub('\\', '\\\\'):gsub('"', '\\"') .. '")'
		end
	end

	return out
end

M.send = function(data)
	if state.connection == nil or not state.connected then return end
	state.connection:Send(M.jsonEncode(data))
end

M.sendResult = function(messageType, id, success, payload)
	local result = { type = messageType, id = id, success = success }
	for k, v in pairs(payload or {}) do result[k] = v end
	M.send(result)
end

M.getHealthUrl = function(config)
	if type(config.healthUrl) == 'string' and config.healthUrl ~= '' then
		return config.healthUrl
	end

	local base = config.host:gsub('^wss://', 'https://'):gsub('^ws://', 'http://')
	local origin = base:match'^(https?://[^/]+)'
	if origin == nil then return nil end
	return origin .. '/health'
end

M.canAttemptConnect = function(config, HttpRequest)
	if config.enableHealthProbe == false or HttpRequest == nil then
		return true
	end

	local healthUrl = M.getHealthUrl(config)
	if healthUrl == nil then
		return true
	end

	local ok, response = pcall(HttpRequest, {
		Url = healthUrl,
		Method = 'GET',
		Headers = {
			['Cache-Control'] = 'no-cache',
		},
	})

	if not ok or type(response) ~= 'table' then
		state.healthProbeFailures = state.healthProbeFailures + 1
		return state.healthProbeFailures % 3 == 0
	end

	local statusCode = response.StatusCode or response.Status or response.status_code
	if statusCode == 200 then
		state.healthProbeFailures = 0
		return true
	end

	state.healthProbeFailures = state.healthProbeFailures + 1
	return state.healthProbeFailures % 3 == 0
end

M.valueToLua = nil
M.tableToLua = nil

M.valueToLua = function(v, depth, seen)
	depth = depth or 0
	seen = seen or {}

	local t = typeof(v)

	if v == nil then return 'nil' end
	if t == 'boolean' then return tostring(v) end

	if t == 'number' then
		if v ~= v then return '0/0' end
		if v == math.huge then return 'math.huge' end
		if v == -math.huge then return '-math.huge' end
		return tostring(v)
	end

	if t == 'string' then
		return '"' .. v:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\r', '\\r'):gsub('\t', '\\t'):gsub('\0', '\\0') .. '"'
	end

	if t == 'Instance' then return M.instanceToPath(v) end
	if t == 'Vector3'  then return string.format('Vector3.new(%s, %s, %s)', tostring(v.X), tostring(v.Y), tostring(v.Z)) end
	if t == 'Vector2'  then return string.format('Vector2.new(%s, %s)', tostring(v.X), tostring(v.Y)) end

	if t == 'CFrame' then
		local c = { v:GetComponents() }
		if c[4] == 1 and c[5] == 0 and c[6] == 0
			and c[7] == 0 and c[8] == 1 and c[9] == 0
			and c[10] == 0 and c[11] == 0 and c[12] == 1 then
			return string.format('CFrame.new(%s, %s, %s)', tostring(v.X), tostring(v.Y), tostring(v.Z))
		end
		local p = {}
		for _, comp in ipairs(c) do table.insert(p, tostring(comp)) end
		return 'CFrame.new(' .. table.concat(p, ', ') .. ')'
	end

	if t == 'Color3'     then return string.format('Color3.new(%s, %s, %s)', tostring(v.R), tostring(v.G), tostring(v.B)) end
	if t == 'BrickColor' then return 'BrickColor.new("' .. v.Name .. '")' end
	if t == 'UDim'       then return string.format('UDim.new(%s, %s)', tostring(v.Scale), tostring(v.Offset)) end
	if t == 'UDim2'      then return string.format('UDim2.new(%s, %s, %s, %s)', tostring(v.X.Scale), tostring(v.X.Offset), tostring(v.Y.Scale), tostring(v.Y.Offset)) end
	if t == 'Rect'       then return string.format('Rect.new(%s, %s, %s, %s)', tostring(v.Min.X), tostring(v.Min.Y), tostring(v.Max.X), tostring(v.Max.Y)) end

	if t == 'Ray' then
		return string.format('Ray.new(Vector3.new(%s, %s, %s), Vector3.new(%s, %s, %s))',
			tostring(v.Origin.X), tostring(v.Origin.Y), tostring(v.Origin.Z),
			tostring(v.Direction.X), tostring(v.Direction.Y), tostring(v.Direction.Z))
	end

	if t == 'Region3' then
		local cf, size = v.CFrame, v.Size
		local min, max = cf.Position - size / 2, cf.Position + size / 2
		return string.format('Region3.new(Vector3.new(%s, %s, %s), Vector3.new(%s, %s, %s))',
			tostring(min.X), tostring(min.Y), tostring(min.Z),
			tostring(max.X), tostring(max.Y), tostring(max.Z))
	end

	if t == 'NumberSequence' then
		local kps = {}
		for _, kp in ipairs(v.Keypoints) do
			table.insert(kps, string.format('NumberSequenceKeypoint.new(%s, %s, %s)', tostring(kp.Time), tostring(kp.Value), tostring(kp.Envelope)))
		end
		return 'NumberSequence.new({' .. table.concat(kps, ', ') .. '})'
	end

	if t == 'ColorSequence' then
		local kps = {}
		for _, kp in ipairs(v.Keypoints) do
			table.insert(kps, string.format('ColorSequenceKeypoint.new(%s, Color3.new(%s, %s, %s))', tostring(kp.Time), tostring(kp.Value.R), tostring(kp.Value.G), tostring(kp.Value.B)))
		end
		return 'ColorSequence.new({' .. table.concat(kps, ', ') .. '})'
	end

	if t == 'NumberRange' then return string.format('NumberRange.new(%s, %s)', tostring(v.Min), tostring(v.Max)) end
	if t == 'EnumItem'    then return tostring(v) end
	if t == 'TweenInfo'   then return string.format('TweenInfo.new(%s, %s, %s, %s, %s, %s)', tostring(v.Time), tostring(v.EasingStyle), tostring(v.EasingDirection), tostring(v.RepeatCount), tostring(v.Reverses), tostring(v.DelayTime)) end
	if t == 'table'       then return M.tableToLua(v, depth, seen) end
	if t == 'function'    then return 'function() end' end
	if t == 'thread'      then return 'nil' end

	local ok, str = pcall(tostring, v)
	if ok then return 'nil --[[' .. t .. ': ' .. str .. ']]' end
	return 'nil --[[' .. t .. ']]'
end

M.tableToLua = function(t, depth, seen)
	depth = depth or 0
	seen = seen or {}

	if depth > 5 then return '{}' end
	if seen[t] then return '{}' end
	seen[t] = true

	local parts = {}
	local arrayLen = #t
	local isArray = arrayLen > 0
	local indent = string.rep('    ', depth + 1)
	local closingIndent = string.rep('    ', depth)
	local count = 0

	if isArray then
		for i = 1, arrayLen do
			count = count + 1
			if count > 50 then break end
			table.insert(parts, indent .. M.valueToLua(t[i], depth + 1, seen))
		end
	end

	for k, v in pairs(t) do
		if isArray and type(k) == 'number' and k >= 1 and k <= arrayLen and math.floor(k) == k then
			continue
		end
		count = count + 1
		if count > 50 then break end
		local keyStr
		if type(k) == 'string' and k:match'^[%a_][%w_]*$' then
			keyStr = k
		else
			keyStr = '[' .. M.valueToLua(k, depth + 1, seen) .. ']'
		end
		table.insert(parts, indent .. keyStr .. ' = ' .. M.valueToLua(v, depth + 1, seen))
	end

	seen[t] = nil

	if #parts == 0 then return '{}' end
	return '{\n' .. table.concat(parts, ',\n') .. '\n' .. closingIndent .. '}'
end

M.getDefaultProperties = function(className, config)
	local props = config.DEFAULT_PROPERTIES[className]
	if props ~= nil then return props end
	for _, entry in ipairs(config.CLASS_PATTERNS) do
		if className:find(entry.pattern) ~= nil then return entry.props end
	end
	return { 'Name', 'ClassName' }
end

M.serializePropertyValue = function(name, value)
	if value == nil then return { name = name, value = 'nil', valueType = 'nil' } end

	local valueType = typeof(value)
	local serializer = M.VALUE_SERIALIZERS[valueType]
	if serializer == nil then
		return { name = name, value = tostring(value), valueType = 'other' }
	end

	local serializedValue, typeName, className = serializer(value)
	local result = { name = name, value = serializedValue, valueType = typeName }
	if className ~= nil then result.className = className end
	return result
end

M.parseValue = function(value, valueType)
	local parser = M.VALUE_PARSERS[valueType]
	if parser == nil then return value end
	return parser(value)
end

M.parseError = function(errorString)
	local file, line, message = errorString:match'(%S+):(%d+): (.+)'
	return {
		message = message or errorString,
		file = file,
		line = line and tonumber(line) or nil,
	}
end

M.getInstanceProperties = function(instance, requestedProps, config)
	local props = {}
	local propsToGet = requestedProps or M.getDefaultProperties(instance.ClassName, config)
	for _, propName in ipairs(propsToGet) do
		local ok, value = pcall(function() return instance[propName] end)
		if ok then table.insert(props, M.serializePropertyValue(propName, value)) end
	end
	return props
end

M.generateRemoteCode = function(remote, method, ...)
	local args = { ... }
	local numArgs = select('#', ...)
	local remotePath = M.instanceToPath(remote)

	if numArgs == 0 then
		return remotePath .. ':' .. method .. '()'
	end

	local argParts = {}
	local hasComplexArgs = false
	for i = 1, numArgs do
		local t = typeof(args[i])
		if t == 'table' or t == 'CFrame' or t == 'NumberSequence' or t == 'ColorSequence' or t == 'TweenInfo' then
			hasComplexArgs = true
		end
		table.insert(argParts, M.valueToLua(args[i], hasComplexArgs and 1 or 0))
	end

	if not hasComplexArgs and numArgs <= 5 then
		return remotePath .. ':' .. method .. '(' .. table.concat(argParts, ', ') .. ')'
	end

	local indented = {}
	for _, part in ipairs(argParts) do table.insert(indented, '    ' .. part) end
	return remotePath .. ':' .. method .. '(\n' .. table.concat(indented, ',\n') .. '\n)'
end

M.serializeArguments = function(...)
	local args = { ... }
	local parts = {}
	for i = 1, select('#', ...) do table.insert(parts, M.valueToLua(args[i])) end
	return table.concat(parts, ', ')
end

M.rebuildRemoteSpyBlockMaps = function(blocks)
	state.remoteSpyBlockedNames = {}
	state.remoteSpyBlockedPaths = {}

	if type(blocks) ~= 'table' then return end

	for _, entry in ipairs(blocks) do
		if type(entry) ~= 'table' then continue end
		if type(entry.type) ~= 'string' or type(entry.value) ~= 'string' then continue end

		if entry.type == 'name' then
			state.remoteSpyBlockedNames[entry.value] = true
		elseif entry.type == 'path' then
			state.remoteSpyBlockedPaths[entry.value] = true
		end
	end
end

M.getRemoteBlockState = function(remote)
	if typeof(remote) ~= 'Instance' then
		return false, '', {}
	end
	local remotePath = M.getInstancePath(remote)
	local remotePathString = table.concat(remotePath, '.')
	local remoteName = remote.Name
	local blocked = state.remoteSpyBlockedNames[remoteName] == true or state.remoteSpyBlockedPaths[remotePathString] == true
	return blocked, remoteName, remotePath
end

return M
