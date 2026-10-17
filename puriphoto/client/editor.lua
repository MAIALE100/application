local editorOpen = false

local function setEditorOpen(open)
    editorOpen = open == true
    SetNuiFocus(editorOpen, editorOpen)
    SetNuiFocusKeepInput(false)
    SendNUIMessage({
        action = editorOpen and "puriphoto:openEditor" or "puriphoto:closeEditor"
    })
end

RegisterNUICallback("puriphoto:openEditor", function(_, cb)
    setEditorOpen(true)
    cb({ ok = true })
end)

RegisterNUICallback("puriphoto:closeEditor", function(_, cb)
    setEditorOpen(false)
    cb({ ok = true })
end)

RegisterNUICallback("puriphoto:editorState", function(data, cb)
    SendNUIMessage({
        action = "puriphoto:editorState",
        payload = data
    })
    cb({ ok = true })
end)

RegisterNUICallback("puriphoto:editorAction", function(data, cb)
    SendNUIMessage({
        action = "puriphoto:editorAction",
        payload = data
    })
    cb({ ok = true })
end)

CreateThread(function()
    while true do
        if editorOpen then
            DisableControlAction(0, 1, true)
            DisableControlAction(0, 2, true)
            DisableControlAction(0, 24, true)
            DisableControlAction(0, 25, true)
            DisableControlAction(0, 200, true)
            Wait(0)
        else
            Wait(500)
        end
    end
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if editorOpen then
        SetNuiFocus(false, false)
    end
end)
