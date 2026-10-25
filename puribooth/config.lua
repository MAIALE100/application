Config = {}

Config.Price = 1000
Config.PaymentMethods = { "cash", "bank" }
Config.SessionTimeoutSeconds = 180
Config.CountdownSeconds = 3
Config.ShotCount = 4
Config.ShotIntervalMs = 1800
Config.ScreenshotQuality = 0.92
Config.InteractDistance = 2.2
Config.Debug = false

-- Placement/removal is restricted to Qbox's admin ACE.
Config.AdminAce = "group.admin"
Config.AdminRemoveDistance = 6.0
Config.AllowFirstAdminClaim = true

-- Temporary stock model. This can later be replaced with the final streamed
-- Flecity PURI cabinet without changing the placement database.
Config.DefaultModel = "ch_prop_arcade_claw_01a"

-- Geometry is relative to the booth heading, so admins can place a booth
-- anywhere and the capture zone/camera follow its rotation automatically.
Config.Geometry = {
    captureForward = 3.20,
    captureRight = 0.0,
    captureZ = 0.0,
    captureSize = { x = 3.4, y = 2.6, z = 1.0 },

    cameraForward = 1.28,
    cameraRight = 0.0,
    cameraZ = 1.09,

    pointForward = 3.20,
    pointRight = 0.0,
    pointZ = 0.49,
    fov = 68.0
}

-- One-time migration: if the booth database is empty, retain the current
-- Legion prototype so an admin can remove it and place the first real location.
Config.SeedLegacyBooth = true
Config.LegacyBooth = {
    label = "Legion PURI",
    model = Config.DefaultModel,
    x = 207.60,
    y = -919.66,
    z = 30.69,
    heading = 229.95
}
