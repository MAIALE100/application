local APP=Config.AppIdentifier
local function addApp()
 Wait(500)
 local ok,err=exports['lb-phone']:AddCustomApp({identifier=APP,name=Config.AppName,description='写真と文章で、街での思い出を残すプライベート日記。',developer=Config.Developer,defaultApp=Config.DefaultApp,price=Config.AppStorePrice,ui=GetCurrentResourceName()..'/ui/index.html',icon='https://cfx-nui-'..GetCurrentResourceName()..'/ui/icon.png',fixBlur=true})
 if not ok then print(('[PhotoDiary] AddCustomApp failed: %s'):format(err or 'unknown')) end
end
CreateThread(function() while GetResourceState('lb-phone')~='started' do Wait(500) end addApp() end)
AddEventHandler('onResourceStart',function(r) if r=='lb-phone' then addApp() end end)
RegisterNUICallback('photoDiary:getBootstrap',function(_,cb) TriggerServerEvent('photo_diary:bootstrap');cb({ok=true}) end)
RegisterNetEvent('photo_diary:bootstrapResult',function(data) exports['lb-phone']:SendCustomAppMessage(APP,{type='bootstrap',payload=data}) end)
RegisterNUICallback('photoDiary:pickPhotos',function(_,cb) exports['lb-phone']:ShowComponent({component='gallery',includeImages=true,includeVideos=false,multiSelect=true},function(media) if not media then return cb({ok=false,items={}}) end;if media.src then media={media} end;local items={};for i=1,math.min(#media,Config.MaxPhotosPerEntry) do items[#items+1]=media[i].src end;cb({ok=true,items=items}) end) end)
RegisterNUICallback('photoDiary:saveEntry',function(d,cb) TriggerServerEvent('photo_diary:saveEntry',d);cb({ok=true}) end)
RegisterNUICallback('photoDiary:deleteEntry',function(d,cb) TriggerServerEvent('photo_diary:deleteEntry',tonumber(d.id));cb({ok=true}) end)
RegisterNUICallback('photoDiary:shareEntry',function(d,cb) TriggerServerEvent('photo_diary:shareEntry',tonumber(d.id),tostring(d.phoneNumber or ''));cb({ok=true}) end)
RegisterNUICallback('photoDiary:revokeShare',function(d,cb) TriggerServerEvent('photo_diary:revokeShare',tonumber(d.shareId));cb({ok=true}) end)
RegisterNUICallback('photoDiary:leaveShared',function(d,cb) TriggerServerEvent('photo_diary:leaveShared',tonumber(d.shareId));cb({ok=true}) end)
RegisterNUICallback('photoDiary:postBirdy',function(d,cb)
 local content=tostring(d.content or ''):sub(1,280)
 local attachments={}
 if type(d.attachments)=='table' then for i=1,math.min(#d.attachments,4) do attachments[#attachments+1]=tostring(d.attachments[i]) end end
 local ok,result=pcall(function() return exports['lb-phone']:PostBirdy({content=content,attachments=attachments}) end)
 cb({ok=ok and result==true})
end)
RegisterNetEvent('photo_diary:changed',function() TriggerServerEvent('photo_diary:bootstrap') end)
RegisterNetEvent('photo_diary:notify',function(m) exports['lb-phone']:SendCustomAppMessage(APP,{type='toast',payload={message=m}}) end)
RegisterNUICallback('photoDiary:purchaseShareSlots',function(d,cb) TriggerServerEvent('photo_diary:purchaseShareSlots',tostring(d.productId or ''));cb({ok=true}) end)

