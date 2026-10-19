local APP=FrameConfig.App
local function registerApp()
 if GetResourceState('lb-phone')~='started' then return false end; Wait(500)
 local success,err=exports['lb-phone']:AddCustomApp({identifier=APP.identifier,name=APP.name,description=APP.description,developer=APP.developer,defaultApp=APP.defaultApp,ui=APP.ui,icon=APP.icon,fixBlur=true})
 if not success and err and err~='APP_ALREADY_EXISTS' then print(('[FRAME] AddCustomApp: %s'):format(err)) end; return success
end
CreateThread(registerApp)
AddEventHandler('onResourceStart',function(r) if r=='lb-phone' and GetCurrentResourceName()~='lb-phone' then CreateThread(registerApp) end end)
local names={'getInitialData','getEvent','getMyEvents','createEvent','updateEvent','cancelEvent','publishEvent','joinEvent','submitPhoto','submitSocialPhoto','getMySubmissions','deleteMySubmission','getEventSubmissions','deleteSubmission','invitePhone','getEventAwards','beginJudging','publishResults','addAward','setWinner','getResults','getAdProducts','createAd','getActiveAds','adImpression','adClick','getStaffDashboard','reviewAd'}
for _,n in ipairs(names) do RegisterNUICallback('frame:'..n,function(data,cb) local ok,res=pcall(function() return exports['lb-phone']:AwaitCallback(n=='getInitialData' and 'frame:getEvents' or 'frame:'..n,data or {}) end); cb(ok and (res or {ok=false,error='EMPTY_RESPONSE'}) or {ok=false,error='PHONE_CALLBACK_FAILED'}) end) end
RegisterNUICallback('frame:pickGallery',function(_,cb) exports['lb-phone']:ShowComponent({component='gallery',includeVideos=false,includeImages=true,multiSelect=false},function(media) cb({ok=media~=nil,media=media}) end) end)
RegisterNUICallback('frame:takePhoto',function(_,cb) local url=exports['lb-phone']:SetCameraComponent({default={type='Photo',camera='rear'},permissions={takeVideo=false},saveToGallery=true}); cb({ok=url~=nil,url=url}) end)
RegisterNUICallback('frame:saveSubmission',function(data,cb)
 local ok,res=pcall(function() return exports['lb-phone']:AwaitCallback('frame:authorizeSave',data or {}) end)
 if not ok or not res or not res.ok then cb(res or {ok=false,error='AUTH_FAILED'}); return end
 local saved=exports['lb-phone']:SaveToGallery(res.media_ref); cb({ok=saved~=false})
end)
