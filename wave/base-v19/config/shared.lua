WaveConfig = {
    Debug = false,
    SchemaVersion = 3,

    App = {
        identifier = 'flecity_wave',
        name = 'WAVE',
        description = 'つくる、聴く、届ける。Flecityの音楽プラットフォーム。',
        developer = 'Weazel / Flecity',
        defaultApp = false,
        size = 2400,
        price = 0,
        ui = 'web/index.html',
        icon = 'web/icon.svg',
        fixBlur = true
    },

    Limits = {
        artistName = 48,
        bio = 400,
        trackTitle = 80,
        description = 800,
        projectTitle = 80,
        projectJsonBytes = 512 * 1024,
        maxTracks = 16,
        maxBars = 128,
        maxNotesPerTrack = 2048,
        maxNotesTotal = 8192,
        maxDurationSeconds = 10 * 60,
        homeLimit = 30,
        searchLimit = 50,
        playlistName = 60,
        playlistDescription = 240,
        maxPlaylists = 50,
        maxPlaylistTracks = 200,
        albumTitle = 80,
        albumDescription = 400,
        maxAlbumTracks = 30
    },

    Economy = {
        platformShare = 0.15,
        minimumWithdraw = 1000,
        defaultTrackPrice = 5000,
        maxTrackPrice = 1000000,
        currency = '$'
    },

    Subscription = {
        enabled = false,
        name = 'WAVE+',
        previewSeconds = 30,
        settlementDay = 1
    },

    Admin = {
        aces = {'wave.admin'},
        weazelJob = 'weazel',
        allowWeazelBoss = true
    }
}
