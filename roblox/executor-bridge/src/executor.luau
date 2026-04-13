local M = {}

M.WebSocket = WebSocket
	or (syn and syn.websocket)
	or (Fluxus and Fluxus.websocket)
	or (krnl and krnl.websocket)
	or (Xeno and Xeno.websocket)
	or websocket

M.HttpRequest = request
	or http_request
	or syn_request
	or (syn and syn.request)
	or (http and http.request)

if M.WebSocket == nil then
	warn'[rbxdev-bridge] No WebSocket implementation found!'
end

M.name, M.version = (function()
	if identifyexecutor == nil then return 'Unknown', '1.0' end
	local name, version = identifyexecutor()
	return name or 'Unknown', version or '1.0'
end)()

return M
