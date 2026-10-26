Config = {}

Config.Price = 1000 -- 新規設置台の初期料金
Config.MinPrice = 0
Config.MaxPrice = 100000
Config.PaymentMethods = { "cash", "bank" }

-- Version floors are used only where the upstream resource exposes a
-- directly comparable resource version. qbx_core is capability-checked
-- separately because QBox framework release numbers and qbx_core resource
-- versions are different version streams.
Config.MinimumVersions = {
    puriphoto = "1.1.0"
}

-- 設置・撤去・料金変更・売上確認を使えるjob。
-- 提出版では初回claimadmin方式を使わず、jobで権限管理します。
Config.Management = {
    job = "weazel",
    requireOnDuty = false,
    allowAceOverride = false,
    ace = "group.admin",

    placeMinGrade = 0,
    removeMinGrade = 0,
    priceMinGrade = 0,
    salesMinGrade = 0,

    -- 本社の座標が決まったら true にして coords を指定できます。
    salesRequireLocation = false,
    salesCoords = { x = 0.0, y = 0.0, z = 0.0 },
    salesDistance = 12.0
}

-- 売上入金先。QBox標準構成で使われるRenewed-Bankingに対応。
-- accountを "weazel" にするとweazelのjob口座へ入金できます。
Config.Payout = {
    enabled = true,
    mode = "renewed-banking",
    resource = "Renewed-Banking",
    account = "weazel",
    transactionTitle = "FLEPURI売上"
}
Config.SessionTimeoutSeconds = 180
Config.CaptureTimeoutSeconds = 600
Config.CountdownSeconds = 3
Config.ShotCount = 4 -- v1.0編集UIは4枚固定。変更時はselftestをFAILにします。
Config.ShotIntervalMs = 1800
Config.ScreenshotQuality = 0.92
Config.InteractDistance = 2.2
Config.ThemeSyncDistance = 5.5
Config.CountdownSyncDistance = 5.5
Config.ThemeSyncBytesPerSecond = 750000
Config.MaxThemeImageBytes = 4 * 1024 * 1024
Config.ThemeUpdateCooldownMs = 1000
Config.PuriPhotoHandoffTimeoutMs = 12000
Config.Debug = false

-- 返金exportが一時的に失敗した場合の自動復旧。
-- processing状態は二重返金防止のため自動再試行せず、手動照合対象にします。
Config.RefundRetrySeconds = 60
Config.RefundRetryBatch = 25

-- 課金 / 売上 / 返金の保守ログ保持日数。
Config.SupportHistoryDays = 90

Config.AdminRemoveDistance = 6.0
Config.AdminPlaceMaxDistance = 15.0

Config.PlacementPreview = {
    initialDistance = 2.8,
    moveStep = 0.012,
    rotateStep = 0.5,
    heightStep = 0.008,
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
Config.SeedLegacyBooth = false
Config.LegacyBooth = {
    label = "フレプリ",
    model = Config.DefaultModel,
    x = 207.60,
    y = -919.66,
    z = 30.69,
    heading = 229.95
}
