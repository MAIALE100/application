local editorDui = nil
local editorTextureDictName = "puriphoto_editor_txd"
local editorTextureName = "puriphoto_editor"
local editorVisible = false
local pendingPhotoUrl = nil
local duiGeneration = 0

local function sendPhoto()
    if not editorDui or not pendingPhotoUrl then return end
    SendDuiMessage(editorDui, json.encode({
        action = "puriphoto:showStandaloneEditor",
        photoUrl = pendingPhotoUrl
    }))
end

local function destroyEditorDui()
    if editorDui then
        DestroyDui(editorDui)
        editorDui = nil
    end
end

local function ensureEditorDui()
    if editorDui then return true end

    duiGeneration = duiGeneration + 1
    local generation = duiGeneration
    local url = ("https://cfx-nui-%s/editor/index.html?v=%d"):format(GetCurrentResourceName(), generation)
    print(("[PuriPhoto] Creating standalone editor DUI: %s"):format(url))

    editorDui = CreateDui(url, 1280, 720)
    if not editorDui then
        print("[PuriPhoto] ERROR: CreateDui returned nil")
        return false
    end

    local handle = GetDuiHandle(editorDui)
    if not handle or handle == "" then
        print("[PuriPhoto] ERROR: GetDuiHandle returned an empty handle")
        destroyEditorDui()
        return false
    end

    local txd = CreateRuntimeTxd(editorTextureDictName)
    if not txd then
        print("[PuriPhoto] ERROR: CreateRuntimeTxd failed")
        destroyEditorDui()
        return false
    end

    local texture = CreateRuntimeTextureFromDuiHandle(txd, editorTextureName, handle)
    if not texture then
        print("[PuriPhoto] ERROR: CreateRuntimeTextureFromDuiHandle failed")
        destroyEditorDui()
        return false
    end

    print("[PuriPhoto] Standalone editor DUI texture created")
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

    -- The DUI document and its JS listener are asynchronous. Keep the initial
    -- message, then resend after the document has had time to initialize.
    sendPhoto()
    SetTimeout(300, sendPhoto)
    SetTimeout(1000, sendPhoto)
    SetTimeout(2000, sendPhoto)
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
            SetScriptGfxDrawOrder(7)
            SetScriptGfxDrawBehindPausemenu(false)

            -- Known-good native background. Keep it during this diagnostic so
            -- we can distinguish native draw failure from DUI texture failure.
            DrawRect(0.38, 0.50, 0.70, 1.00, 220, 30, 120, 90)

            -- Runtime TXDs are already resident; RequestStreamedTextureDict is
            -- for streamed game dictionaries and must not be used for this TXD.
            DrawSprite(editorTextureDictName, editorTextureName, 0.38, 0.50, 0.70, 1.00, 0.0, 255, 255, 255, 255)
            Wait(0)
        else
            Wait(250)
        end
    end
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end
    destroyEditorDui()
end)
