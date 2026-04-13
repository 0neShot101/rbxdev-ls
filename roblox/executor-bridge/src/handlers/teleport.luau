local Players = game:GetService'Players'

local protocol = require("protocol")

local M = {}

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

M.handleTeleportTo = function(message)
	local instance = protocol.resolveInstancePath(message.path)
	if instance == nil then
		protocol.sendResult('teleportToResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
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
		protocol.sendResult('teleportToResult', message.id, false, { error = tostring(err) })
		return
	end

	protocol.sendResult('teleportToResult', message.id, true)
end

return M
