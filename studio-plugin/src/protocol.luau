local HttpService = game:GetService'HttpService'

local protocol = {}

protocol.resolveInstancePath = function(path)
	local instance = game
	for _, segment in ipairs(path) do
		local sep = segment:find("\0", 1, true)
		if sep ~= nil then
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

protocol.jsonEncode = function(data)
	return HttpService:JSONEncode(data)
end

protocol.jsonDecode = function(data)
	local success, result = pcall(HttpService.JSONDecode, HttpService, data)
	if not success then return nil end
	return result
end

local VALUE_SERIALIZERS = {
	string     = function(v) return v, 'string' end,
	number     = function(v) return tostring(v), 'number' end,
	boolean    = function(v) return tostring(v), 'boolean' end,
	Instance   = function(v) return v:GetFullName(), 'Instance', v.ClassName end,
	Vector3    = function(v) return string.format('%.3f, %.3f, %.3f', v.X, v.Y, v.Z), 'Vector3' end,
	Vector2    = function(v) return string.format('%.3f, %.3f', v.X, v.Y), 'Vector2' end,
	CFrame     = function(v) return string.format('%.3f, %.3f, %.3f', v.X, v.Y, v.Z), 'CFrame' end,
	Color3     = function(v) return string.format('%.3f, %.3f, %.3f', v.R, v.G, v.B), 'Color3' end,
	BrickColor = function(v) return v.Name, 'BrickColor' end,
	UDim       = function(v) return string.format('%.3f, %d', v.Scale, v.Offset), 'UDim' end,
	UDim2      = function(v) return string.format('{%.3f, %d}, {%.3f, %d}', v.X.Scale, v.X.Offset, v.Y.Scale, v.Y.Offset), 'UDim2' end,
	EnumItem   = function(v) return tostring(v), 'EnumItem' end,
}

protocol.serializePropertyValue = function(name, value)
	if value == nil then return { name = name, value = 'nil', valueType = 'nil' } end

	local valueType = typeof(value)
	local serializer = VALUE_SERIALIZERS[valueType]
	if serializer == nil then
		return { name = name, value = tostring(value), valueType = 'other' }
	end

	local serializedValue, typeName, className = serializer(value)
	local result = { name = name, value = serializedValue, valueType = typeName }
	if className ~= nil then result.className = className end
	return result
end

local VALUE_PARSERS = {
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

protocol.parseValue = function(value, valueType)
	local parser = VALUE_PARSERS[valueType]
	if parser == nil then return value end
	return parser(value)
end

return protocol
