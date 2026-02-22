local protocol = require(script.Parent.Parent.protocol)

local gameTree = {}

local CONFIG = {
	updateTreeDepth   = 3,
	expandedTreeDepth = 2,
	firstConnectDepth = 4,
	gameTreeServices  = {
		'Workspace', 'Players', 'ReplicatedStorage', 'ReplicatedFirst',
		'StarterGui', 'StarterPack', 'StarterPlayer', 'Lighting',
		'SoundService', 'Chat', 'Teams',
	},
}

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

gameTree.buildTree = function(services, depth)
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

gameTree.buildFirstConnectTree = function()
	return gameTree.buildTree(nil, CONFIG.firstConnectDepth)
end

gameTree.getChildren = function(path)
	local instance = protocol.resolveInstancePath(path)
	if instance == nil then
		return { success = false, error = 'Instance not found at: ' .. table.concat(path, '.') }
	end

	local result = {}
	for _, child in ipairs(instance:GetChildren()) do
		local childNode = serializeInstance(child, CONFIG.expandedTreeDepth)
		if childNode ~= nil then table.insert(result, childNode) end
	end
	return { success = true, children = result }
end

return gameTree
