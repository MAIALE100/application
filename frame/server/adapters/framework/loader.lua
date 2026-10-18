FrameFramework = FrameFramework or {}
local fw = FrameConfig.Framework
if fw == 'auto' then
  if GetResourceState('qbx_core') == 'started' then fw='qbox' else fw='standalone' end
end
FrameRuntimeFramework = fw
print(('[FRAME] framework adapter: %s'):format(fw))
