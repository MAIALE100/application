local editorVisible = false
local pendingPhotoUrl = nil

local function pushEditorState()
    SendNUIMessage({
        action = editorVisible and "puriphoto:showStandaloneEditor" or "puriphoto:hideStandaloneEditor",
        photoUrl = pendingPhotoUrl
    })
end

RegisterNUICallback("puriphoto:showStandaloneEditor", function(data, cb)
    local photoUrl = data and data.photoUrl
    if type(photoUrl) ~= "string" or photoUrl == "" then
        print("[PuriPhoto] ERROR: Standalone editor received no photo URL")
        cb({ ok = false })
        return
    end

    pendingPhotoUrl = photoUrl
    editorVisible = true
    print("[PuriPhoto] Fullscreen editor requested")
    pushEditorState()
    cb({ ok = true })
end)

RegisterNUICallback("puriphoto:hideStandaloneEditor", function(_, cb)
    editorVisible = false
    pendingPhotoUrl = nil
    pushEditorState()
    cb({ ok = true })
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end
    editorVisible = false
    pendingPhotoUrl = nil
end)
