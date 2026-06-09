-- rbxdev executor bridge

return (function(oldRequire, ...)
local _vararg = {...}
local _modules = {}

local require = function(path)
	if _modules[path] == nil then
		local fallback
		pcall(function() fallback = oldRequire(path) end)
		if typeof(fallback) ~= "nil" then return fallback end
		error('[bundler] module not found: ' .. path)
	end
	local mod = _modules[path]
	if mod.cached then return mod.value end
	mod.value = mod.load()
	mod.cached = true
	return mod.value
end

_modules["config.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local M = {}

			M.DEFAULT_PROPERTIES = {
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

			M.CLASS_PATTERNS = {
				{ pattern = 'Value',      props = { 'Name', 'Value' } },
				{ pattern = 'Part',       props = M.DEFAULT_PROPERTIES.BasePart },
				{ pattern = 'Union',      props = M.DEFAULT_PROPERTIES.BasePart },
				{ pattern = 'Mesh',       props = M.DEFAULT_PROPERTIES.BasePart },
				{ pattern = 'Gui',        props = M.DEFAULT_PROPERTIES.Frame },
				{ pattern = 'Frame',      props = M.DEFAULT_PROPERTIES.Frame },
				{ pattern = 'Text',       props = M.DEFAULT_PROPERTIES.TextLabel },
				{ pattern = 'Image',      props = M.DEFAULT_PROPERTIES.ImageLabel },
				{ pattern = 'Video',      props = M.DEFAULT_PROPERTIES.ImageLabel },
				{ pattern = 'Light',      props = M.DEFAULT_PROPERTIES.PointLight },
				{ pattern = 'Constraint', props = { 'Name', 'Enabled', 'Visible' } },
				{ pattern = 'Emitter',    props = M.DEFAULT_PROPERTIES.ParticleEmitter },
				{ pattern = 'Particle',   props = M.DEFAULT_PROPERTIES.ParticleEmitter },
			}

			M.CONFIG = {
				host              = 'ws://127.0.0.1:21324',
				reconnectDelay    = 5,
				reconnectDelayMax = 60,
				enableHealthProbe = true,
				firstConnectDepth = 999,
				updateTreeDepth   = 3,
				expandedTreeDepth = 2,
				gameTreeServices  = {
					'Workspace', 'Players', 'ReplicatedStorage', 'ReplicatedFirst',
					'StarterGui', 'StarterPack', 'StarterPlayer', 'Lighting',
					'SoundService', 'Chat', 'Teams',
				},
			}

			M.applyUserConfig = function(userConfig)
				for k, v in pairs(userConfig) do M.CONFIG[k] = v end
			end

			return M

		end)(unpack(_vararg))
	end,
}

_modules["executor.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
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

		end)(unpack(_vararg))
	end,
}

_modules["gameTree.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local RunService = game:GetService'RunService'

			local config = require("config")
			local state = require("state")
			local protocol = require("protocol")

			local M = {}

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

			M.getChildrenAtPath = function(path, depth)
				local instance = protocol.resolveInstancePath(path)
				if instance == nil then return nil end

				local result = {}
				for _, child in ipairs(instance:GetChildren()) do
					local childNode = serializeInstance(child, depth)
					if childNode ~= nil then table.insert(result, childNode) end
				end
				return result
			end

			M.getGameTree = function(services, depth)
				local tree = {}
				local treeDepth = depth or config.CONFIG.updateTreeDepth
				local added = {}

				for _, serviceName in ipairs(services or config.CONFIG.gameTreeServices) do
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

			-- Auto-refresh subsystem (opt-in). Event handlers do one flag write; a
			-- RunService.Heartbeat-gated deadline coalesces flushes so bursty edits
			-- (model pastes, respawns, StarterGui loads) don't flood the bridge.
			-- This replaces the previous "no listeners at all" policy — the original
			-- flood concern was the full serialisation per event, not the event
			-- surface itself. Keeping the handlers to a single flag write and
			-- debouncing the flush on Heartbeat makes it safe to opt into.
			--
			-- RBXScriptConnections live inside the top-level `refreshConnections`
			-- table so the bridge's re-execution cleanup (at the top of the file)
			-- disposes them when the script is re-run.

			local MIN_AUTO_REFRESH_INTERVAL_SEC = 2.0
			local MAX_COALESCE_SEC = 30.0

			local autoRefreshEnabled = false
			local autoRefreshIntervalSec = 5.0
			local autoRefreshDirty = false
			local autoRefreshFirstDirtyAt = nil
			local autoRefreshFlushAt = nil
			local autoRefreshHeartbeat = nil
			local autoRefreshTopLevel = nil

			local markAutoRefreshDirty
			local attachAutoRefreshListeners
			local detachAutoRefreshListeners
			local autoRefreshHeartbeatTick

			markAutoRefreshDirty = function()
				if not autoRefreshEnabled then return end
				autoRefreshDirty = true
				local now = os.clock()
				if autoRefreshFirstDirtyAt == nil then autoRefreshFirstDirtyAt = now end
				if autoRefreshFlushAt == nil then autoRefreshFlushAt = now + autoRefreshIntervalSec end
			end

			attachAutoRefreshListeners = function(instance)
				if instance == nil then return end
				local ok, addedConn = pcall(function() return instance.DescendantAdded:Connect(markAutoRefreshDirty) end)
				if ok and addedConn ~= nil then table.insert(state.refreshConnections, addedConn) end
				local ok2, removingConn = pcall(function() return instance.DescendantRemoving:Connect(markAutoRefreshDirty) end)
				if ok2 and removingConn ~= nil then table.insert(state.refreshConnections, removingConn) end
			end

			detachAutoRefreshListeners = function()
				for _, conn in ipairs(state.refreshConnections) do pcall(conn.Disconnect, conn) end
				-- Clear in-place so the getgenv()._RBXDEV_BRIDGE.refreshConnections
				-- reference at the top of the file keeps pointing at a valid table.
				for i = #state.refreshConnections, 1, -1 do state.refreshConnections[i] = nil end
				autoRefreshHeartbeat = nil
				autoRefreshTopLevel = nil
			end

			autoRefreshHeartbeatTick = function()
				if not autoRefreshEnabled or not autoRefreshDirty then return end
				local now = os.clock()
				local force = autoRefreshFirstDirtyAt ~= nil and (now - autoRefreshFirstDirtyAt) >= MAX_COALESCE_SEC
				if autoRefreshFlushAt ~= nil and now < autoRefreshFlushAt and not force then return end

				-- Clear state BEFORE building: a DescendantAdded firing during
				-- serialisation must re-arm the next flush, not be lost.
				autoRefreshDirty = false
				autoRefreshFirstDirtyAt = nil
				autoRefreshFlushAt = nil

				if not state.connected then return end
				local ok, tree = pcall(M.getGameTree, nil, config.CONFIG.updateTreeDepth)
				if ok and state.connected then
					pcall(protocol.send, { type = 'gameTree', data = tree })
				end
			end

			M.setAutoRefresh = function(enabled, intervalMs)
				local newEnabled = enabled == true
				local rawInterval = tonumber(intervalMs) or 5000
				local newIntervalSec = math.max(MIN_AUTO_REFRESH_INTERVAL_SEC, rawInterval / 1000)

				if newEnabled == autoRefreshEnabled and newIntervalSec == autoRefreshIntervalSec and newEnabled then
					return
				end

				detachAutoRefreshListeners()
				autoRefreshDirty = false
				autoRefreshFirstDirtyAt = nil
				autoRefreshFlushAt = nil

				autoRefreshEnabled = newEnabled
				autoRefreshIntervalSec = newIntervalSec

				if not autoRefreshEnabled then return end

				for _, serviceName in ipairs(config.CONFIG.gameTreeServices) do
					local ok, svc = pcall(game.GetService, game, serviceName)
					if ok and svc ~= nil then attachAutoRefreshListeners(svc) end
				end

				-- Cover top-level children not in the standard allowlist: when a new
				-- top-level service/child appears, attach listeners and mark dirty.
				autoRefreshTopLevel = game.ChildAdded:Connect(function(child)
					attachAutoRefreshListeners(child)
					markAutoRefreshDirty()
				end)
				if autoRefreshTopLevel ~= nil then table.insert(state.refreshConnections, autoRefreshTopLevel) end

				autoRefreshHeartbeat = RunService.Heartbeat:Connect(autoRefreshHeartbeatTick)
				if autoRefreshHeartbeat ~= nil then table.insert(state.refreshConnections, autoRefreshHeartbeat) end
			end

			M.shutdownAutoRefresh = function()
				detachAutoRefreshListeners()
				autoRefreshEnabled = false
				autoRefreshDirty = false
				autoRefreshFirstDirtyAt = nil
				autoRefreshFlushAt = nil
			end

			return M

		end)(unpack(_vararg))
	end,
}

_modules["handlers/children.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
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

		end)(unpack(_vararg))
	end,
}

_modules["handlers/console.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local state = require("state")
			local protocol = require("protocol")

			local M = {}

			M.setupLogHooks = function()
				-- Prevent double-hooking on re-execution
				if getgenv and getgenv()._RBXDEV_LOG_HOOKED then return end

				local inHook = false

				local safeLog = function(level, ...)
					if inHook or not state.connected then return end
					inHook = true

					local args = { ... }
					local parts = {}
					for i = 1, select('#', ...) do parts[i] = tostring(args[i]) end

					pcall(protocol.send, {
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

			return M

		end)(unpack(_vararg))
	end,
}

_modules["handlers/execute.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local protocol = require("protocol")

			local M = {}

			M.handleExecute = function(message)
				local fn, loadError = loadstring(message.code)
				if fn == nil then
					protocol.sendResult('executeResult', message.id, false, { error = protocol.parseError(tostring(loadError)) })
					return
				end

				local ok, result = pcall(fn)
				if not ok then
					protocol.sendResult('executeResult', message.id, false, { error = protocol.parseError(tostring(result)) })
					return
				end

				protocol.sendResult('executeResult', message.id, true, { result = result ~= nil and tostring(result) or nil })
			end

			return M

		end)(unpack(_vararg))
	end,
}

_modules["handlers/instances.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local protocol = require("protocol")

			local M = {}

			M.handleCreateInstance = function(message)
				local parent = protocol.resolveInstancePath(message.parentPath)
				if parent == nil then
					protocol.sendResult('createInstanceResult', message.id, false, { error = 'Parent not found at: ' .. table.concat(message.parentPath, '.') })
					return
				end

				local ok, result = pcall(function()
					local inst = Instance.new(message.className)
					if message.name ~= nil then inst.Name = message.name end
					inst.Parent = parent
					return inst.Name
				end)

				if not ok then
					protocol.sendResult('createInstanceResult', message.id, false, { error = tostring(result) })
					return
				end

				protocol.sendResult('createInstanceResult', message.id, true, { instanceName = result })
			end

			M.handleCloneInstance = function(message)
				local instance = protocol.resolveInstancePath(message.path)
				if instance == nil then
					protocol.sendResult('cloneInstanceResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
					return
				end

				local ok, result = pcall(function()
					local clone = instance:Clone()
					if clone == nil then error('Instance cannot be cloned') end
					clone.Parent = instance.Parent
					return clone.Name
				end)

				if not ok then
					protocol.sendResult('cloneInstanceResult', message.id, false, { error = tostring(result) })
					return
				end

				protocol.sendResult('cloneInstanceResult', message.id, true, { cloneName = result })
			end

			M.handleDeleteInstance = function(message)
				local instance = protocol.resolveInstancePath(message.path)
				if instance == nil then
					protocol.sendResult('deleteInstanceResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
					return
				end

				local ok, err = pcall(instance.Destroy, instance)
				if not ok then
					protocol.sendResult('deleteInstanceResult', message.id, false, { error = tostring(err) })
					return
				end

				protocol.sendResult('deleteInstanceResult', message.id, true)
			end

			M.handleReparentInstance = function(message)
				local source = protocol.resolveInstancePath(message.sourcePath)
				if source == nil then
					protocol.sendResult('reparentInstanceResult', message.id, false, { error = 'Source not found at: ' .. table.concat(message.sourcePath, '.') })
					return
				end

				local target = protocol.resolveInstancePath(message.targetPath)
				if target == nil then
					protocol.sendResult('reparentInstanceResult', message.id, false, { error = 'Target not found at: ' .. table.concat(message.targetPath, '.') })
					return
				end

				local ok, err = pcall(function() source.Parent = target end)
				if not ok then
					protocol.sendResult('reparentInstanceResult', message.id, false, { error = tostring(err) })
					return
				end

				protocol.sendResult('reparentInstanceResult', message.id, true)
			end

			return M

		end)(unpack(_vararg))
	end,
}

_modules["handlers/moduleInterface.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local protocol = require("protocol")
			local moduleReflect = require("moduleReflect")

			local M = {}

			M.handleRequestModuleInterface = function(message)
				local moduleRef = message.moduleRef
				local module = nil

				if moduleRef.kind == 'path' then
					local instance = protocol.resolveInstancePath(moduleRef.path)
					if instance == nil then
						protocol.sendResult('moduleInterface', message.id, false, { error = 'Module not found at: ' .. table.concat(moduleRef.path, '.') })
						return
					end
					if not instance:IsA'ModuleScript' then
						protocol.sendResult('moduleInterface', message.id, false, { error = 'Instance is not a ModuleScript' })
						return
					end
					local ok, result = pcall(require, instance)
					if not ok then
						protocol.sendResult('moduleInterface', message.id, false, { error = tostring(result) })
						return
					end
					module = result
				elseif moduleRef.kind == 'assetId' then
					local ok, result = pcall(require, moduleRef.id)
					if not ok then
						protocol.sendResult('moduleInterface', message.id, false, { error = tostring(result) })
						return
					end
					module = result
				end

				if module == nil then
					protocol.sendResult('moduleInterface', message.id, false, { error = 'Failed to load module' })
					return
				end

				protocol.sendResult('moduleInterface', message.id, true, { interface = moduleReflect.reflectModuleInterface(module) })
			end

			return M

		end)(unpack(_vararg))
	end,
}

_modules["handlers/properties.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local config = require("config")
			local protocol = require("protocol")

			local M = {}

			M.handleRequestProperties = function(message)
				local instance = protocol.resolveInstancePath(message.path)
				if instance == nil then
					protocol.sendResult('propertiesResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
					return
				end
				protocol.sendResult('propertiesResult', message.id, true, { properties = protocol.getInstanceProperties(instance, message.properties, config) })
			end

			M.handleSetProperty = function(message)
				local instance = protocol.resolveInstancePath(message.path)
				if instance == nil then
					protocol.sendResult('setPropertyResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
					return
				end

				local ok, err = pcall(function() instance[message.property] = protocol.parseValue(message.value, message.valueType) end)
				if not ok then
					protocol.sendResult('setPropertyResult', message.id, false, { error = tostring(err) })
					return
				end

				protocol.sendResult('setPropertyResult', message.id, true)
			end

			return M

		end)(unpack(_vararg))
	end,
}

_modules["handlers/remoteSpy.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local state = require("state")
			local protocol = require("protocol")

			local M = {}

			local shouldCaptureCaller = function()
				if type(checkcaller) ~= 'function' then return true end
				local ok, isExecutorCaller = pcall(checkcaller)
				return not (ok and isExecutorCaller == true)
			end

			local hasAnyHookStrategy = function()
				if type(hookmetamethod) == 'function' then return true end
				if type(hookfunction) == 'function' then return true end
				return false
			end

			local getNamecallMethodSafe = function()
				if type(getnamecallmethod) ~= 'function' then return nil end
				local ok, method = pcall(getnamecallmethod)
				if not ok or type(method) ~= 'string' then return nil end
				return method
			end

			local restoreNamecallMethodSafe = function(method)
				if type(setnamecallmethod) ~= 'function' then return end
				if type(method) ~= 'string' then return end
				pcall(setnamecallmethod, method)
			end

			local createNamecallProxy = function(logRemoteCall)
				local oldNamecall = nil
				local proxy = function(self, ...)
					local method = getNamecallMethodSafe()
					if shouldCaptureCaller() and (method == 'FireServer' or method == 'InvokeServer') then
						local blocked, remoteName, remotePath = protocol.getRemoteBlockState(self)
						logRemoteCall(self, method, blocked, remoteName, remotePath, ...)
						if blocked then
							restoreNamecallMethodSafe(method)
							return nil
						end
					end

					restoreNamecallMethodSafe(method)
					if oldNamecall == nil then return nil end
					return oldNamecall(self, ...)
				end

				local bindOriginal = function(original)
					oldNamecall = original
				end

				return proxy, bindOriginal
			end

			local createMethodProxy = function(method, logRemoteCall)
				local oldMethod = nil
				local proxy = function(self, ...)
					if shouldCaptureCaller() and typeof(self) == 'Instance' then
						local className = self.ClassName
						local isMatchingRemote =
							(method == 'FireServer' and (className == 'RemoteEvent' or className == 'UnreliableRemoteEvent'))
							or (method == 'InvokeServer' and className == 'RemoteFunction')

						if isMatchingRemote then
							local blocked, remoteName, remotePath = protocol.getRemoteBlockState(self)
							logRemoteCall(self, method, blocked, remoteName, remotePath, ...)
							if blocked then return nil end
						end
					end

					if oldMethod == nil then return nil end
					return oldMethod(self, ...)
				end

				local bindOriginal = function(original)
					oldMethod = original
				end

				return proxy, bindOriginal
			end

			local getRemoteMethod = function(className, method)
				local okInstance, instance = pcall(Instance.new, className)
				if not okInstance or typeof(instance) ~= 'Instance' then
					return nil, className .. ' unavailable'
				end

				local okMethod, target = pcall(function()
					return instance[method]
				end)
				pcall(function()
					instance:Destroy()
				end)

				if not okMethod or type(target) ~= 'function' then
					return nil, className .. '.' .. method .. ' unavailable'
				end

				return target
			end

			local installWithHookMetamethod = function(logRemoteCall)
				if type(hookmetamethod) ~= 'function' then
					return nil, 'hookmetamethod unavailable'
				end

				local proxy, bindOriginal = createNamecallProxy(logRemoteCall)
				if type(newcclosure) == 'function' then
					proxy = newcclosure(proxy)
				end

				local oldNamecall = hookmetamethod(game, '__namecall', proxy)
				if type(oldNamecall) ~= 'function' then
					return nil, 'hookmetamethod did not return a callable original'
				end
				bindOriginal(oldNamecall)

				return function()
					pcall(hookmetamethod, game, '__namecall', oldNamecall)
				end, 'hookmetamethod'
			end

			local installWithMethodHooks = function(logRemoteCall)
				if type(hookfunction) ~= 'function' then
					return nil, 'hookfunction unavailable for method hooks'
				end

				local installed = {}
				local errors = {}

				local cleanup = function()
					for i = #installed, 1, -1 do
						local hook = installed[i]
						pcall(hookfunction, hook.target, hook.original)
					end
				end

				local installMethod = function(className, method)
					local target, targetError = getRemoteMethod(className, method)
					if target == nil then
						table.insert(errors, targetError)
						return
					end

					local proxy, bindOriginal = createMethodProxy(method, logRemoteCall)
					if type(newcclosure) == 'function' then
						local okClosure, cclosure = pcall(newcclosure, proxy)
						if okClosure and type(cclosure) == 'function' then
							proxy = cclosure
						end
					end

					local okHook, oldMethod = pcall(hookfunction, target, proxy)
					if not okHook then
						table.insert(errors, className .. '.' .. method .. ' hook failed: ' .. tostring(oldMethod))
						return
					end
					if type(oldMethod) ~= 'function' then
						table.insert(errors, className .. '.' .. method .. ' hook did not return a callable original')
						return
					end

					bindOriginal(oldMethod)
					table.insert(installed, { target = target, original = oldMethod })
				end

				installMethod('RemoteEvent', 'FireServer')
				installMethod('UnreliableRemoteEvent', 'FireServer')
				installMethod('RemoteFunction', 'InvokeServer')

				if #installed == 0 then
					cleanup()
					return nil, table.concat(errors, '; ')
				end

				return cleanup, 'method hooks'
			end

			local installWithHookfunction = function(logRemoteCall)
				if type(hookfunction) ~= 'function' then
					return nil, 'hookfunction unavailable'
				end
				if type(getrawmetatable) ~= 'function' then
					return nil, 'getrawmetatable unavailable'
				end

				local mt = getrawmetatable(game)
				if type(mt) ~= 'table' then
					return nil, 'raw metatable unavailable'
				end

				local ncFunc = rawget(mt, '__namecall')
				if type(ncFunc) ~= 'function' then
					return nil, '__namecall missing from raw metatable'
				end

				local proxy, bindOriginal = createNamecallProxy(logRemoteCall)
				if type(newcclosure) == 'function' then
					proxy = newcclosure(proxy)
				end

				local oldNamecall = hookfunction(ncFunc, proxy)
				if type(oldNamecall) ~= 'function' then
					return nil, 'hookfunction did not return a callable original'
				end
				bindOriginal(oldNamecall)

				return function()
					pcall(hookfunction, ncFunc, oldNamecall)
				end, 'hookfunction'
			end

			local installNamecallHook = function(logRemoteCall)
				local errors = {}
				local strategies = {
					installWithHookMetamethod,
					installWithMethodHooks,
					installWithHookfunction,
				}

				for _, installer in ipairs(strategies) do
					local ok, cleanup, strategyOrError = pcall(installer, logRemoteCall)
					if ok and type(cleanup) == 'function' then
						return cleanup, strategyOrError
					end
					if ok then
						table.insert(errors, tostring(strategyOrError))
					else
						table.insert(errors, tostring(cleanup))
					end
				end

				return nil, table.concat(errors, '; ')
			end

			M.handleSetRemoteSpyEnabled = function(message)
				if not hasAnyHookStrategy() then
					protocol.sendResult('setRemoteSpyEnabledResult', message.id, false, { error = 'No hooking method available in this executor' })
					return
				end

				local ok, err = pcall(function()
					if message.enabled and not state.remoteSpyEnabled then
						local logRemoteCall = function(self, method, blocked, remoteName, remotePath, ...)
							local args = { ... }
							pcall(function()
								if not state.remoteSpyEnabled or not state.connected then return end
								if typeof(self) ~= 'Instance' then return end

								local className = self.ClassName
								if className ~= 'RemoteEvent' and className ~= 'RemoteFunction' and className ~= 'UnreliableRemoteEvent' then return end

								if blocked ~= true and state.remoteSpyFilter ~= '' and remoteName:lower():find(state.remoteSpyFilter:lower()) == nil then return end

								protocol.send({
									type = 'remoteSpy',
									call = {
										remoteName = remoteName,
										remotePath = remotePath,
										remoteType = className,
										method = method,
										arguments = protocol.serializeArguments(unpack(args)),
										code = protocol.generateRemoteCode(self, method, unpack(args)),
										timestamp = os.time(),
										_blocked = blocked == true,
									},
								})
							end)
						end

						local cleanup, strategyOrError = installNamecallHook(logRemoteCall)
						if cleanup == nil then
							error('Failed to install remote spy hook: ' .. tostring(strategyOrError))
						end

						state.spyCleanup = cleanup
						if getgenv and getgenv()._RBXDEV_BRIDGE then
							getgenv()._RBXDEV_BRIDGE.spyCleanup = cleanup
						end
						print('[rbxdev-bridge] Remote spy enabled (' .. tostring(strategyOrError) .. ')')

						state.remoteSpyEnabled = true

					elseif not message.enabled and state.remoteSpyEnabled then
						if state.spyCleanup ~= nil then
							pcall(state.spyCleanup)
							state.spyCleanup = nil
							if getgenv and getgenv()._RBXDEV_BRIDGE then
								getgenv()._RBXDEV_BRIDGE.spyCleanup = nil
							end
						end
						state.remoteSpyEnabled = false
						print'[rbxdev-bridge] Remote spy disabled'
					end
				end)

				if not ok then
					protocol.sendResult('setRemoteSpyEnabledResult', message.id, false, { error = tostring(err) })
					return
				end

				protocol.sendResult('setRemoteSpyEnabledResult', message.id, true, { enabled = state.remoteSpyEnabled })
			end

			M.handleSetRemoteSpyFilter = function(message)
				state.remoteSpyFilter = message.filter or ''
				protocol.sendResult('setRemoteSpyFilterResult', message.id, true)
			end

			M.handleSetRemoteSpyBlockList = function(message)
				protocol.rebuildRemoteSpyBlockMaps(message.blocks)
				protocol.sendResult('setRemoteSpyBlockListResult', message.id, true)
			end

			return M

		end)(unpack(_vararg))
	end,
}

_modules["handlers/scriptSource.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local protocol = require("protocol")

			local M = {}

			M.handleRequestScriptSource = function(message)
				local instance = protocol.resolveInstancePath(message.path)
				if instance == nil then
					protocol.sendResult('scriptSourceResult', message.id, false, { error = 'Instance not found at: ' .. table.concat(message.path, '.') })
					return
				end

				if not (instance:IsA'LocalScript' or instance:IsA'ModuleScript' or instance:IsA'Script') then
					protocol.sendResult('scriptSourceResult', message.id, false, { error = instance.ClassName .. ' is not a script type' })
					return
				end

				local decompilerFunc = decompile or decompilescript or getscriptsource or getsourcescript or get_script_source or nil
				if decompilerFunc == nil then
					protocol.sendResult('scriptSourceResult', message.id, false, { error = 'No decompiler available in this executor' })
					return
				end

				local ok, source = pcall(decompilerFunc, instance)
				if not ok then
					protocol.sendResult('scriptSourceResult', message.id, false, { error = 'Decompilation failed: ' .. tostring(source) })
					return
				end

				protocol.sendResult('scriptSourceResult', message.id, true, { source = source, scriptType = instance.ClassName })
			end

			return M

		end)(unpack(_vararg))
	end,
}

_modules["handlers/teleport.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
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

		end)(unpack(_vararg))
	end,
}

_modules["init.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local config = require("config")
			local executor = require("executor")
			local state = require("state")
			local protocol = require("protocol")
			local gameTree = require("gameTree")

			local executeHandler = require("handlers/execute")
			local propertiesHandler = require("handlers/properties")
			local instancesHandler = require("handlers/instances")
			local scriptSourceHandler = require("handlers/scriptSource")
			local teleportHandler = require("handlers/teleport")
			local childrenHandler = require("handlers/children")
			local remoteSpyHandler = require("handlers/remoteSpy")
			local consoleHandler = require("handlers/console")
			local moduleInterfaceHandler = require("handlers/moduleInterface")

			-- Cleanup previous bridge instance
			if getgenv and getgenv()._RBXDEV_BRIDGE then
				local old = getgenv()._RBXDEV_BRIDGE
				if old.connection then pcall(old.connection.Close, old.connection) end
				for _, conn in ipairs(old.refreshConnections or {}) do pcall(conn.Disconnect, conn) end
				if old.spyCleanup ~= nil then
					pcall(old.spyCleanup)
					old.spyCleanup = nil
				end
				old.alive = false
			end

			-- Apply user config from varargs
			local userConfig = (...) or {}
			config.applyUserConfig(userConfig)

			-- Initialize reconnect delay from config
			state.reconnectAttemptDelay = config.CONFIG.reconnectDelay

			-- Register this bridge instance globally for cleanup on re-execution
			state.registerGlobal()

			-- Bail out if no WebSocket implementation is available
			if executor.WebSocket == nil then return end

			-- Message handler dispatch table
			local MESSAGE_HANDLERS = {}

			MESSAGE_HANDLERS.execute = executeHandler.handleExecute

			MESSAGE_HANDLERS.requestGameTree = function(message)
				local depth = message.depth or config.CONFIG.updateTreeDepth
				protocol.send{ type = 'gameTree', data = gameTree.getGameTree(message.services, depth) }
			end

			MESSAGE_HANDLERS.setAutoRefresh = function(message)
				gameTree.setAutoRefresh(message.enabled, message.intervalMs)
			end

			MESSAGE_HANDLERS.requestChildren = childrenHandler.handleRequestChildren
			MESSAGE_HANDLERS.requestProperties = propertiesHandler.handleRequestProperties
			MESSAGE_HANDLERS.requestModuleInterface = moduleInterfaceHandler.handleRequestModuleInterface
			MESSAGE_HANDLERS.setProperty = propertiesHandler.handleSetProperty
			MESSAGE_HANDLERS.teleportTo = teleportHandler.handleTeleportTo
			MESSAGE_HANDLERS.deleteInstance = instancesHandler.handleDeleteInstance
			MESSAGE_HANDLERS.reparentInstance = instancesHandler.handleReparentInstance
			MESSAGE_HANDLERS.requestScriptSource = scriptSourceHandler.handleRequestScriptSource
			MESSAGE_HANDLERS.createInstance = instancesHandler.handleCreateInstance
			MESSAGE_HANDLERS.cloneInstance = instancesHandler.handleCloneInstance
			MESSAGE_HANDLERS.setRemoteSpyEnabled = remoteSpyHandler.handleSetRemoteSpyEnabled
			MESSAGE_HANDLERS.setRemoteSpyFilter = remoteSpyHandler.handleSetRemoteSpyFilter
			MESSAGE_HANDLERS.setRemoteSpyBlockList = remoteSpyHandler.handleSetRemoteSpyBlockList

			local handleMessage = function(rawMessage)
				local message = protocol.jsonDecode(rawMessage)
				if message == nil then return end
				local handler = MESSAGE_HANDLERS[message.type]
				if handler == nil then return end
				handler(message)
			end

			-- Connection logic
			local connect
			local scheduleReconnect

			scheduleReconnect = function()
				if state.reconnectScheduled or state.connected or not state.isBridgeAlive() then return end

				state.reconnectScheduled = true
				local delay = math.max(0, state.reconnectAttemptDelay or config.CONFIG.reconnectDelay or 0)

				task.delay(delay, function()
					state.reconnectScheduled = false

					if state.connected or not state.isBridgeAlive() then return end

					local connectState = connect(false)
					if connectState == 'connected' then
						state.reconnectAttemptDelay = config.CONFIG.reconnectDelay
						return
					end
					if connectState == 'blocked' then
						scheduleReconnect()
						return
					end

					local nextDelay = state.reconnectAttemptDelay
					if nextDelay == nil or nextDelay <= 0 then
						nextDelay = config.CONFIG.reconnectDelay
					elseif nextDelay < config.CONFIG.reconnectDelayMax then
						nextDelay = math.min(nextDelay * 2, config.CONFIG.reconnectDelayMax)
					end

					state.reconnectAttemptDelay = nextDelay
					scheduleReconnect()
				end)
			end

			connect = function(scheduleOnFailure)
				if not state.isBridgeAlive() then return false end
				if scheduleOnFailure == nil then scheduleOnFailure = true end
				if not protocol.canAttemptConnect(config.CONFIG, executor.HttpRequest) then
					if scheduleOnFailure then
						scheduleReconnect()
					end
					return 'blocked'
				end

				local ok, ws = pcall(executor.WebSocket.connect, config.CONFIG.host)
				if not ok or ws == nil then
					if scheduleOnFailure then
						scheduleReconnect()
					end
					return 'failed'
				end

				state.connection = ws
				state.connected = true
				state.reconnectScheduled = false
				state.reconnectAttemptDelay = config.CONFIG.reconnectDelay
				state.healthProbeFailures = 0

				if getgenv and getgenv()._RBXDEV_BRIDGE then
					getgenv()._RBXDEV_BRIDGE.connection = ws
				end

				protocol.send{ type = 'connected', executorName = executor.name, version = executor.version }
				protocol.send{ type = 'gameTree', data = gameTree.getGameTree(nil, config.CONFIG.firstConnectDepth) }

				ws.OnMessage:Connect(handleMessage)

				ws.OnClose:Connect(function()
					state.connected = false
					state.connection = nil
					gameTree.shutdownAutoRefresh()
					scheduleReconnect()
				end)

				return 'connected'
			end

			task.defer(connect)
			consoleHandler.setupLogHooks()

		end)(unpack(_vararg))
	end,
}

_modules["moduleReflect.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local M = {}

			M.reflectModuleInterface = function(module)
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

			return M

		end)(unpack(_vararg))
	end,
}

_modules["protocol.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local HttpService = game:GetService'HttpService'

			local state = require("state")

			local M = {}

			M.VALUE_SERIALIZERS = {
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

			M.VALUE_PARSERS = {
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

			M.jsonEncode = function(data)
				return HttpService:JSONEncode(data)
			end

			M.jsonDecode = function(data)
				local success, result = pcall(HttpService.JSONDecode, HttpService, data)
				if not success then return nil end
				return result
			end

			M.resolveInstancePath = function(path)
				local instance = game
				for _, segment in ipairs(path) do
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

			M.getInstancePath = function(instance)
				local path = {}
				local current = instance
				while current ~= nil and current ~= game do
					table.insert(path, 1, current.Name)
					current = current.Parent
				end
				return path
			end

			M.instanceToPath = function(instance)
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

			M.send = function(data)
				if state.connection == nil or not state.connected then return end
				state.connection:Send(M.jsonEncode(data))
			end

			M.sendResult = function(messageType, id, success, payload)
				local result = { type = messageType, id = id, success = success }
				for k, v in pairs(payload or {}) do result[k] = v end
				M.send(result)
			end

			M.getHealthUrl = function(config)
				if type(config.healthUrl) == 'string' and config.healthUrl ~= '' then
					return config.healthUrl
				end

				local base = config.host:gsub('^wss://', 'https://'):gsub('^ws://', 'http://')
				local origin = base:match'^(https?://[^/]+)'
				if origin == nil then return nil end
				return origin .. '/health'
			end

			M.canAttemptConnect = function(config, HttpRequest)
				if config.enableHealthProbe == false or HttpRequest == nil then
					return true
				end

				local healthUrl = M.getHealthUrl(config)
				if healthUrl == nil then
					return true
				end

				local ok, response = pcall(HttpRequest, {
					Url = healthUrl,
					Method = 'GET',
					Headers = {
						['Cache-Control'] = 'no-cache',
					},
				})

				if not ok or type(response) ~= 'table' then
					state.healthProbeFailures = state.healthProbeFailures + 1
					return state.healthProbeFailures % 3 == 0
				end

				local statusCode = response.StatusCode or response.Status or response.status_code
				if statusCode == 200 then
					state.healthProbeFailures = 0
					return true
				end

				state.healthProbeFailures = state.healthProbeFailures + 1
				return state.healthProbeFailures % 3 == 0
			end

			M.valueToLua = nil
			M.tableToLua = nil

			M.valueToLua = function(v, depth, seen)
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

				if t == 'Instance' then return M.instanceToPath(v) end
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
				if t == 'table'       then return M.tableToLua(v, depth, seen) end
				if t == 'function'    then return 'function() end' end
				if t == 'thread'      then return 'nil' end

				local ok, str = pcall(tostring, v)
				if ok then return 'nil --[[' .. t .. ': ' .. str .. ']]' end
				return 'nil --[[' .. t .. ']]'
			end

			M.tableToLua = function(t, depth, seen)
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
						table.insert(parts, indent .. M.valueToLua(t[i], depth + 1, seen))
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
						keyStr = '[' .. M.valueToLua(k, depth + 1, seen) .. ']'
					end
					table.insert(parts, indent .. keyStr .. ' = ' .. M.valueToLua(v, depth + 1, seen))
				end

				seen[t] = nil

				if #parts == 0 then return '{}' end
				return '{\n' .. table.concat(parts, ',\n') .. '\n' .. closingIndent .. '}'
			end

			M.getDefaultProperties = function(className, config)
				local props = config.DEFAULT_PROPERTIES[className]
				if props ~= nil then return props end
				for _, entry in ipairs(config.CLASS_PATTERNS) do
					if className:find(entry.pattern) ~= nil then return entry.props end
				end
				return { 'Name', 'ClassName' }
			end

			M.serializePropertyValue = function(name, value)
				if value == nil then return { name = name, value = 'nil', valueType = 'nil' } end

				local valueType = typeof(value)
				local serializer = M.VALUE_SERIALIZERS[valueType]
				if serializer == nil then
					return { name = name, value = tostring(value), valueType = 'other' }
				end

				local serializedValue, typeName, className = serializer(value)
				local result = { name = name, value = serializedValue, valueType = typeName }
				if className ~= nil then result.className = className end
				return result
			end

			M.parseValue = function(value, valueType)
				local parser = M.VALUE_PARSERS[valueType]
				if parser == nil then return value end
				return parser(value)
			end

			M.parseError = function(errorString)
				local file, line, message = errorString:match'(%S+):(%d+): (.+)'
				return {
					message = message or errorString,
					file = file,
					line = line and tonumber(line) or nil,
				}
			end

			M.getInstanceProperties = function(instance, requestedProps, config)
				local props = {}
				local propsToGet = requestedProps or M.getDefaultProperties(instance.ClassName, config)
				for _, propName in ipairs(propsToGet) do
					local ok, value = pcall(function() return instance[propName] end)
					if ok then table.insert(props, M.serializePropertyValue(propName, value)) end
				end
				return props
			end

			M.generateRemoteCode = function(remote, method, ...)
				local args = { ... }
				local numArgs = select('#', ...)
				local remotePath = M.instanceToPath(remote)

				if numArgs == 0 then
					return remotePath .. ':' .. method .. '()'
				end

				local argParts = {}
				local hasComplexArgs = false
				for i = 1, numArgs do
					local t = typeof(args[i])
					if t == 'table' or t == 'CFrame' or t == 'NumberSequence' or t == 'ColorSequence' or t == 'TweenInfo' then
						hasComplexArgs = true
					end
					table.insert(argParts, M.valueToLua(args[i], hasComplexArgs and 1 or 0))
				end

				if not hasComplexArgs and numArgs <= 5 then
					return remotePath .. ':' .. method .. '(' .. table.concat(argParts, ', ') .. ')'
				end

				local indented = {}
				for _, part in ipairs(argParts) do table.insert(indented, '    ' .. part) end
				return remotePath .. ':' .. method .. '(\n' .. table.concat(indented, ',\n') .. '\n)'
			end

			M.serializeArguments = function(...)
				local args = { ... }
				local parts = {}
				for i = 1, select('#', ...) do table.insert(parts, M.valueToLua(args[i])) end
				return table.concat(parts, ', ')
			end

			M.rebuildRemoteSpyBlockMaps = function(blocks)
				state.remoteSpyBlockedNames = {}
				state.remoteSpyBlockedPaths = {}

				if type(blocks) ~= 'table' then return end

				for _, entry in ipairs(blocks) do
					if type(entry) ~= 'table' then continue end
					if type(entry.type) ~= 'string' or type(entry.value) ~= 'string' then continue end

					if entry.type == 'name' then
						state.remoteSpyBlockedNames[entry.value] = true
					elseif entry.type == 'path' then
						state.remoteSpyBlockedPaths[entry.value] = true
					end
				end
			end

			M.getRemoteBlockState = function(remote)
				if typeof(remote) ~= 'Instance' then
					return false, '', {}
				end
				local remotePath = M.getInstancePath(remote)
				local remotePathString = table.concat(remotePath, '.')
				local remoteName = remote.Name
				local blocked = state.remoteSpyBlockedNames[remoteName] == true or state.remoteSpyBlockedPaths[remotePathString] == true
				return blocked, remoteName, remotePath
			end

			return M

		end)(unpack(_vararg))
	end,
}

_modules["state.luau"] = {
	cached = false,
	value = nil,
	load = function()
		return (function(...)
			local M = {}

			M.BRIDGE_ID = tostring(math.random(1, 999999999))

			M.connection = nil
			M.connected = false
			M.refreshConnections = {}
			M.bridgeAlive = true
			M.reconnectScheduled = false
			M.reconnectAttemptDelay = nil -- set by init after config is loaded
			M.healthProbeFailures = 0

			M.remoteSpyEnabled = false
			M.remoteSpyFilter = ''
			M.remoteSpyBlockedNames = {}
			M.remoteSpyBlockedPaths = {}
			M.spyCleanup = nil

			M.registerGlobal = function()
				if getgenv then
					getgenv()._RBXDEV_BRIDGE = {
						id = M.BRIDGE_ID,
						connection = nil,
						refreshConnections = M.refreshConnections,
						spyCleanup = nil,
						alive = true,
					}
				end
			end

			M.isBridgeAlive = function()
				if getgenv == nil then return M.bridgeAlive end
				local bridge = getgenv()._RBXDEV_BRIDGE
				return bridge ~= nil and bridge.id == M.BRIDGE_ID and bridge.alive
			end

			return M

		end)(unpack(_vararg))
	end,
}

_modules["config"] = _modules["config.luau"]
_modules["executor"] = _modules["executor.luau"]
_modules["gameTree"] = _modules["gameTree.luau"]
_modules["handlers/children"] = _modules["handlers/children.luau"]
_modules["handlers/console"] = _modules["handlers/console.luau"]
_modules["handlers/execute"] = _modules["handlers/execute.luau"]
_modules["handlers/instances"] = _modules["handlers/instances.luau"]
_modules["handlers/moduleInterface"] = _modules["handlers/moduleInterface.luau"]
_modules["handlers/properties"] = _modules["handlers/properties.luau"]
_modules["handlers/remoteSpy"] = _modules["handlers/remoteSpy.luau"]
_modules["handlers/scriptSource"] = _modules["handlers/scriptSource.luau"]
_modules["handlers/teleport"] = _modules["handlers/teleport.luau"]
_modules["init"] = _modules["init.luau"]
_modules["moduleReflect"] = _modules["moduleReflect.luau"]
_modules["protocol"] = _modules["protocol.luau"]
_modules["state"] = _modules["state.luau"]

return require("init")
end)(require or function() end, ...)