FrameConfig={
 App={identifier='frame',name='FRAME',description='Photo Events in Flecity',developer='Weazel News',defaultApp=true,icon=('https://cfx-nui-%s/web/icon.svg'):format(GetCurrentResourceName()),ui=('%s/web/index.html'):format(GetCurrentResourceName())},
 Framework='auto',
 EventPageSize=30,
 RetentionMonths=2,
 CollaboratorMax=10,
 RetentionBatchSize=50,
 RetentionMaxPerRun=500,
 WeazelOperatorEnabled=false,
 TestGuard={Enabled=true,AutoRevive=true,AutoHealthcheck=true,AutoSelftest=true,StartupCheckDelayMs=20000,IntervalMs=120000},
 OperatorJobs={'weazel'},
 OperatorRequireDuty=false,
 Debug=false
}
