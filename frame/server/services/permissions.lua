FramePermissions={}

function FramePermissions.Has(identifier,role)
 if not identifier then return false end
 return MySQL.scalar.await([[SELECT 1 FROM frame_permissions WHERE player_identifier=? AND role=? AND scope='global' LIMIT 1]],{identifier,role}) ~= nil
end

local function isOperatorJob(source)
 if not source then return false end
 local job=FrameFramework.GetJob(source)
 if not job or not job.name then return false end
 if FrameConfig.OperatorRequireDuty==true and job.onduty~=true then return false end
 local name=tostring(job.name):lower()
 for _,allowed in ipairs(FrameConfig.OperatorJobs or {'weazel'}) do
   if name==tostring(allowed):lower() then return true end
 end
 return false
end

function FramePermissions.IsAdmin(identifier)
 return FramePermissions.Has(identifier,'admin')
end

function FramePermissions.IsOperator(identifier,source)
 if FramePermissions.Has(identifier,'admin') or FramePermissions.Has(identifier,'weazel_staff') then return true end
 return isOperatorJob(source)
end

function FramePermissions.IsStaff(identifier,source)
 return FramePermissions.IsOperator(identifier,source)
end

function FramePermissions.CanManageEvent(identifier,event,source)
 return event and (event.owner_identifier==identifier or FramePermissions.IsOperator(identifier,source)) or false
end

function FramePermissions.CanHardDeleteEvent(identifier,event,source)
 if not identifier or not event then return false end
 if FramePermissions.IsOperator(identifier,source) then return true end
 if event.owner_identifier~=identifier then return false end
 return event.status=='draft' or event.status=='cancelled' or event.status=='results' or event.status=='ended'
end

function FramePermissions.CanForceDeleteEvent(identifier,event,source)
 return event~=nil and FramePermissions.IsOperator(identifier,source)
end

function FramePermissions.IsOrganizer(identifier)
 return identifier and MySQL.scalar.await([[SELECT 1 FROM frame_events WHERE owner_identifier=? LIMIT 1]],{identifier}) ~= nil or false
end

function FramePermissions.CanViewEvent(identifier,event,source)
 if not identifier or not event then return false end
 if event.owner_identifier==identifier or FramePermissions.IsOperator(identifier,source) then return true end
 if event.visibility=='public' or event.visibility=='unlisted' then return true end
 if event.visibility=='private' then
   return MySQL.scalar.await([[SELECT 1 FROM frame_event_invites WHERE event_id=? AND player_identifier=? LIMIT 1]],{event.id,identifier}) ~= nil
 end
 if event.visibility=='restricted' and source then
   local job=FrameFramework.GetJob(source)
   if not job or not job.name then return false end
   return MySQL.scalar.await([[SELECT 1 FROM frame_event_access_rules WHERE event_id=? AND rule_type='job' AND LOWER(rule_value)=LOWER(?) LIMIT 1]],{event.id,tostring(job.name)}) ~= nil
 end
 return false
end
