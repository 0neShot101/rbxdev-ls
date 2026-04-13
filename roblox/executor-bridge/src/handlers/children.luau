local config = require("config")
local protocol = require("protocol")
local gameTree = require("gameTree")

local M = {}

M.handleRequestChildren = function(message)
	local children = gameTree.getChildrenAtPath(message.path, message.depth or config.CONFIG.expandedTreeDepth)
	if children == nil then
		protocol.sendResult('childrenResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
		return
	end
	protocol.sendResult('childrenResult', message.id, true, { path = message.path, children = children })
end

return M
