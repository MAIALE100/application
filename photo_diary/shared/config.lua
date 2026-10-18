Config = {}
Config.AppIdentifier = 'weazel_photo_diary'
Config.AppName = 'Photo Diary'
Config.Developer = 'Weazel News'
Config.DefaultApp = false
Config.AppStorePrice = 0
Config.MaxPhotosPerEntry = 5
Config.MaxTitleLength = 60
Config.MaxBodyLength = 3000
Config.FreeShareSlots = 5
Config.MaxShareSlots = 50
Config.ShareSlotStep = 5

-- Payment is intentionally disabled until Flecity's banking/company-account adapter
-- and prices are configured. Free sharing remains available.
Config.EnablePaidFeatures = false

-- Paid unlock tiers are fixed at +5 people per purchase, up to 50.
-- Prices remain unset until Flecity provides/approves the banking integration and pricing.
-- Set each price to a positive number before enabling Config.EnablePaidFeatures.
Config.ShareSlotProducts = {
  share_10 = { slots = 10, price = false },
  share_15 = { slots = 15, price = false },
  share_20 = { slots = 20, price = false },
  share_25 = { slots = 25, price = false },
  share_30 = { slots = 30, price = false },
  share_35 = { slots = 35, price = false },
  share_40 = { slots = 40, price = false },
  share_45 = { slots = 45, price = false },
  share_50 = { slots = 50, price = false },
}
Config.CompanyAccount = 'weazel'
Config.RequireConfiguredPaymentAdapter = true
Config.MaxPhotoUrlLength = 2048
Config.BirdyAppIdentifier = 'Birdy' -- change if Flecity uses another identifier

-- Ownership is character-scoped. On Qbox the adapter uses citizenid.
Config.CharacterOwnershipRequired = true
