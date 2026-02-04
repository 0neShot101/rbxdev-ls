local HttpService = game:GetService'HttpService';
local Players = game:GetService'Players';

local userConfig = ... or {};

local CONFIG = {
	host = 'ws://127.0.0.1:21324';
	reconnectDelay = 5;
	initialTreeDepth = 5;  -- Serialize 5 levels deep for completions
	expandedTreeDepth = 3; -- When expanding, get 3 more levels
	gameTreeServices = {
		'Workspace'; 'Players'; 'ReplicatedStorage'; 'ReplicatedFirst';
		'StarterGui'; 'StarterPack'; 'StarterPlayer'; 'Lighting';
		'SoundService'; 'Chat'; 'Teams';
	};
};

-- Merge user config with defaults
for k, v in pairs(userConfig) do CONFIG[k] = v; end

local DEFAULT_PROPERTIES = {
	BasePart = { 'Name'; 'Transparency'; 'Color'; 'Material'; 'Anchored'; 'CanCollide'; 'Position'; 'Size' };
	Part = { 'Name'; 'Transparency'; 'Color'; 'Material'; 'Anchored'; 'CanCollide'; 'Position'; 'Size'; 'Shape' };
	MeshPart = { 'Name'; 'Transparency'; 'Color'; 'Material'; 'Anchored'; 'CanCollide'; 'Position'; 'Size' };
	UnionOperation = { 'Name'; 'Transparency'; 'Color'; 'Material'; 'Anchored'; 'CanCollide'; 'Position'; 'Size' };
	SpawnLocation = { 'Name'; 'Transparency'; 'Color'; 'Material'; 'Anchored'; 'CanCollide'; 'Position'; 'Size'; 'Enabled'; 'TeamColor' };
	Model = { 'Name'; 'PrimaryPart' };
	Folder = { 'Name' };
	Configuration = { 'Name' };
	Script = { 'Name'; 'Enabled' };
	LocalScript = { 'Name'; 'Enabled' };
	ModuleScript = { 'Name' };
	IntValue = { 'Name'; 'Value' };
	NumberValue = { 'Name'; 'Value' };
	StringValue = { 'Name'; 'Value' };
	BoolValue = { 'Name'; 'Value' };
	ObjectValue = { 'Name'; 'Value' };
	Color3Value = { 'Name'; 'Value' };
	BrickColorValue = { 'Name'; 'Value' };
	Vector3Value = { 'Name'; 'Value' };
	CFrameValue = { 'Name'; 'Value' };
	RayValue = { 'Name'; 'Value' };
	IntConstrainedValue = { 'Name'; 'Value'; 'MinValue'; 'MaxValue' };
	DoubleConstrainedValue = { 'Name'; 'Value'; 'MinValue'; 'MaxValue' };
	Sound = { 'Name'; 'Volume'; 'Playing'; 'SoundId'; 'TimePosition'; 'Looped'; 'PlaybackSpeed' };
	PointLight = { 'Name'; 'Enabled'; 'Brightness'; 'Color'; 'Range'; 'Shadows' };
	SpotLight = { 'Name'; 'Enabled'; 'Brightness'; 'Color'; 'Range'; 'Angle'; 'Shadows' };
	SurfaceLight = { 'Name'; 'Enabled'; 'Brightness'; 'Color'; 'Range'; 'Angle'; 'Shadows' };
	Frame = { 'Name'; 'Visible'; 'BackgroundColor3'; 'BackgroundTransparency'; 'Position'; 'Size'; 'AnchorPoint' };
	ScrollingFrame = { 'Name'; 'Visible'; 'BackgroundColor3'; 'BackgroundTransparency'; 'Position'; 'Size'; 'CanvasSize'; 'ScrollingDirection' };
	ScreenGui = { 'Name'; 'Enabled'; 'ResetOnSpawn'; 'ZIndexBehavior' };
	BillboardGui = { 'Name'; 'Enabled'; 'Size'; 'StudsOffset'; 'MaxDistance'; 'AlwaysOnTop' };
	SurfaceGui = { 'Name'; 'Enabled'; 'Face'; 'PixelsPerStud'; 'AlwaysOnTop' };
	ViewportFrame = { 'Name'; 'Visible'; 'BackgroundColor3'; 'BackgroundTransparency'; 'Position'; 'Size'; 'Ambient'; 'LightColor' };
	TextLabel = { 'Name'; 'Visible'; 'Text'; 'TextColor3'; 'TextSize'; 'Font'; 'TextScaled'; 'TextWrapped' };
	TextButton = { 'Name'; 'Visible'; 'Text'; 'TextColor3'; 'TextSize'; 'Font'; 'TextScaled'; 'TextWrapped' };
	TextBox = { 'Name'; 'Visible'; 'Text'; 'TextColor3'; 'TextSize'; 'Font'; 'PlaceholderText'; 'ClearTextOnFocus' };
	ImageLabel = { 'Name'; 'Visible'; 'Image'; 'ImageColor3'; 'ImageTransparency'; 'ScaleType' };
	ImageButton = { 'Name'; 'Visible'; 'Image'; 'ImageColor3'; 'ImageTransparency'; 'ScaleType' };
	UIListLayout = { 'Name'; 'FillDirection'; 'HorizontalAlignment'; 'VerticalAlignment'; 'SortOrder'; 'Padding' };
	UIGridLayout = { 'Name'; 'CellPadding'; 'CellSize'; 'FillDirection'; 'HorizontalAlignment'; 'VerticalAlignment'; 'SortOrder' };
	UITableLayout = { 'Name'; 'FillDirection'; 'HorizontalAlignment'; 'VerticalAlignment'; 'SortOrder' };
	UIPageLayout = { 'Name'; 'Animated'; 'Circular'; 'EasingDirection'; 'EasingStyle'; 'Padding'; 'TweenTime' };
	UIAspectRatioConstraint = { 'Name'; 'AspectRatio'; 'AspectType'; 'DominantAxis' };
	UISizeConstraint = { 'Name'; 'MaxSize'; 'MinSize' };
	UITextSizeConstraint = { 'Name'; 'MaxTextSize'; 'MinTextSize' };
	UICorner = { 'Name'; 'CornerRadius' };
	UIGradient = { 'Name'; 'Color'; 'Enabled'; 'Offset'; 'Rotation'; 'Transparency' };
	UIPadding = { 'Name'; 'PaddingTop'; 'PaddingBottom'; 'PaddingLeft'; 'PaddingRight' };
	UIScale = { 'Name'; 'Scale' };
	UIStroke = { 'Name'; 'Color'; 'Enabled'; 'Thickness'; 'Transparency'; 'ApplyStrokeMode' };
	RemoteEvent = { 'Name' };
	RemoteFunction = { 'Name' };
	BindableEvent = { 'Name' };
	BindableFunction = { 'Name' };
	UnreliableRemoteEvent = { 'Name' };
	Humanoid = { 'Name'; 'Health'; 'MaxHealth'; 'WalkSpeed'; 'JumpPower'; 'JumpHeight'; 'HipHeight'; 'AutoRotate' };
	HumanoidDescription = { 'Name'; 'HeadColor'; 'TorsoColor'; 'LeftArmColor'; 'RightArmColor'; 'LeftLegColor'; 'RightLegColor' };
	Animation = { 'Name'; 'AnimationId' };
	AnimationController = { 'Name' };
	Animator = { 'Name' };
	ParticleEmitter = { 'Name'; 'Enabled'; 'Rate'; 'Lifetime'; 'Speed'; 'Color'; 'Size'; 'Transparency' };
	Beam = { 'Name'; 'Enabled'; 'Color'; 'Transparency'; 'Width0'; 'Width1'; 'CurveSize0'; 'CurveSize1' };
	Trail = { 'Name'; 'Enabled'; 'Color'; 'Transparency'; 'Lifetime'; 'MinLength'; 'WidthScale' };
	Fire = { 'Name'; 'Enabled'; 'Color'; 'SecondaryColor'; 'Heat'; 'Size' };
	Smoke = { 'Name'; 'Enabled'; 'Color'; 'Opacity'; 'RiseVelocity'; 'Size' };
	Sparkles = { 'Name'; 'Enabled'; 'SparkleColor' };
	Highlight = { 'Name'; 'Enabled'; 'FillColor'; 'FillTransparency'; 'OutlineColor'; 'OutlineTransparency' };
	ForceField = { 'Name'; 'Visible' };
	Decal = { 'Name'; 'Texture'; 'Transparency'; 'Color3'; 'Face' };
	Texture = { 'Name'; 'Texture'; 'Transparency'; 'Color3'; 'Face'; 'StudsPerTileU'; 'StudsPerTileV' };
	SurfaceAppearance = { 'Name'; 'ColorMap'; 'NormalMap'; 'MetalnessMap'; 'RoughnessMap' };
	Attachment = { 'Name'; 'Position'; 'Orientation'; 'Visible' };
	Weld = { 'Name'; 'Part0'; 'Part1'; 'C0'; 'C1' };
	WeldConstraint = { 'Name'; 'Part0'; 'Part1'; 'Enabled' };
	Motor6D = { 'Name'; 'Part0'; 'Part1'; 'C0'; 'C1'; 'CurrentAngle'; 'MaxVelocity' };
	RopeConstraint = { 'Name'; 'Visible'; 'Length'; 'Restitution'; 'Thickness'; 'Color' };
	RodConstraint = { 'Name'; 'Visible'; 'Length'; 'Thickness'; 'Color' };
	SpringConstraint = { 'Name'; 'Visible'; 'FreeLength'; 'Stiffness'; 'Damping'; 'Coils'; 'Thickness'; 'Color' };
	HingeConstraint = { 'Name'; 'Visible'; 'ActuatorType'; 'AngularVelocity'; 'MotorMaxTorque'; 'TargetAngle'; 'LimitsEnabled'; 'LowerAngle'; 'UpperAngle' };
	PrismaticConstraint = { 'Name'; 'Visible'; 'ActuatorType'; 'Velocity'; 'MotorMaxForce'; 'TargetPosition'; 'LimitsEnabled'; 'LowerLimit'; 'UpperLimit' };
	AlignPosition = { 'Name'; 'Mode'; 'MaxForce'; 'MaxVelocity'; 'Responsiveness'; 'RigidityEnabled' };
	AlignOrientation = { 'Name'; 'Mode'; 'MaxTorque'; 'MaxAngularVelocity'; 'Responsiveness'; 'RigidityEnabled' };
	LinearVelocity = { 'Name'; 'VectorVelocity'; 'MaxForce'; 'RelativeTo' };
	AngularVelocity = { 'Name'; 'AngularVelocity'; 'MaxTorque'; 'RelativeTo' };
	VectorForce = { 'Name'; 'Force'; 'RelativeTo' };
	Torque = { 'Name'; 'Torque'; 'RelativeTo' };
	BodyForce = { 'Name'; 'Force' };
	BodyVelocity = { 'Name'; 'Velocity'; 'MaxForce'; 'P' };
	BodyPosition = { 'Name'; 'Position'; 'MaxForce'; 'P'; 'D' };
	BodyGyro = { 'Name'; 'CFrame'; 'MaxTorque'; 'P'; 'D' };
	ClickDetector = { 'Name'; 'MaxActivationDistance'; 'CursorIcon' };
	ProximityPrompt = { 'Name'; 'Enabled'; 'ActionText'; 'ObjectText'; 'KeyboardKeyCode'; 'HoldDuration'; 'MaxActivationDistance'; 'RequiresLineOfSight' };
	DragDetector = { 'Name'; 'Enabled'; 'DragStyle'; 'ResponseStyle'; 'MaxForce'; 'MaxTorque'; 'Responsiveness' };
	Tool = { 'Name'; 'Enabled'; 'CanBeDropped'; 'RequiresHandle'; 'ToolTip' };
	Camera = { 'Name'; 'CameraType'; 'FieldOfView'; 'CFrame' };
	Team = { 'Name'; 'TeamColor'; 'AutoAssignable' };
};

local CLASS_PATTERNS = {
	{ pattern = 'Value'; props = { 'Name'; 'Value' } };
	{ pattern = 'Part'; props = DEFAULT_PROPERTIES.BasePart };
	{ pattern = 'Union'; props = DEFAULT_PROPERTIES.BasePart };
	{ pattern = 'Mesh'; props = DEFAULT_PROPERTIES.BasePart };
	{ pattern = 'Gui'; props = DEFAULT_PROPERTIES.Frame };
	{ pattern = 'Frame'; props = DEFAULT_PROPERTIES.Frame };
	{ pattern = 'Text'; props = DEFAULT_PROPERTIES.TextLabel };
	{ pattern = 'Image'; props = DEFAULT_PROPERTIES.ImageLabel };
	{ pattern = 'Video'; props = DEFAULT_PROPERTIES.ImageLabel };
	{ pattern = 'Light'; props = DEFAULT_PROPERTIES.PointLight };
	{ pattern = 'Constraint'; props = { 'Name'; 'Enabled'; 'Visible' } };
	{ pattern = 'Emitter'; props = DEFAULT_PROPERTIES.ParticleEmitter };
	{ pattern = 'Particle'; props = DEFAULT_PROPERTIES.ParticleEmitter };
};

local VALUE_SERIALIZERS = {
	string = function(v) return v, 'string'; end;
	number = function(v) return tostring(v), 'number'; end;
	boolean = function(v) return tostring(v), 'boolean'; end;
	Instance = function(v) return v:GetFullName(), 'Instance', v.ClassName; end;
	Vector3 = function(v) return string.format('%.3f, %.3f, %.3f', v.X, v.Y, v.Z), 'Vector3'; end;
	Vector2 = function(v) return string.format('%.3f, %.3f', v.X, v.Y), 'Vector2'; end;
	CFrame = function(v) return string.format('%.3f, %.3f, %.3f', v.X, v.Y, v.Z), 'CFrame'; end;
	Color3 = function(v) return string.format('%.3f, %.3f, %.3f', v.R, v.G, v.B), 'Color3'; end;
	BrickColor = function(v) return v.Name, 'BrickColor'; end;
	UDim = function(v) return string.format('%.3f, %d', v.Scale, v.Offset), 'UDim'; end;
	UDim2 = function(v) return string.format('{%.3f, %d}, {%.3f, %d}', v.X.Scale, v.X.Offset, v.Y.Scale, v.Y.Offset), 'UDim2'; end;
	EnumItem = function(v) return tostring(v), 'EnumItem'; end;
};

local VALUE_PARSERS = {
	string = function(v) return v; end;
	number = function(v) return tonumber(v); end;
	boolean = function(v) return v == 'true'; end;
	['nil'] = function() return nil; end;
	Vector3 = function(v)
		local x, y, z = v:match'([^,]+),%s*([^,]+),%s*([^,]+)';
		return Vector3.new(tonumber(x), tonumber(y), tonumber(z));
	end;
	Vector2 = function(v)
		local x, y = v:match'([^,]+),%s*([^,]+)';
		return Vector2.new(tonumber(x), tonumber(y));
	end;
	Color3 = function(v)
		local r, g, b = v:match'([^,]+),%s*([^,]+),%s*([^,]+)';
		return Color3.new(tonumber(r), tonumber(g), tonumber(b));
	end;
	BrickColor = function(v) return BrickColor.new(v); end;
	UDim2 = function(v)
		local xs, xo, ys, yo = v:match'{([^,]+),%s*([^}]+)},%s*{([^,]+),%s*([^}]+)}';
		return UDim2.new(tonumber(xs), tonumber(xo), tonumber(ys), tonumber(yo));
	end;
	UDim = function(v)
		local s, o = v:match'([^,]+),%s*([^,]+)';
		return UDim.new(tonumber(s), tonumber(o));
	end;
	EnumItem = function(v)
		local enumPath = v:match'Enum%.(.+)';
		if enumPath == nil then return nil; end
		local parts = {};
		for part in enumPath:gmatch'[^%.]+' do
			table.insert(parts, part);
		end
		if #parts ~= 2 then return nil; end
		return Enum[parts[1]][parts[2]];
	end;
};

local WebSocket = WebSocket
	or (syn and syn.websocket)
	or (Fluxus and Fluxus.websocket)
	or (krnl and krnl.websocket)
	or (Xeno and Xeno.websocket)
	or websocket;

if WebSocket == nil then
	warn'[rbxdev-bridge] No WebSocket implementation found!';
	return;
end

local executorName, executorVersion = (function()
	if identifyexecutor == nil then return 'Unknown', '1.0'; end
	local name, version = identifyexecutor();
	return name or 'Unknown', version or '1.0';
end)();

local connection = nil;
local connected = false;
local refreshConnections = {};
local pendingUpdate = false;
local updateDebounce = 0.5; -- Debounce time for updates

local jsonEncode = function(data)
	return HttpService:JSONEncode(data);
end;

local jsonDecode = function(data)
	local success, result = pcall(HttpService.JSONDecode, HttpService, data);
	if success == false then return nil; end
	return result;
end;

local send = function(data)
	if connection == nil or connected == false then return; end
	connection:Send(jsonEncode(data));
end;

local sendResult = function(messageType, id, success, payload)
	local result = { type = messageType; id = id; success = success };
	for k, v in pairs(payload or {}) do
		result[k] = v;
	end
	send(result);
end;

local resolveInstancePath = function(path)
	local instance = game;
	for _, segment in ipairs(path) do
		local success, child = pcall(instance.FindFirstChild, instance, segment);
		if success == false or child == nil then return nil; end
		instance = child;
	end
	return instance;
end;

local getDefaultProperties = function(className)
	local props = DEFAULT_PROPERTIES[className];
	if props ~= nil then return props; end

	for _, entry in ipairs(CLASS_PATTERNS) do
		if className:find(entry.pattern) ~= nil then return entry.props; end
	end

	return { 'Name'; 'ClassName' };
end;

local serializePropertyValue = function(name, value)
	if value == nil then return { name = name; value = 'nil'; valueType = 'nil' }; end

	local valueType = typeof(value);
	local serializer = VALUE_SERIALIZERS[valueType];

	if serializer == nil then
		return { name = name; value = tostring(value); valueType = 'other' };
	end

	local serializedValue, typeName, className = serializer(value);
	local result = { name = name; value = serializedValue; valueType = typeName };
	if className ~= nil then result.className = className; end
	return result;
end;

local parseValue = function(value, valueType)
	local parser = VALUE_PARSERS[valueType];
	if parser == nil then return value; end
	return parser(value);
end;

local parseError = function(errorString)
	local file, line, message = errorString:match'(%S+):(%d+): (.+)';
	return {
		message = message or errorString;
		file = file;
		line = line and tonumber(line) or nil;
	};
end;

-- Serialize instance with limited depth (lazy loading)
local serializeInstance;
serializeInstance = function(instance, depth)
	if depth <= 0 then return nil; end

	local node = { name = instance.Name; className = instance.ClassName };
	local instanceChildren = instance:GetChildren();

	-- If we're at depth limit but there are children, mark as having children
	if depth == 1 and #instanceChildren > 0 then
		node.hasChildren = true;
		return node;
	end

	-- Serialize children if we have depth remaining
	if #instanceChildren > 0 then
		local children = {};
		for _, child in ipairs(instanceChildren) do
			local childNode = serializeInstance(child, depth - 1);
			if childNode ~= nil then
				table.insert(children, childNode);
			end
		end
		if #children > 0 then
			node.children = children;
		end
	end

	return node;
end;

-- Get children for a specific path (for lazy loading)
local getChildrenAtPath = function(path, depth)
	local instance = resolveInstancePath(path);
	if instance == nil then return nil; end

	local children = {};
	for _, child in ipairs(instance:GetChildren()) do
		local childNode = serializeInstance(child, depth);
		if childNode ~= nil then
			table.insert(children, childNode);
		end
	end
	return children;
end;

local getGameTree = function(services, depth)
	local tree = {};
	local treeDepth = depth or CONFIG.initialTreeDepth;

	for _, serviceName in ipairs(services or CONFIG.gameTreeServices) do
		local success, service = pcall(game.GetService, game, serviceName);
		if success == true and service ~= nil then
			local serviceNode = serializeInstance(service, treeDepth);
			if serviceNode ~= nil then table.insert(tree, serviceNode); end
		end
	end

	return tree;
end;

-- Debounced game tree update (event-driven, no polling)
local sendGameTreeUpdate;
sendGameTreeUpdate = function()
	if connected == false then return; end
	if pendingUpdate == true then return; end

	pendingUpdate = true;
	task.delay(updateDebounce, function()
		pendingUpdate = false;
		if connected == false then return; end

		send{ type = 'gameTree'; data = getGameTree() };
	end);
end;

local getInstanceProperties = function(instance, requestedProps)
	local props = {};
	local propsToGet = requestedProps or getDefaultProperties(instance.ClassName);

	for _, propName in ipairs(propsToGet) do
		local success, value = pcall(function() return instance[propName]; end);
		if success == true then table.insert(props, serializePropertyValue(propName, value)); end
	end

	return props;
end;

local getTargetPosition = function(instance)
	if instance:IsA'BasePart' then return instance.Position + Vector3.new(0, 5, 0); end

	if instance:IsA'Model' then
		local primaryPart = instance.PrimaryPart;
		if primaryPart ~= nil then return primaryPart.Position + Vector3.new(0, 5, 0); end

		local part = instance:FindFirstChildWhichIsA('BasePart', true);
		if part ~= nil then return part.Position + Vector3.new(0, 5, 0); end

		error'Model has no parts to teleport to';
	end

	if instance:IsA'Attachment' then return instance.WorldPosition + Vector3.new(0, 5, 0); end

	error('Cannot teleport to ' .. instance.ClassName);
end;

local reflectModuleInterface = function(module)
	local moduleType = type(module);
	local interface = { kind = moduleType };

	if moduleType == 'function' then
		local info = debug.getinfo(module, 'u');
		interface.functionArity = info and info.nparams or 0;
		return interface;
	end

	if moduleType == 'table' then
		local props = {};
		for key, value in pairs(module) do
			if type(key) ~= 'string' then continue; end

			local prop = { name = key; valueKind = type(value) };
			if type(value) == 'function' then
				local info = debug.getinfo(value, 'u');
				prop.functionArity = info and info.nparams or 0;
			end
			table.insert(props, prop);
		end
		interface.properties = props;
		return interface;
	end

	interface.kind = 'other';
	return interface;
end;

local MESSAGE_HANDLERS = {};

MESSAGE_HANDLERS.execute = function(message)
	local fn, loadError = loadstring(message.code);

	if fn == nil then
		sendResult('executeResult', message.id, false, { error = parseError(tostring(loadError)) });
		return;
	end

	local success, result = pcall(fn);

	if success == false then
		sendResult('executeResult', message.id, false, { error = parseError(tostring(result)) });
		return;
	end

	sendResult('executeResult', message.id, true, { result = result ~= nil and tostring(result) or nil });
end;

MESSAGE_HANDLERS.requestGameTree = function(message)
	local depth = message.depth or CONFIG.initialTreeDepth;
	send{ type = 'gameTree'; data = getGameTree(message.services, depth) };
end;

-- New: Request children for lazy loading when expanding a node
MESSAGE_HANDLERS.requestChildren = function(message)
	local path = message.path;
	local depth = message.depth or CONFIG.expandedTreeDepth;
	local id = message.id;

	local children = getChildrenAtPath(path, depth);

	if children == nil then
		sendResult('childrenResult', id, false, { error = 'Instance not found at: ' .. table.concat(path, '.') });
		return;
	end

	sendResult('childrenResult', id, true, { path = path; children = children });
end;

MESSAGE_HANDLERS.requestProperties = function(message)
	local instance = resolveInstancePath(message.path);

	if instance == nil then
		sendResult('propertiesResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') });
		return;
	end

	sendResult('propertiesResult', message.id, true, { properties = getInstanceProperties(instance, message.properties) });
end;

MESSAGE_HANDLERS.requestModuleInterface = function(message)
	local moduleRef = message.moduleRef;
	local module = nil;

	if moduleRef.kind == 'path' then
		local instance = resolveInstancePath(moduleRef.path);

		if instance == nil then
			sendResult('moduleInterface', message.id, false, { error = 'Module not found at: ' .. table.concat(moduleRef.path, '.') });
			return;
		end

		if instance:IsA'ModuleScript' == false then
			sendResult('moduleInterface', message.id, false, { error = 'Instance is not a ModuleScript' });
			return;
		end

		local success, result = pcall(require, instance);
		if success == false then
			sendResult('moduleInterface', message.id, false, { error = tostring(result) });
			return;
		end
		module = result;

	elseif moduleRef.kind == 'assetId' then
		local success, result = pcall(require, moduleRef.id);
		if success == false then
			sendResult('moduleInterface', message.id, false, { error = tostring(result) });
			return;
		end
		module = result;
	end

	if module == nil then
		sendResult('moduleInterface', message.id, false, { error = 'Failed to load module' });
		return;
	end

	sendResult('moduleInterface', message.id, true, { interface = reflectModuleInterface(module) });
end;

MESSAGE_HANDLERS.setProperty = function(message)
	local instance = resolveInstancePath(message.path);

	if instance == nil then
		sendResult('setPropertyResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') });
		return;
	end

	local success, err = pcall(function()
		instance[message.property] = parseValue(message.value, message.valueType);
	end);

	if success == false then
		sendResult('setPropertyResult', message.id, false, { error = tostring(err) });
		return;
	end

	sendResult('setPropertyResult', message.id, true);
end;

MESSAGE_HANDLERS.teleportTo = function(message)
	local instance = resolveInstancePath(message.path);

	if instance == nil then
		sendResult('teleportToResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') });
		return;
	end

	local success, err = pcall(function()
		local player = Players.LocalPlayer;
		if player == nil then error'No local player'; end

		local character = player.Character;
		if character == nil then error'No character'; end

		local humanoidRootPart = character:FindFirstChild'HumanoidRootPart';
		if humanoidRootPart == nil then error'No HumanoidRootPart'; end

		humanoidRootPart.CFrame = CFrame.new(getTargetPosition(instance));
	end);

	if success == false then
		sendResult('teleportToResult', message.id, false, { error = tostring(err) });
		return;
	end

	sendResult('teleportToResult', message.id, true);
end;

MESSAGE_HANDLERS.deleteInstance = function(message)
	local instance = resolveInstancePath(message.path);

	if instance == nil then
		sendResult('deleteInstanceResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') });
		return;
	end

	local success, err = pcall(instance.Destroy, instance);

	if success == false then
		sendResult('deleteInstanceResult', message.id, false, { error = tostring(err) });
		return;
	end

	sendResult('deleteInstanceResult', message.id, true);
	-- Tree will update via ChildRemoved event
end;

MESSAGE_HANDLERS.reparentInstance = function(message)
	local sourceInstance = resolveInstancePath(message.sourcePath);

	if sourceInstance == nil then
		sendResult('reparentInstanceResult', message.id, false, { error = 'Source instance not found at: ' .. table.concat(message.sourcePath, '.') });
		return;
	end

	local targetInstance = resolveInstancePath(message.targetPath);

	if targetInstance == nil then
		sendResult('reparentInstanceResult', message.id, false, { error = 'Target instance not found at: ' .. table.concat(message.targetPath, '.') });
		return;
	end

	local success, err = pcall(function()
		sourceInstance.Parent = targetInstance;
	end);

	if success == false then
		sendResult('reparentInstanceResult', message.id, false, { error = tostring(err) });
		return;
	end

	sendResult('reparentInstanceResult', message.id, true);
	-- Tree will update via ChildAdded/ChildRemoved events
end;

local handleMessage = function(rawMessage)
	local message = jsonDecode(rawMessage);
	if message == nil then return; end

	local handler = MESSAGE_HANDLERS[message.type];
	if handler == nil then return; end

	handler(message);
end;

local setupLogHooks = function()
	local inHook = false;

	local safeLog = function(level, ...)
		if inHook == true or connected == false then return; end
		inHook = true;

		local args = { ... };
		local parts = {};
		for i = 1, select('#', ...) do
			parts[i] = tostring(args[i]);
		end

		pcall(send, {
			type = 'log';
			level = level;
			message = table.concat(parts, '\t');
			timestamp = os.time();
		});

		inHook = false;
	end;

	if hookfunction ~= nil then
		local originalPrint = clonefunction(print);
		local originalWarn = clonefunction(warn);
		local originalError = clonefunction(error);

		hookfunction(print, function(...)
			safeLog('info', ...);
			return originalPrint(...);
		end);

		hookfunction(warn, function(...)
			safeLog('warn', ...);
			return originalWarn(...);
		end);

		hookfunction(error, function(message, level)
			safeLog('error', message);
			return originalError(message, level);
		end);

		print'[rbxdev-bridge] Log hooks installed (hookfunction)';
		return;
	end

	local originalPrint = print;
	local originalWarn = warn;

	getgenv().print = function(...)
		safeLog('info', ...);
		return originalPrint(...);
	end;

	getgenv().warn = function(...)
		safeLog('warn', ...);
		return originalWarn(...);
	end;

	print'[rbxdev-bridge] Log hooks installed (getgenv fallback)';
end;

-- Set up event-driven tree updates (no polling!)
local setupEventListeners = function()
	for _, conn in ipairs(refreshConnections) do
		pcall(conn.Disconnect, conn);
	end
	refreshConnections = {};

	for _, serviceName in ipairs(CONFIG.gameTreeServices) do
		local success, service = pcall(game.GetService, game, serviceName);

		if success == true and service ~= nil then
			-- Listen for direct children changes
			table.insert(refreshConnections, service.ChildAdded:Connect(function()
				sendGameTreeUpdate();
			end));
			table.insert(refreshConnections, service.ChildRemoved:Connect(function()
				sendGameTreeUpdate();
			end));

			-- Also listen for descendant changes (deeper updates)
			table.insert(refreshConnections, service.DescendantAdded:Connect(function()
				sendGameTreeUpdate();
			end));
			table.insert(refreshConnections, service.DescendantRemoving:Connect(function()
				sendGameTreeUpdate();
			end));
		end
	end

	print'[rbxdev-bridge] Event listeners enabled (no polling)';
end;

local connect;
connect = function()
	print('[rbxdev-bridge] Connecting to ' .. CONFIG.host .. '...');

	local success, ws = pcall(WebSocket.connect, CONFIG.host);

	if success == false or ws == nil then
		warn('[rbxdev-bridge] Failed to connect: ' .. tostring(ws));
		return false;
	end

	connection = ws;
	connected = true;

	send{
		type = 'connected';
		executorName = executorName;
		version = executorVersion;
	};

	print('[rbxdev-bridge] Connected! Executor: ' .. executorName .. ' v' .. executorVersion);

	ws.OnMessage:Connect(handleMessage);

	ws.OnClose:Connect(function()
		connected = false;
		connection = nil;
		print'[rbxdev-bridge] Disconnected from server';

		task.delay(CONFIG.reconnectDelay, function()
			if connected == false then connect(); end
		end);
	end);

	return true;
end;

connect();
setupLogHooks();
setupEventListeners();

print'[rbxdev-bridge] Bridge script loaded successfully';
print'[rbxdev-bridge] Press Ctrl+Shift+E in VS Code to execute code';
