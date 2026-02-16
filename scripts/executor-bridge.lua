local HttpService = game:GetService'HttpService'
local Players = game:GetService'Players'

local BRIDGE_ID = tostring(math.random(1, 999999999))

if getgenv and getgenv()._RBXDEV_BRIDGE then
	local old = getgenv()._RBXDEV_BRIDGE
	if old.connection then pcall(old.connection.Close, old.connection) end
	for _, conn in ipairs(old.refreshConnections or {}) do pcall(conn.Disconnect, conn) end
	old.alive = false
end

local userConfig = (...) or {}

local CONFIG = {
	host              = 'ws://127.0.0.1:21324',
	reconnectDelay    = 5,
	firstConnectDepth = 999,
	updateTreeDepth   = 3,
	expandedTreeDepth = 2,
	gameTreeServices  = {
		'Workspace', 'Players', 'ReplicatedStorage', 'ReplicatedFirst',
		'StarterGui', 'StarterPack', 'StarterPlayer', 'Lighting',
		'SoundService', 'Chat', 'Teams',
	},
}

for k, v in pairs(userConfig) do CONFIG[k] = v end

local DEFAULT_PROPERTIES = {
	BasePart              = { 'Name', 'Transparency', 'Color', 'Material', 'Anchored', 'CanCollide', 'Position', 'Size' },
	Part                  = { 'Name', 'Transparency', 'Color', 'Material', 'Anchored', 'CanCollide', 'Position', 'Size', 'Shape' },
	MeshPart              = { 'Name', 'Transparency', 'Color', 'Material', 'Anchored', 'CanCollide', 'Position', 'Size' },
	UnionOperation        = { 'Name', 'Transparency', 'Color', 'Material', 'Anchored', 'CanCollide', 'Position', 'Size' },
	SpawnLocation         = { 'Name', 'Transparency', 'Color', 'Material', 'Anchored', 'CanCollide', 'Position', 'Size', 'Enabled', 'TeamColor' },
	Model                 = { 'Name', 'PrimaryPart' },
	Folder                = { 'Name' },
	Configuration         = { 'Name' },
	Script                = { 'Name', 'Enabled' },
	LocalScript           = { 'Name', 'Enabled' },
	ModuleScript          = { 'Name' },
	IntValue              = { 'Name', 'Value' },
	NumberValue           = { 'Name', 'Value' },
	StringValue           = { 'Name', 'Value' },
	BoolValue             = { 'Name', 'Value' },
	ObjectValue           = { 'Name', 'Value' },
	Color3Value           = { 'Name', 'Value' },
	BrickColorValue       = { 'Name', 'Value' },
	Vector3Value          = { 'Name', 'Value' },
	CFrameValue           = { 'Name', 'Value' },
	RayValue              = { 'Name', 'Value' },
	IntConstrainedValue   = { 'Name', 'Value', 'MinValue', 'MaxValue' },
	DoubleConstrainedValue = { 'Name', 'Value', 'MinValue', 'MaxValue' },
	Sound                 = { 'Name', 'Volume', 'Playing', 'SoundId', 'TimePosition', 'Looped', 'PlaybackSpeed' },
	PointLight            = { 'Name', 'Enabled', 'Brightness', 'Color', 'Range', 'Shadows' },
	SpotLight             = { 'Name', 'Enabled', 'Brightness', 'Color', 'Range', 'Angle', 'Shadows' },
	SurfaceLight          = { 'Name', 'Enabled', 'Brightness', 'Color', 'Range', 'Angle', 'Shadows' },
	Frame                 = { 'Name', 'Visible', 'BackgroundColor3', 'BackgroundTransparency', 'Position', 'Size', 'AnchorPoint' },
	ScrollingFrame        = { 'Name', 'Visible', 'BackgroundColor3', 'BackgroundTransparency', 'Position', 'Size', 'CanvasSize', 'ScrollingDirection' },
	ScreenGui             = { 'Name', 'Enabled', 'ResetOnSpawn', 'ZIndexBehavior' },
	BillboardGui          = { 'Name', 'Enabled', 'Size', 'StudsOffset', 'MaxDistance', 'AlwaysOnTop' },
	SurfaceGui            = { 'Name', 'Enabled', 'Face', 'PixelsPerStud', 'AlwaysOnTop' },
	ViewportFrame         = { 'Name', 'Visible', 'BackgroundColor3', 'BackgroundTransparency', 'Position', 'Size', 'Ambient', 'LightColor' },
	TextLabel             = { 'Name', 'Visible', 'Text', 'TextColor3', 'TextSize', 'Font', 'TextScaled', 'TextWrapped' },
	TextButton            = { 'Name', 'Visible', 'Text', 'TextColor3', 'TextSize', 'Font', 'TextScaled', 'TextWrapped' },
	TextBox               = { 'Name', 'Visible', 'Text', 'TextColor3', 'TextSize', 'Font', 'PlaceholderText', 'ClearTextOnFocus' },
	ImageLabel            = { 'Name', 'Visible', 'Image', 'ImageColor3', 'ImageTransparency', 'ScaleType' },
	ImageButton           = { 'Name', 'Visible', 'Image', 'ImageColor3', 'ImageTransparency', 'ScaleType' },
	UIListLayout          = { 'Name', 'FillDirection', 'HorizontalAlignment', 'VerticalAlignment', 'SortOrder', 'Padding' },
	UIGridLayout          = { 'Name', 'CellPadding', 'CellSize', 'FillDirection', 'HorizontalAlignment', 'VerticalAlignment', 'SortOrder' },
	UITableLayout         = { 'Name', 'FillDirection', 'HorizontalAlignment', 'VerticalAlignment', 'SortOrder' },
	UIPageLayout          = { 'Name', 'Animated', 'Circular', 'EasingDirection', 'EasingStyle', 'Padding', 'TweenTime' },
	UIAspectRatioConstraint = { 'Name', 'AspectRatio', 'AspectType', 'DominantAxis' },
	UISizeConstraint      = { 'Name', 'MaxSize', 'MinSize' },
	UITextSizeConstraint  = { 'Name', 'MaxTextSize', 'MinTextSize' },
	UICorner              = { 'Name', 'CornerRadius' },
	UIGradient            = { 'Name', 'Color', 'Enabled', 'Offset', 'Rotation', 'Transparency' },
	UIPadding             = { 'Name', 'PaddingTop', 'PaddingBottom', 'PaddingLeft', 'PaddingRight' },
	UIScale               = { 'Name', 'Scale' },
	UIStroke              = { 'Name', 'Color', 'Enabled', 'Thickness', 'Transparency', 'ApplyStrokeMode' },
	RemoteEvent           = { 'Name' },
	RemoteFunction        = { 'Name' },
	BindableEvent         = { 'Name' },
	BindableFunction      = { 'Name' },
	UnreliableRemoteEvent = { 'Name' },
	Humanoid              = { 'Name', 'Health', 'MaxHealth', 'WalkSpeed', 'JumpPower', 'JumpHeight', 'HipHeight', 'AutoRotate' },
	HumanoidDescription   = { 'Name', 'HeadColor', 'TorsoColor', 'LeftArmColor', 'RightArmColor', 'LeftLegColor', 'RightLegColor' },
	Animation             = { 'Name', 'AnimationId' },
	AnimationController   = { 'Name' },
	Animator              = { 'Name' },
	ParticleEmitter       = { 'Name', 'Enabled', 'Rate', 'Lifetime', 'Speed', 'Color', 'Size', 'Transparency' },
	Beam                  = { 'Name', 'Enabled', 'Color', 'Transparency', 'Width0', 'Width1', 'CurveSize0', 'CurveSize1' },
	Trail                 = { 'Name', 'Enabled', 'Color', 'Transparency', 'Lifetime', 'MinLength', 'WidthScale' },
	Fire                  = { 'Name', 'Enabled', 'Color', 'SecondaryColor', 'Heat', 'Size' },
	Smoke                 = { 'Name', 'Enabled', 'Color', 'Opacity', 'RiseVelocity', 'Size' },
	Sparkles              = { 'Name', 'Enabled', 'SparkleColor' },
	Highlight             = { 'Name', 'Enabled', 'FillColor', 'FillTransparency', 'OutlineColor', 'OutlineTransparency' },
	ForceField            = { 'Name', 'Visible' },
	Decal                 = { 'Name', 'Texture', 'Transparency', 'Color3', 'Face' },
	Texture               = { 'Name', 'Texture', 'Transparency', 'Color3', 'Face', 'StudsPerTileU', 'StudsPerTileV' },
	SurfaceAppearance     = { 'Name', 'ColorMap', 'NormalMap', 'MetalnessMap', 'RoughnessMap' },
	Attachment            = { 'Name', 'Position', 'Orientation', 'Visible' },
	Weld                  = { 'Name', 'Part0', 'Part1', 'C0', 'C1' },
	WeldConstraint        = { 'Name', 'Part0', 'Part1', 'Enabled' },
	Motor6D               = { 'Name', 'Part0', 'Part1', 'C0', 'C1', 'CurrentAngle', 'MaxVelocity' },
	RopeConstraint        = { 'Name', 'Visible', 'Length', 'Restitution', 'Thickness', 'Color' },
	RodConstraint         = { 'Name', 'Visible', 'Length', 'Thickness', 'Color' },
	SpringConstraint      = { 'Name', 'Visible', 'FreeLength', 'Stiffness', 'Damping', 'Coils', 'Thickness', 'Color' },
	HingeConstraint       = { 'Name', 'Visible', 'ActuatorType', 'AngularVelocity', 'MotorMaxTorque', 'TargetAngle', 'LimitsEnabled', 'LowerAngle', 'UpperAngle' },
	PrismaticConstraint   = { 'Name', 'Visible', 'ActuatorType', 'Velocity', 'MotorMaxForce', 'TargetPosition', 'LimitsEnabled', 'LowerLimit', 'UpperLimit' },
	AlignPosition         = { 'Name', 'Mode', 'MaxForce', 'MaxVelocity', 'Responsiveness', 'RigidityEnabled' },
	AlignOrientation      = { 'Name', 'Mode', 'MaxTorque', 'MaxAngularVelocity', 'Responsiveness', 'RigidityEnabled' },
	LinearVelocity        = { 'Name', 'VectorVelocity', 'MaxForce', 'RelativeTo' },
	AngularVelocity       = { 'Name', 'AngularVelocity', 'MaxTorque', 'RelativeTo' },
	VectorForce           = { 'Name', 'Force', 'RelativeTo' },
	Torque                = { 'Name', 'Torque', 'RelativeTo' },
	BodyForce             = { 'Name', 'Force' },
	BodyVelocity          = { 'Name', 'Velocity', 'MaxForce', 'P' },
	BodyPosition          = { 'Name', 'Position', 'MaxForce', 'P', 'D' },
	BodyGyro              = { 'Name', 'CFrame', 'MaxTorque', 'P', 'D' },
	ClickDetector         = { 'Name', 'MaxActivationDistance', 'CursorIcon' },
	ProximityPrompt       = { 'Name', 'Enabled', 'ActionText', 'ObjectText', 'KeyboardKeyCode', 'HoldDuration', 'MaxActivationDistance', 'RequiresLineOfSight' },
	DragDetector          = { 'Name', 'Enabled', 'DragStyle', 'ResponseStyle', 'MaxForce', 'MaxTorque', 'Responsiveness' },
	Tool                  = { 'Name', 'Enabled', 'CanBeDropped', 'RequiresHandle', 'ToolTip' },
	Camera                = { 'Name', 'CameraType', 'FieldOfView', 'CFrame' },
	Team                  = { 'Name', 'TeamColor', 'AutoAssignable' },
}

local CLASS_PATTERNS = {
	{ pattern = 'Value',      props = { 'Name', 'Value' } },
	{ pattern = 'Part',       props = DEFAULT_PROPERTIES.BasePart },
	{ pattern = 'Union',      props = DEFAULT_PROPERTIES.BasePart },
	{ pattern = 'Mesh',       props = DEFAULT_PROPERTIES.BasePart },
	{ pattern = 'Gui',        props = DEFAULT_PROPERTIES.Frame },
	{ pattern = 'Frame',      props = DEFAULT_PROPERTIES.Frame },
	{ pattern = 'Text',       props = DEFAULT_PROPERTIES.TextLabel },
	{ pattern = 'Image',      props = DEFAULT_PROPERTIES.ImageLabel },
	{ pattern = 'Video',      props = DEFAULT_PROPERTIES.ImageLabel },
	{ pattern = 'Light',      props = DEFAULT_PROPERTIES.PointLight },
	{ pattern = 'Constraint', props = { 'Name', 'Enabled', 'Visible' } },
	{ pattern = 'Emitter',    props = DEFAULT_PROPERTIES.ParticleEmitter },
	{ pattern = 'Particle',   props = DEFAULT_PROPERTIES.ParticleEmitter },
}

local VALUE_SERIALIZERS = {
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

--  Executor detection

local WebSocket = WebSocket
	or (syn and syn.websocket)
	or (Fluxus and Fluxus.websocket)
	or (krnl and krnl.websocket)
	or (Xeno and Xeno.websocket)
	or websocket

if WebSocket == nil then
	warn'[rbxdev-bridge] No WebSocket implementation found!'
	return
end

local executorName, executorVersion = (function()
	if identifyexecutor == nil then return 'Unknown', '1.0' end
	local name, version = identifyexecutor()
	return name or 'Unknown', version or '1.0'
end)()

--  State

local connection = nil
local connected = false
local refreshConnections = {}
local bridgeAlive = true

local remoteSpyEnabled = false
local remoteSpyFilter = ''
local originalNamecall = nil

-- Register this bridge instance globally for cleanup on re-execution
if getgenv then
	getgenv()._RBXDEV_BRIDGE = {
		id = BRIDGE_ID,
		connection = nil, -- updated when connection is established
		refreshConnections = refreshConnections,
		alive = true,
	}
end

-- Check if this specific bridge instance is still the active one
local isBridgeAlive = function()
	if getgenv == nil then return bridgeAlive end
	local bridge = getgenv()._RBXDEV_BRIDGE
	return bridge ~= nil and bridge.id == BRIDGE_ID and bridge.alive
end

--  Networking

local jsonEncode = function(data)
	return HttpService:JSONEncode(data)
end

local jsonDecode = function(data)
	local success, result = pcall(HttpService.JSONDecode, HttpService, data)
	if not success then return nil end
	return result
end

local send = function(data)
	if connection == nil or not connected then return end
	connection:Send(jsonEncode(data))
end

local sendResult = function(messageType, id, success, payload)
	local result = { type = messageType, id = id, success = success }
	for k, v in pairs(payload or {}) do result[k] = v end
	send(result)
end

--  Instance path helpers

local resolveInstancePath = function(path)
	local instance = game
	for _, segment in ipairs(path) do
		-- Check for index-based resolution: "name\0index" (for duplicate-named siblings)
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

local getInstancePath = function(instance)
	local path = {}
	local current = instance
	while current ~= nil and current ~= game do
		table.insert(path, 1, current.Name)
		current = current.Parent
	end
	return path
end

local instanceToPath = function(instance)
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

--  Value serialization (totally not skidded from SimpleSpy)

local valueToLua
local tableToLua

valueToLua = function(v, depth, seen)
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

	if t == 'Instance' then return instanceToPath(v) end
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
	if t == 'table'       then return tableToLua(v, depth, seen) end
	if t == 'function'    then return 'function() end' end
	if t == 'thread'      then return 'nil' end

	local ok, str = pcall(tostring, v)
	if ok then return 'nil --[[' .. t .. ': ' .. str .. ']]' end
	return 'nil --[[' .. t .. ']]'
end

tableToLua = function(t, depth, seen)
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
			table.insert(parts, indent .. valueToLua(t[i], depth + 1, seen))
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
			keyStr = '[' .. valueToLua(k, depth + 1, seen) .. ']'
		end
		table.insert(parts, indent .. keyStr .. ' = ' .. valueToLua(v, depth + 1, seen))
	end

	seen[t] = nil

	if #parts == 0 then return '{}' end
	return '{\n' .. table.concat(parts, ',\n') .. '\n' .. closingIndent .. '}'
end

--  Remote spy helpers (totally not skidded from SimpleSpy)

local generateRemoteCode = function(remote, method, ...)
	local args = { ... }
	local numArgs = select('#', ...)
	local remotePath = instanceToPath(remote)

	if numArgs == 0 then
		return remotePath .. ':' .. method .. '()'
	end

	local hasComplexArgs = false
	for i = 1, numArgs do
		local t = typeof(args[i])
		if t == 'table' or t == 'CFrame' or t == 'NumberSequence' or t == 'ColorSequence' or t == 'TweenInfo' then
			hasComplexArgs = true
			break
		end
	end

	if not hasComplexArgs and numArgs <= 5 then
		local argParts = {}
		for i = 1, numArgs do table.insert(argParts, valueToLua(args[i])) end
		return remotePath .. ':' .. method .. '(' .. table.concat(argParts, ', ') .. ')'
	end

	local argParts = {}
	for i = 1, numArgs do table.insert(argParts, '    ' .. valueToLua(args[i], 1)) end
	return 'local args = {\n' .. table.concat(argParts, ',\n') .. '\n}\n\n' .. remotePath .. ':' .. method .. '(unpack(args))'
end

local serializeArguments = function(...)
	local args = { ... }
	local parts = {}
	for i = 1, select('#', ...) do table.insert(parts, valueToLua(args[i])) end
	return table.concat(parts, ', ')
end

--  Properties

local getDefaultProperties = function(className)
	local props = DEFAULT_PROPERTIES[className]
	if props ~= nil then return props end
	for _, entry in ipairs(CLASS_PATTERNS) do
		if className:find(entry.pattern) ~= nil then return entry.props end
	end
	return { 'Name', 'ClassName' }
end

local serializePropertyValue = function(name, value)
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

local parseValue = function(value, valueType)
	local parser = VALUE_PARSERS[valueType]
	if parser == nil then return value end
	return parser(value)
end

local parseError = function(errorString)
	local file, line, message = errorString:match'(%S+):(%d+): (.+)'
	return {
		message = message or errorString,
		file = file,
		line = line and tonumber(line) or nil,
	}
end

local getInstanceProperties = function(instance, requestedProps)
	local props = {}
	local propsToGet = requestedProps or getDefaultProperties(instance.ClassName)
	for _, propName in ipairs(propsToGet) do
		local ok, value = pcall(function() return instance[propName] end)
		if ok then table.insert(props, serializePropertyValue(propName, value)) end
	end
	return props
end

--  Game tree (totally not skidded from Dex)

local serializeInstance
serializeInstance = function(instance, depth)
	if depth <= 0 then return nil end

	local node = { name = instance.Name, className = instance.ClassName }
	local children = instance:GetChildren()

	if depth == 1 and #children > 0 then
		node.hasChildren = true
		return node
	end

	if #children > 0 then
		local serialized = {}
		for _, child in ipairs(children) do
			local childNode = serializeInstance(child, depth - 1)
			if childNode ~= nil then table.insert(serialized, childNode) end
		end
		if #serialized > 0 then node.children = serialized end
	end

	return node
end

local getChildrenAtPath = function(path, depth)
	local instance = resolveInstancePath(path)
	if instance == nil then return nil end

	local result = {}
	for _, child in ipairs(instance:GetChildren()) do
		local childNode = serializeInstance(child, depth)
		if childNode ~= nil then table.insert(result, childNode) end
	end
	return result
end

local getGameTree = function(services, depth)
	local tree = {}
	local treeDepth = depth or CONFIG.updateTreeDepth
	local added = {}

	for _, serviceName in ipairs(services or CONFIG.gameTreeServices) do
		local ok, service = pcall(game.GetService, game, serviceName)
		if ok and service ~= nil then
			local serviceNode = serializeInstance(service, treeDepth)
			if serviceNode ~= nil then
				table.insert(tree, serviceNode)
				added[service] = true
			end
		end
	end

	if services == nil then
		for _, child in ipairs(game:GetChildren()) do
			if added[child] == nil then
				local ok, serviceNode = pcall(serializeInstance, child, treeDepth)
				if ok and serviceNode ~= nil then table.insert(tree, serviceNode) end
			end
		end
	end

	return tree
end

-- Game tree updates are sent only on connect and when explicitly requested by VS Code.
-- No automatic DescendantAdded/DescendantRemoving listeners — they fire too frequently
-- and flood VS Code with redundant tree dumps. Use the refresh button instead.

--  Teleport helper

local getTargetPosition = function(instance)
	if instance:IsA'BasePart' then return instance.Position + Vector3.new(0, 5, 0) end

	if instance:IsA'Model' then
		local primaryPart = instance.PrimaryPart
		if primaryPart ~= nil then return primaryPart.Position + Vector3.new(0, 5, 0) end
		local part = instance:FindFirstChildWhichIsA('BasePart', true)
		if part ~= nil then return part.Position + Vector3.new(0, 5, 0) end
		error'Model has no parts to teleport to'
	end

	if instance:IsA'Attachment' then return instance.WorldPosition + Vector3.new(0, 5, 0) end

	error('Cannot teleport to ' .. instance.ClassName)
end

--  Module reflection

local reflectModuleInterface = function(module)
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

--  Message handlers

local MESSAGE_HANDLERS = {}

MESSAGE_HANDLERS.execute = function(message)
	local fn, loadError = loadstring(message.code)
	if fn == nil then
		sendResult('executeResult', message.id, false, { error = parseError(tostring(loadError)) })
		return
	end

	local ok, result = pcall(fn)
	if not ok then
		sendResult('executeResult', message.id, false, { error = parseError(tostring(result)) })
		return
	end

	sendResult('executeResult', message.id, true, { result = result ~= nil and tostring(result) or nil })
end

MESSAGE_HANDLERS.requestGameTree = function(message)
	local depth = message.depth or CONFIG.updateTreeDepth
	send{ type = 'gameTree', data = getGameTree(message.services, depth) }
end

MESSAGE_HANDLERS.requestChildren = function(message)
	local children = getChildrenAtPath(message.path, message.depth or CONFIG.expandedTreeDepth)
	if children == nil then
		sendResult('childrenResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end
	sendResult('childrenResult', message.id, true, { path = message.path, children = children })
end

MESSAGE_HANDLERS.requestProperties = function(message)
	local instance = resolveInstancePath(message.path)
	if instance == nil then
		sendResult('propertiesResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end
	sendResult('propertiesResult', message.id, true, { properties = getInstanceProperties(instance, message.properties) })
end

MESSAGE_HANDLERS.requestModuleInterface = function(message)
	local moduleRef = message.moduleRef
	local module = nil

	if moduleRef.kind == 'path' then
		local instance = resolveInstancePath(moduleRef.path)
		if instance == nil then
			sendResult('moduleInterface', message.id, false, { error = 'Module not found at: ' .. table.concat(moduleRef.path, '.') })
			return
		end
		if not instance:IsA'ModuleScript' then
			sendResult('moduleInterface', message.id, false, { error = 'Instance is not a ModuleScript' })
			return
		end
		local ok, result = pcall(require, instance)
		if not ok then
			sendResult('moduleInterface', message.id, false, { error = tostring(result) })
			return
		end
		module = result
	elseif moduleRef.kind == 'assetId' then
		local ok, result = pcall(require, moduleRef.id)
		if not ok then
			sendResult('moduleInterface', message.id, false, { error = tostring(result) })
			return
		end
		module = result
	end

	if module == nil then
		sendResult('moduleInterface', message.id, false, { error = 'Failed to load module' })
		return
	end

	sendResult('moduleInterface', message.id, true, { interface = reflectModuleInterface(module) })
end

MESSAGE_HANDLERS.setProperty = function(message)
	local instance = resolveInstancePath(message.path)
	if instance == nil then
		sendResult('setPropertyResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end

	local ok, err = pcall(function() instance[message.property] = parseValue(message.value, message.valueType) end)
	if not ok then
		sendResult('setPropertyResult', message.id, false, { error = tostring(err) })
		return
	end

	sendResult('setPropertyResult', message.id, true)
end

MESSAGE_HANDLERS.teleportTo = function(message)
	local instance = resolveInstancePath(message.path)
	if instance == nil then
		sendResult('teleportToResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end

	local ok, err = pcall(function()
		local player = Players.LocalPlayer
		if player == nil then error'No local player' end
		local character = player.Character
		if character == nil then error'No character' end
		local hrp = character:FindFirstChild'HumanoidRootPart'
		if hrp == nil then error'No HumanoidRootPart' end
		hrp.CFrame = CFrame.new(getTargetPosition(instance))
	end)

	if not ok then
		sendResult('teleportToResult', message.id, false, { error = tostring(err) })
		return
	end

	sendResult('teleportToResult', message.id, true)
end

MESSAGE_HANDLERS.deleteInstance = function(message)
	local instance = resolveInstancePath(message.path)
	if instance == nil then
		sendResult('deleteInstanceResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end

	local ok, err = pcall(instance.Destroy, instance)
	if not ok then
		sendResult('deleteInstanceResult', message.id, false, { error = tostring(err) })
		return
	end

	sendResult('deleteInstanceResult', message.id, true)
end

MESSAGE_HANDLERS.reparentInstance = function(message)
	local source = resolveInstancePath(message.sourcePath)
	if source == nil then
		sendResult('reparentInstanceResult', message.id, false, { error = 'Source not found at: ' .. table.concat(message.sourcePath, '.') })
		return
	end

	local target = resolveInstancePath(message.targetPath)
	if target == nil then
		sendResult('reparentInstanceResult', message.id, false, { error = 'Target not found at: ' .. table.concat(message.targetPath, '.') })
		return
	end

	local ok, err = pcall(function() source.Parent = target end)
	if not ok then
		sendResult('reparentInstanceResult', message.id, false, { error = tostring(err) })
		return
	end

	sendResult('reparentInstanceResult', message.id, true)
end

MESSAGE_HANDLERS.requestScriptSource = function(message)
	local instance = resolveInstancePath(message.path)
	if instance == nil then
		sendResult('scriptSourceResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end

	if not (instance:IsA'LocalScript' or instance:IsA'ModuleScript' or instance:IsA'Script') then
		sendResult('scriptSourceResult', message.id, false, { error = instance.ClassName .. ' is not a script type' })
		return
	end

	local decompilerFunc = decompile or decompilescript or getscriptsource or getsourcescript or get_script_source or nil
	if decompilerFunc == nil then
		sendResult('scriptSourceResult', message.id, false, { error = 'No decompiler available in this executor' })
		return
	end

	local ok, source = pcall(decompilerFunc, instance)
	if not ok then
		sendResult('scriptSourceResult', message.id, false, { error = 'Decompilation failed: ' .. tostring(source) })
		return
	end

	sendResult('scriptSourceResult', message.id, true, { source = source, scriptType = instance.ClassName })
end

MESSAGE_HANDLERS.createInstance = function(message)
	local parent = resolveInstancePath(message.parentPath)
	if parent == nil then
		sendResult('createInstanceResult', message.id, false, { error = 'Parent not found at: ' .. table.concat(message.parentPath, '.') })
		return
	end

	local ok, result = pcall(function()
		local inst = Instance.new(message.className)
		if message.name ~= nil then inst.Name = message.name end
		inst.Parent = parent
		return inst.Name
	end)

	if not ok then
		sendResult('createInstanceResult', message.id, false, { error = tostring(result) })
		return
	end

	sendResult('createInstanceResult', message.id, true, { instanceName = result })
end

MESSAGE_HANDLERS.cloneInstance = function(message)
	local instance = resolveInstancePath(message.path)
	if instance == nil then
		sendResult('cloneInstanceResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end

	local ok, result = pcall(function()
		local clone = instance:Clone()
		if clone == nil then error('Instance cannot be cloned') end
		clone.Parent = instance.Parent
		return clone.Name
	end)

	if not ok then
		sendResult('cloneInstanceResult', message.id, false, { error = tostring(result) })
		return
	end

	sendResult('cloneInstanceResult', message.id, true, { cloneName = result })
end

MESSAGE_HANDLERS.setRemoteSpyEnabled = function(message)
	if hookmetamethod == nil then
		sendResult('setRemoteSpyEnabledResult', message.id, false, { error = 'hookmetamethod not available in this executor' })
		return
	end

	local ok, err = pcall(function()
		if message.enabled and not remoteSpyEnabled then
			local oldNamecall
			oldNamecall = hookmetamethod(game, '__namecall', newcclosure(function(self, ...)
				local args = { ... }
				local method = getnamecallmethod()
				local results = { oldNamecall(self, unpack(args)) }

				pcall(function()
					if checkcaller and checkcaller() then return end
					if not remoteSpyEnabled or not connected then return end
					if method ~= 'FireServer' and method ~= 'InvokeServer' then return end
					if typeof(self) ~= 'Instance' then return end

					local className = self.ClassName
					if className ~= 'RemoteEvent' and className ~= 'RemoteFunction' and className ~= 'UnreliableRemoteEvent' then return end

					local remoteName = self.Name
					if remoteSpyFilter ~= '' and remoteName:lower():find(remoteSpyFilter:lower()) == nil then return end

					send({
						type = 'remoteSpy',
						call = {
							remoteName = remoteName,
							remotePath = getInstancePath(self),
							remoteType = className,
							method = method,
							arguments = serializeArguments(unpack(args)),
							code = generateRemoteCode(self, method, unpack(args)),
							timestamp = os.time(),
						},
					})
				end)

				return unpack(results)
			end))

			originalNamecall = oldNamecall
			remoteSpyEnabled = true
			print'[rbxdev-bridge] Remote spy enabled'

		elseif not message.enabled and remoteSpyEnabled then
			if originalNamecall ~= nil then
				hookmetamethod(game, '__namecall', originalNamecall)
				originalNamecall = nil
			end
			remoteSpyEnabled = false
			print'[rbxdev-bridge] Remote spy disabled'
		end
	end)

	if not ok then
		sendResult('setRemoteSpyEnabledResult', message.id, false, { error = tostring(err) })
		return
	end

	sendResult('setRemoteSpyEnabledResult', message.id, true, { enabled = remoteSpyEnabled })
end

MESSAGE_HANDLERS.setRemoteSpyFilter = function(message)
	remoteSpyFilter = message.filter or ''
	sendResult('setRemoteSpyFilterResult', message.id, true)
end

--  Core

local handleMessage = function(rawMessage)
	local message = jsonDecode(rawMessage)
	if message == nil then return end
	local handler = MESSAGE_HANDLERS[message.type]
	if handler == nil then return end
	handler(message)
end

local setupLogHooks = function()
	-- Prevent double-hooking on re-execution
	if getgenv and getgenv()._RBXDEV_LOG_HOOKED then return end

	local inHook = false

	local safeLog = function(level, ...)
		if inHook or not connected then return end
		inHook = true

		local args = { ... }
		local parts = {}
		for i = 1, select('#', ...) do parts[i] = tostring(args[i]) end

		pcall(send, {
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


local connect
connect = function()
	if not isBridgeAlive() then return false end

	local ok, ws = pcall(WebSocket.connect, CONFIG.host)
	if not ok or ws == nil then
		-- Retry after delay (handles VS Code restart where server isn't ready yet)
		task.delay(CONFIG.reconnectDelay, function()
			if not connected and isBridgeAlive() then connect() end
		end)
		return false
	end

	connection = ws
	connected = true

	if getgenv and getgenv()._RBXDEV_BRIDGE then
		getgenv()._RBXDEV_BRIDGE.connection = ws
	end

	send{ type = 'connected', executorName = executorName, version = executorVersion }
	send{ type = 'gameTree', data = getGameTree(nil, CONFIG.firstConnectDepth) }

	ws.OnMessage:Connect(handleMessage)

	ws.OnClose:Connect(function()
		connected = false
		connection = nil
		task.delay(CONFIG.reconnectDelay, function()
			if not connected and isBridgeAlive() then connect() end
		end)
	end)

	return true
end

connect()
setupLogHooks()
