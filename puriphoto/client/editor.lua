local editorDui = nil
local editorTextureDictName = "puriphoto_editor_txd"
local editorTextureName = "puriphoto_editor"
local editorVisible = false
local editorReady = false
local pendingPhotoUrl = nil

local function sendPhoto()
    if not editorDui or not pendingPhotoUrl then return end
    SendDuiMessage(editorDui, json.encode({
        action = "puriphoto:showStandaloneEditor",
        photoUrl = pendingPhotoUrl
    }))
end

local function ensureEditorDui()
    if editorDui then return true end

    local url = ("https://cfx-nui-%s/editor/index.html"):format(GetCurrentResourceName())
    print(("[PuriPhoto] Creating standalone editor DUI: %s"):format(url))

    editorDui = CreateDui(url, 1280, 720)
    if not editorDui then
        print("[PuriPhoto] ERROR: CreateDui returned nil")
        return false
    end

    local handle = GetDuiHandle(editorDui)
    if not handle or handle == "" then
        print("[PuriPhoto] ERROR: GetDuiHandle returned an empty handle")
        DestroyDui(editorDui)
        editorDui = nil
        return false
    end

    local txd = CreateRuntimeTxd(editorTextureDictName)
    if not txd then
        print("[PuriPhoto] ERROR: CreateRuntimeTxd failed")
        DestroyDui(editorDui)
        editorDui = nil
        return false
    end

    local texture = CreateRuntimeTextureFromDuiHandle(txd, editorTextureName, handle)
    if not texture then
        print("[PuriPhoto] ERROR: CreateRuntimeTextureFromDuiHandle failed")
        DestroyDui(editorDui)
        editorDui = nil
        return false
    end

    print("[PuriPhoto] Standalone editor DUI texture created")
    RequestStreamedTextureDict(editorTextureDictName, false)
    return true
end

local function showEditor(photoUrl)
    if type(photoUrl) ~= "string" or photoUrl == "" then
        print("[PuriPhoto] ERROR: Standalone editor received no photo URL")
        return
    end

    pendingPhotoUrl = photoUrl
    if not ensureEditorDui() then return end

    editorVisible = true
    print("[PuriPhoto] Standalone editor requested")
    sendPhoto()

    -- DUI pages initialize asynchronously. Repeat while the page becomes ready.
    SetTimeout(250, sendPhoto)
    SetTimeout(750, sendPhoto)
    SetTimeout(1500, sendPhoto)
end

local function hideEditor()
    editorVisible = false
    pendingPhotoUrl = nil
    if editorDui then
        SendDuiMessage(editorDui, json.encode({ action = "puriphoto:hideStandaloneEditor" }))
    end
end

RegisterNUICallback("puriphoto:showStandaloneEditor", function(data, cb)
    showEditor(data and data.photoUrl)
    cb({ ok = true })
end)

RegisterNUICallback("puriphoto:hideStandaloneEditor", function(_, cb)
    hideEditor()
    cb({ ok = true })
end)

CreateThread(function()
    while true do
        if editorVisible and editorDui then
            -- Explicitly switch to the normal fullscreen frontend draw target.
            SetScriptGfxDrawOrder(7)
            SetScriptGfxDrawBehindPausemenu(false)
            DrawSprite(editorTextureDictName, editorTextureName, 0.38, 0.50, 0.70, 1.00, 0.0, 255, 255, 255, 255)
            Wait(0)
        else
            Wait(250)
        end
    end
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if editorDui then
        DestroyDui(editorDui)
        editorDui = nil
    end
end)
