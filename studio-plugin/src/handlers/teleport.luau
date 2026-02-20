local RunService = game:GetService'RunService'
local protocol = require(script.Parent.Parent.protocol)

local teleport = {}

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

teleport.teleportTo = function(path)
	local instance = protocol.resolveInstancePath(path)
	if instance == nil then
		return { success = false, error = 'Instance not found at: ' .. table.concat(path, '.') }
	end

	local ok, err = pcall(function()
		local targetPos = getTargetPosition(instance)

		if RunService:IsEdit() then
			local camera = workspace.CurrentCamera
			if camera ~= nil then
				camera.CFrame = CFrame.new(targetPos + Vector3.new(0, 5, 10), targetPos)
			end
			return
		end

		error'Teleport to character is not supported in Studio server context'
	end)

	if not ok then
		return { success = false, error = tostring(err) }
	end

	return { success = true }
end

return teleport
