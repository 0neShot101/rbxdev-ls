local LogService = game:GetService'LogService'

local console = {}

console.setup = function(sendFn)
	LogService.MessageOut:Connect(function(message, messageType)
		local level = 'info'
		if messageType == Enum.MessageType.MessageWarning then
			level = 'warn'
		elseif messageType == Enum.MessageType.MessageError then
			level = 'error'
		end

		sendFn{
			type = 'log',
			level = level,
			message = message,
			timestamp = os.time(),
		}
	end)
end

return console
