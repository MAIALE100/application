Config = {}

Config.Price = 1000
Config.PaymentMethods = { "cash", "bank" }
Config.SessionTimeoutSeconds = 180
Config.CaptureTimeoutSeconds = 600
Config.CountdownSeconds = 3
Config.ShotCount = 4
Config.ShotIntervalMs = 1800
Config.ScreenshotQuality = 0.92
Config.InteractDistance = 2.2
Config.ThemeSyncDistance = 5.5
Config.CountdownSyncDistance = 5.5
Config.ThemeSyncBytesPerSecond = 750000
Config.Debug = false

-- Placement/removal is restricted to Qbox's admin ACE.
Config.AdminAce = "group.admin"
Config.AdminRemoveDistance = 6.0
Config.AllowFirstAdminClaim = true
Config.AdminPlaceMaxDistance = 15.0

Config.PlacementPreview = {
    initialDistance = 2.8,
    moveStep = 0.035,
    rotateStep = 1.0,
    heightStep = 0.02,
    maxHorizontalOffset = 6.0,
    alpha = 125
}

-- Temporary stock model. This can later be replaced with the final streamed
-- FLEPURI cabinet without changing the placement database.
Config.DefaultModel = "ch_prop_arcade_claw_01a"

-- Geometry is relative to the booth heading, so admins can place a booth
-- anywhere and the capture zone/camera follow its rotation automatically.
Config.ThemeSurfaces = {
    background = {
        forward = -4.72,
        right = 0.0,
        bottomZ = -0.08,
        width = 8.4,
        height = 4.8
    },
    floor = {
        forward = -3.00,
        right = 0.0,
        z = 0.025,
        width = 8.4,
        depth = 4.15
    }
}

Config.InteractionMarker = {
    enabled = true,
    renderDistance = 18.0,
    labelDistance = 5.0,

    -- Flat interaction circle around the cabinet.
    radius = 1.18,
    height = 0.055,
    zOffset = 0.035,

    available = { r = 82, g = 218, b = 255, a = 92 },
    nearby = { r = 115, g = 235, b = 255, a = 135 },
    occupied = { r = 255, g = 118, b = 184, a = 78 },

    pulseAmount = 0.10,
    pulseSpeed = 0.0032
}

Config.PhotoLighting = {
    enabled = true,
    range = 7.0,
    intensity = 2.2,
    color = { r = 255, g = 238, b = 244 },
    sideOffset = 1.25,
    forwardOffset = -0.45,
    heightOffset = 0.55
}

Config.CaptureGuide = {
    enabled = true,

    -- 実カメラFOVから算出した横幅に対する「安全に写る範囲」。
    safeWidthScale = 0.78,
    outerWidthScale = 0.94,

    -- 立ち位置として使える前後幅。
    depth = 1.35,

    -- 人物の頭が切れにくい高さ目安。
    frameHeight = 2.25,

    -- 最大4人が並びやすい足元マーカー。
    positionMarkers = 4,

    -- Gキー。撮影開始前だけガイド表示を切り替える。
    toggleControl = 47
}

Config.Geometry = {
    captureForward = -3.20,
    captureRight = 0.0,
    captureZ = 0.0,
    captureSize = { x = 3.4, y = 2.6, z = 1.0 },

    cameraForward = -1.28,
    cameraRight = 0.0,
    cameraZ = 1.65,

    pointForward = -3.20,
    pointRight = 0.0,
    pointZ = 1.35,
    fov = 68.0
}

-- One-time migration: if the booth database is empty, retain the current
-- Legion prototype so an admin can remove it and place the first real location.
Config.SeedLegacyBooth = true
Config.LegacyBooth = {
    label = "フレプリ",
    model = Config.DefaultModel,
    x = 207.60,
    y = -919.66,
    z = 30.69,
    heading = 229.95
}
