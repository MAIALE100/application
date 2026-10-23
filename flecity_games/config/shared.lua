FlecityGamesConfig = {
    Debug = false,
    Framework = 'auto',

    Apps = {
        Play = {
            enabled = true,
            identifier = 'flecity_play',
            name = 'LOOP',
            description = '短時間からじっくり遊べるミニゲーム。',
            developer = 'Flecity',
            defaultApp = false,
            game = true,
            size = 1800,
            price = 0,
            ui = 'web/play/index.html',
            icon = 'web/play/icon.svg'
        },
        Party = {
            enabled = true,
            identifier = 'flecity_party',
            name = 'PARTY',
            description = '友達と無料10種類＋PARTY+ 5種類を遊べるパーティーアプリ。',
            developer = 'Flecity',
            defaultApp = false,
            game = true,
            size = 1200,
            price = 0,
            ui = 'web/party/index.html',
            icon = 'web/party/icon.svg'
        }
    },

    Play = {
        SessionMaxAgeSeconds = 8 * 60 * 60,
        SaveStateMaxBytes = 64 * 1024,
        RankingLimit = 20,
        DailyCandidates = {'block','mines','quick_tap','nonogram','simon','memory','stop','slide','number_rush','sort','color_match'},
        Achievements = {
            LightningReactionMs = 200,
            StackMasterLayers = 25,
            BlockMasterScore = 5000,
            GamesVeteranCount = 100,
            NumberRushAceMs = 16000,
            HighLowStreak = 10,
            StopBullseyeScore = 990,
            MergeMasterTile = 2048,
            MinesSprinterMs = 60000,
            NonogramQuickMs = 60000,
            ColorMatchFocusMs = 14000,
            SimonMasterRounds = 15,
            SlideMasterMs = 90000,
            SlideMasterMoves = 120,
            FallMasterLines = 20
        }
    },

    Party = {
        MinPlayers = 2,
        MaxPlayers = 10,
        RoomCodeLength = 4,
        DisconnectGraceSeconds = 60,
        RoomMaxAgeSeconds = 4 * 60 * 60
    },

    PartyPlus = {
        Enabled = true,
        Price = 50000,
        DurationSeconds = 7 * 24 * 60 * 60,
        MoneyType = 'bank',
        AutoRenewDefault = true
    },

    RateLimits = {
        PlayStartMs = 400,
        PlaySaveMs = 250,
        ScoreSubmitMs = 750,
        RankingMs = 500,
        RoomCreateMs = 1500,
        RoomJoinMs = 1200,
        ReadyMs = 300,
        RoomActionMs = 500
    }
}
