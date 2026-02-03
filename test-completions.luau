--!strict
-- Test script for rbxdev-ls language server completions and type checking

-- ============================================================================
-- Standard Libraries (should NOT show "Unknown identifier")
-- ============================================================================

-- Task library
task.wait(1)
task.spawn(function() end)
task.defer(function() end)
task.delay(1, function() end)
task.cancel(coroutine.create(function() end))

-- Math library
local x = math.abs(-5)
local y = math.floor(3.7)
local z = math.random(1, 100)
local pi = math.pi

-- String library
local s = string.upper("hello")
local len = string.len("test")
local parts = string.split("a,b,c", ",")

-- Table library
local t = table.create(10)
table.insert(t, "value")
local cloned = table.clone(t)

-- Coroutine library
local co = coroutine.create(function() end)
local status = coroutine.status(co)

-- Bit32 library
local band = bit32.band(255, 128)
local bor = bit32.bor(1, 2)

-- UTF8 library
local codepoint = utf8.codepoint("A")

-- OS library
local clock = os.clock()
local osTime = os.time()

-- Buffer library
local buf = buffer.create(64)
buffer.writeu8(buf, 0, 255)

-- Debug library
debug.traceback()
debug.profilebegin("test")
debug.profileend()

-- ============================================================================
-- Global Functions (should NOT show "Unknown identifier")
-- ============================================================================

print("Hello")
warn("Warning")
local typ = type({})
local typof = typeof(Instance.new("Part"))
local str = tostring(123)
local num = tonumber("456")
local ok, err = pcall(function() end)
local ok2, err2 = xpcall(function() end, function(e) return e end)
local a, b, c = select(1, "a", "b", "c")
for k, v in pairs({a = 1}) do end
for i, v in ipairs({1, 2, 3}) do end
local key, val = next({a = 1})
local unpacked = unpack({1, 2, 3})

-- Roblox globals
wait(0.1)
delay(1, function() end)
spawn(function() end)
local t1 = tick()
local t2 = time()
local elapsed = elapsedTime()

-- ============================================================================
-- Roblox Services (GetService completions)
-- ============================================================================

-- Test GetService with parentheses
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local Lighting = game:GetService("Lighting")
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")
local HttpService = game:GetService("HttpService")
local CollectionService = game:GetService("CollectionService")
local DataStoreService = game:GetService("DataStoreService")

-- Test GetService with single quotes (no parens - Lua shorthand)
local Players2 = game:GetService'Players'
local RunService2 = game:GetService'RunService'

-- ============================================================================
-- Instance.new completions
-- ============================================================================

local part = Instance.new("Part")
local model = Instance.new("Model")
local folder = Instance.new("Folder")
local sound = Instance.new("Sound")
local remoteEvent = Instance.new("RemoteEvent")
local screenGui = Instance.new("ScreenGui")
local frame = Instance.new("Frame")
local textLabel = Instance.new("TextLabel")
local animation = Instance.new("Animation")

-- Instance.new with single quotes
local part2 = Instance.new'Part'

-- ============================================================================
-- Chained member access (game.Players.PlayerAdded:Connect)
-- ============================================================================

-- Direct service access via game
game.Players.PlayerAdded:Connect(function(player)
    print("Player joined:", player.Name)

    player.CharacterAdded:Connect(function(character)
        local humanoid = character:WaitForChild("Humanoid")
        humanoid.Died:Connect(function()
            print("Player died")
        end)
    end)
end)

game.Players.PlayerRemoving:Connect(function(player)
    print("Player left:", player.Name)
end)

-- RunService events
game:GetService("RunService").Heartbeat:Connect(function(dt)
    -- Update loop
end)

game:GetService("RunService").RenderStepped:Connect(function(dt)
    -- Render loop (client only)
end)

-- ============================================================================
-- FindFirstChild / WaitForChild / IsA completions
-- ============================================================================

local workspace = game:GetService("Workspace")
local part3 = workspace:FindFirstChild("Baseplate")
local part4 = workspace:WaitForChild("SpawnLocation")
local humanoid = workspace:FindFirstChildOfClass("Humanoid")
local model2 = workspace:FindFirstChildWhichIsA("Model")

if part3 and part3:IsA("BasePart") then
    part3.Anchored = true
end

-- Chained WaitForChild/FindFirstChild - should show Instance completions
local chain1 = workspace:WaitForChild("CamperVan"):WaitForChild("AC6_FE_Sounds")
local chain2 = workspace:WaitForChild("Folder"):FindFirstChild("Part")
local chain3 = workspace:FindFirstChild("Model"):FindFirstChild("Part"):FindFirstChild("Decal")

-- After : should show Instance methods like WaitForChild, FindFirstChild, etc.
-- workspace:WaitForChild("X"):

-- ============================================================================
-- Enum completions
-- ============================================================================

local material = Enum.Material.Plastic
local partType = Enum.PartType.Block
local easingStyle = Enum.EasingStyle.Quad
local easingDirection = Enum.EasingDirection.Out
local keyCode = Enum.KeyCode.Space

-- ============================================================================
-- Sunc/Executor API (should NOT show "Unknown identifier")
-- ============================================================================

-- Closures
local isCaller = checkcaller()
local cloned = clonefunction(print)
local isC = iscclosure(print)
local isL = islclosure(function() end)
local isExec = isexecutorclosure(print)

-- Environment
local gc = getgc()
local genv = getgenv()
local renv = getrenv()
local reg = getreg()

-- Filesystem
local content = readfile("test.txt")
writefile("output.txt", "hello")
local exists = isfile("test.txt")
local isDir = isfolder("scripts")
makefolder("newfolder")
local files = listfiles("scripts")

-- Encoding
local encoded = base64encode("hello")
local decoded = base64decode(encoded)
local compressed = lz4compress("data")

-- Instances
local ref = cloneref(game)
local same = compareinstances(game, game)
local instances = getinstances()
local nilInstances = getnilinstances()
local hui = gethui()
fireclickdetector(Instance.new("ClickDetector"))
fireproximityprompt(Instance.new("ProximityPrompt"))

-- Scripts
local calling = getcallingscript()
local modules = getloadedmodules()
local running = getrunningscripts()
local scripts = getscripts()

-- Metatable
local mt = getrawmetatable({})
setrawmetatable({}, {})
local ro = isreadonly({})
setreadonly({}, true)
local method = getnamecallmethod()

-- Reflection
local hidden = gethiddenproperty(part, "Hidden")
sethiddenproperty(part, "Hidden", true)
local identity = getthreadidentity()
setthreadidentity(8)

-- Signals
firesignal(game.Players.PlayerAdded)
local connections = getconnections(game.Players.PlayerAdded)

-- Misc
local executor = identifyexecutor()
local response = request({Url = "https://example.com"})

-- ============================================================================
-- Semicolon support (should parse without errors)
-- ============================================================================

local a1 = 1;
local b1 = 2;
local c1 = 3;

local function test()
    local x = 1;
    local y = 2;
    return x + y;
end;

-- ============================================================================
-- Type annotations
-- ============================================================================

type MyType = {
    name: string,
    age: number,
    active: boolean,
}

local function greet(name: string): string
    return "Hello, " .. name
end

local function add(a: number, b: number): number
    return a + b
end

-- Function with this type (TypeScript style)
type MyClass = {
    value: number,
    getValue: (self: MyClass) -> number,
}

print("All tests completed!")
