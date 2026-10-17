local editorOpen = false

RegisterNUICallback("puriphoto:openEditor", function(data, cb)
    editorOpen = true
    SendNUIMessage({
        action = "puriphoto:openEditor",
        payload = data
    })
    cb({ ok = true })
end)

RegisterNUICallback("puriphoto:closeEditor", function(_, cb)
    editorOpen = false
    SendNUIMessage({ action = "puriphoto:closeEditor" })
    cb({ ok = true })
end)

RegisterNUICallback("puriphoto:editorState", function(data, cb)
    if editorOpen then
        SendNUIMessage({
            action = "puriphoto:editorState",
            payload = data
        })
    end
    cb({ ok = true })
end)

-- Do not call SetNuiFocus here. LB Phone owns the active NUI focus while the
-- custom app is open; taking it away can break typing/clicking in the phone.
AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end
    editorOpen = false
end)
