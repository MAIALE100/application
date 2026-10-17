local editorDui = nil
local editorTextureDict = nil
local editorTextureName = "puriphoto_editor"
local editorVisible = false

local function ensureEditorDui()
    if editorDui then return true end

    local url = ("https://cfx-nui-%s/editor/index.html"):format(GetCurrentResourceName())
    print(("[PuriPhoto] Creating standalone editor DUI: %s"):format(url))
    editorDui = CreateDui(url, 1280, 720)
    if not editorDui then
        print("[PuriPhoto] Failed to create standalone editor DUI")
        return false
    end

    local handle = GetDuiHandle(editorDui)
    editorTextureDict = CreateRuntimeTxd("puriphoto_editor_txd")
    CreateRuntimeTextureFromDuiHandle(editorTextureDict, editorTextureName, handle)
    return true
end

local function showEditor(photoUrl)
    if type(photoUrl) ~= "string" or photoUrl == "" then return end
    if not ensureEditorDui() then return end

    editorVisible = true
    print("[PuriPhoto] Standalone editor requested")
    SetTimeout(500, function()
        if not editorDui then return end
        SendDuiMessage(editorDui, json.encode({
            action = "puriphoto:showStandaloneEditor",
            photoUrl = photoUrl
        }))
    end)
    SendDuiMessage(editorDui, json.encode({
        action = "puriphoto:showStandaloneEditor",
        photoUrl = photoUrl
    }))
end

local function hideEditor()
    editorVisible = false
    if editorDui then
        SendDuiMessage(editorDui, json.encode({
            action = "puriphoto:hideStandaloneEditor"
        }))
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
        if editorVisible and editorDui and editorTextureDict then
            -- Draw only the center workspace. LB Phone remains untouched on the right.
            DrawSprite("puriphoto_editor_txd", editorTextureName, 0.38, 0.50, 0.70, 1.00, 0.0, 255, 255, 255, 255)
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
