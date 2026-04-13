local protocol = require(script.Parent.Parent.protocol)

local properties = {}

local DEFAULT_PROPERTIES = {
	BasePart          = { 'Name', 'Transparency', 'Color', 'Material', 'Anchored', 'CanCollide', 'Position', 'Size' },
	Part              = { 'Name', 'Transparency', 'Color', 'Material', 'Anchored', 'CanCollide', 'Position', 'Size', 'Shape' },
	MeshPart          = { 'Name', 'Transparency', 'Color', 'Material', 'Anchored', 'CanCollide', 'Position', 'Size' },
	UnionOperation    = { 'Name', 'Transparency', 'Color', 'Material', 'Anchored', 'CanCollide', 'Position', 'Size' },
	Model             = { 'Name', 'PrimaryPart' },
	Folder            = { 'Name' },
	Configuration     = { 'Name' },
	Script            = { 'Name', 'Enabled' },
	LocalScript       = { 'Name', 'Enabled' },
	ModuleScript      = { 'Name' },
	IntValue          = { 'Name', 'Value' },
	NumberValue       = { 'Name', 'Value' },
	StringValue       = { 'Name', 'Value' },
	BoolValue         = { 'Name', 'Value' },
	ObjectValue       = { 'Name', 'Value' },
	Sound             = { 'Name', 'Volume', 'Playing', 'SoundId', 'TimePosition', 'Looped', 'PlaybackSpeed' },
	PointLight        = { 'Name', 'Enabled', 'Brightness', 'Color', 'Range', 'Shadows' },
	SpotLight         = { 'Name', 'Enabled', 'Brightness', 'Color', 'Range', 'Angle', 'Shadows' },
	Frame             = { 'Name', 'Visible', 'BackgroundColor3', 'BackgroundTransparency', 'Position', 'Size', 'AnchorPoint' },
	ScreenGui         = { 'Name', 'Enabled', 'ResetOnSpawn', 'ZIndexBehavior' },
	TextLabel         = { 'Name', 'Visible', 'Text', 'TextColor3', 'TextSize', 'Font', 'TextScaled', 'TextWrapped' },
	TextButton        = { 'Name', 'Visible', 'Text', 'TextColor3', 'TextSize', 'Font', 'TextScaled', 'TextWrapped' },
	TextBox           = { 'Name', 'Visible', 'Text', 'TextColor3', 'TextSize', 'Font', 'PlaceholderText', 'ClearTextOnFocus' },
	ImageLabel        = { 'Name', 'Visible', 'Image', 'ImageColor3', 'ImageTransparency', 'ScaleType' },
	ImageButton       = { 'Name', 'Visible', 'Image', 'ImageColor3', 'ImageTransparency', 'ScaleType' },
	Humanoid          = { 'Name', 'Health', 'MaxHealth', 'WalkSpeed', 'JumpPower', 'JumpHeight', 'HipHeight', 'AutoRotate' },
	Camera            = { 'Name', 'CameraType', 'FieldOfView', 'CFrame' },
	RemoteEvent       = { 'Name' },
	RemoteFunction    = { 'Name' },
	Highlight         = { 'Name', 'Enabled', 'FillColor', 'FillTransparency', 'OutlineColor', 'OutlineTransparency' },
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
	{ pattern = 'Light',      props = DEFAULT_PROPERTIES.PointLight },
	{ pattern = 'Constraint', props = { 'Name', 'Enabled', 'Visible' } },
}

local getDefaultProperties = function(className)
	local props = DEFAULT_PROPERTIES[className]
	if props ~= nil then return props end
	for _, entry in ipairs(CLASS_PATTERNS) do
		if className:find(entry.pattern) ~= nil then return entry.props end
	end
	return { 'Name', 'ClassName' }
end

properties.getProperties = function(path, requestedProps)
	local instance = protocol.resolveInstancePath(path)
	if instance == nil then
		return { success = false, error = 'Instance not found at: ' .. table.concat(path, '.') }
	end

	local props = {}
	local propsToGet = requestedProps or getDefaultProperties(instance.ClassName)
	for _, propName in ipairs(propsToGet) do
		local ok, value = pcall(function() return instance[propName] end)
		if ok then table.insert(props, protocol.serializePropertyValue(propName, value)) end
	end
	return { success = true, properties = props }
end

properties.setProperty = function(path, property, value, valueType)
	local instance = protocol.resolveInstancePath(path)
	if instance == nil then
		return { success = false, error = 'Instance not found at: ' .. table.concat(path, '.') }
	end

	local ok, err = pcall(function()
		instance[property] = protocol.parseValue(value, valueType)
	end)
	if not ok then
		return { success = false, error = tostring(err) }
	end

	return { success = true }
end

return properties
