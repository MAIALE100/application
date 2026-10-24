Config = {}

Config.Identifier = "puriphoto"
Config.DefaultApp = true

Config.Name = "PuriPhoto"
Config.Description = "Take, decorate, and share your PuriPhoto."
Config.Developer = "PuriPhoto"

-- PuriPhoto v1.1
-- Album data is created automatically by the resource. Operators do not need
-- to run SQL manually.
Config.AlbumLimit = 100
Config.ProjectDataMaxBytes = 2000000
Config.MySpotLimit = 30

-- Static photo spots keep operation simple: no admin panel or recurring updates
-- are required. Add/remove entries here only when the city wants to change them.
Config.PhotoSpots = {
    {
        id = "del_perro_pier",
        name = "デル・ペロ・ピア",
        category = "海・夕景",
        description = "海、桟橋、夕焼けを一緒に撮りやすい定番スポット。",
        coords = { x = -1850.4, y = -1231.6, z = 13.0 }
    },
    {
        id = "vespucci_beach",
        name = "ベスプッチ・ビーチ",
        category = "海・街",
        description = "昼夜どちらも使いやすく、複数人での撮影にも向いています。",
        coords = { x = -1219.7, y = -1515.3, z = 4.4 }
    },
    {
        id = "galileo_observatory",
        name = "ガリレオ天文台",
        category = "夜景",
        description = "ロスサントスを見渡せる高台。夜景撮影におすすめです。",
        coords = { x = -438.8, y = 1075.8, z = 352.4 }
    },
    {
        id = "vinewood_sign",
        name = "バインウッド・サイン周辺",
        category = "景色",
        description = "街らしい記念写真を撮りたいときに使いやすい場所です。",
        coords = { x = 711.3, y = 1198.1, z = 348.5 }
    },
    {
        id = "mirror_park",
        name = "ミラー・パーク",
        category = "自然・街",
        description = "水辺と住宅街の雰囲気を合わせやすい落ち着いたスポット。",
        coords = { x = 1074.5, y = -701.5, z = 58.5 }
    },
    {
        id = "lsia",
        name = "ロスサントス国際空港",
        category = "都会・乗り物",
        description = "車や空港施設を使ったクールな撮影に向いています。",
        coords = { x = -1037.6, y = -2737.8, z = 20.1 }
    },
    {
        id = "sandy_airfield",
        name = "サンディ飛行場",
        category = "砂漠・乗り物",
        description = "砂漠らしい風景や車・航空機との撮影におすすめです。",
        coords = { x = 1740.2, y = 3290.8, z = 41.1 }
    },
    {
        id = "paleto_bay",
        name = "パレト・ベイ海岸",
        category = "自然・海",
        description = "北部らしい静かな海辺の写真を撮りたいときに。",
        coords = { x = -161.2, y = 6420.7, z = 31.9 }
    }
}
