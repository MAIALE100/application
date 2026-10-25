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

-- Prototype uses a stock arcade cabinet so the full flow can be tested without
-- streaming a custom model. Replace model/coords later with the final Puri booth.
Config.Booths = {
    legion = {
        label = "Legion PURI",
        model = "ch_prop_arcade_claw_01a",
        coords = vector4(207.60, -919.66, 30.69, 229.95),

        -- People can freely stand inside this area. There is intentionally no
        -- participant limit or invite list.
        captureCenter = vector3(210.05, -921.72, 30.69),
        captureSize = vector3(4.6, 3.4, 1.0),

        -- Fixed booth camera position. Fine tuning can be done in-game later.
        camera = {
            coords = vector3(207.92, -919.92, 32.05),
            pointAt = vector3(210.05, -921.72, 31.20),
            fov = 58.0
        }
    }
}
