FlecityGamesConfig = {
    Debug = false,
    Framework = 'auto',

    Apps = {
        Play = {
            identifier = 'flecity_play',
            name = 'PLAY',
            description = 'Short breaks to endless play.',
            developer = 'Flecity',
            defaultApp = true,
            ui = 'web/play/index.html',
            icon = 'web/play/icon.svg'
        },
        Party = {
            identifier = 'flecity_party',
            name = 'PARTY',
            description = 'Mini games with friends.',
            developer = 'Flecity',
            defaultApp = true,
            ui = 'web/party/index.html',
            icon = 'web/party/icon.svg'
        }
    },

    Play = {
        SessionMaxAgeSeconds = 8 * 60 * 60,
        SaveStateMaxBytes = 64 * 1024,
        RankingLimit = 20,
        DailyCandidates = {'quick_tap','stop','block','mines','nonogram'},
        Achievements = {
            LightningReactionMs = 200,
            StackMasterLayers = 25,
            BlockMasterScore = 5000,
            GamesVeteranCount = 100
        }
    },

    Party = {
        MinPlayers = 2,
        MaxPlayers = 10,
        RoomCodeLength = 4,
        DisconnectGraceSeconds = 60,
        RoomMaxAgeSeconds = 4 * 60 * 60
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
