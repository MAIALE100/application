FramePermissions={}
function FramePermissions.Has(identifier,role)
 if not identifier then return false end
 return MySQL.scalar.await([[SELECT 1 FROM frame_permissions WHERE player_identifier=? AND role=? AND scope='global' LIMIT 1]],{identifier,role}) ~= nil
end
function FramePermissions.IsStaff(identifier) return FramePermissions.Has(identifier,'weazel_staff') or FramePermissions.Has(identifier,'admin') end
function FramePermissions.IsAdmin(identifier) return FramePermissions.Has(identifier,'admin') end
function FramePermissions.CanManageEvent(identifier,event)
 return event and (event.owner_identifier==identifier or FramePermissions.IsStaff(identifier)) or false
end
function FramePermissions.IsOrganizer(identifier)
 return identifier and MySQL.scalar.await([[SELECT 1 FROM frame_events WHERE owner_identifier=? LIMIT 1]],{identifier}) ~= nil or false
end
