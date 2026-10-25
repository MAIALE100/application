FlecityBaseConfig = {}

FlecityBaseConfig.Debug = true
FlecityBaseConfig.Framework = 'qbox'

FlecityBaseConfig.App = {
    identifier = 'flecity_base',
    name = 'BASE',
    description = 'メモ・在庫・タスク・会計を、個人や仲間と共有。',
    developer = 'Flecity',
    defaultApp = false,
    game = false,
    size = 25600,
    price = 0,
    ui = 'web/index.html',
    icon = 'web/icon.svg',
    fixBlur = true
}

FlecityBaseConfig.Limits = {
    workspacesPerOwner = 8,
    membersPerWorkspace = 50,
    pendingInvitesPerWorkspace = 50,
    notesPerWorkspace = 300,
    tasksPerWorkspace = 500,
    stockItemsPerWorkspace = 300,
    ledgerEntriesPerPage = 100,
    calculatorsPerWorkspace = 20,
    calculatorFields = 8,
    calculatorFormula = 512,
    title = 120,
    noteBody = 8000,
    shortText = 180,
    taskDetails = 4000,
    moneyAmount = 1000000000,
    stockQuantity = 1000000
}

FlecityBaseConfig.InviteExpiryHours = 72

FlecityBaseConfig.Access = {
    adminAce = 'flecity.base.admin',
    weazelSupportAce = 'flecity.base.weazel_support',
    weazelJob = 'weazel',
    weazelRequireBoss = true,
    -- Optional minimum grade when the server does not expose job.isboss.
    weazelMinimumGrade = 99,
    -- Support mode is intentionally session-only and OFF after reconnect/resource restart.
    supportDefault = false
}


FlecityBaseConfig.WorkspaceTemplates = {
    personal = { label = 'MY SPACE', modules = { memo = true, stock = true, tasks = true, money = true } },
    business = { label = '企業', modules = { memo = true, stock = true, tasks = true, money = true } },
    crew = { label = 'クルー', modules = { memo = true, stock = true, tasks = true, money = true } },
    team = { label = 'チーム', modules = { memo = true, stock = true, tasks = true, money = true } },
    project = { label = 'プロジェクト', modules = { memo = true, stock = true, tasks = true, money = true } },
    custom = { label = 'カスタム', modules = { memo = true, stock = true, tasks = true, money = true } }
}
