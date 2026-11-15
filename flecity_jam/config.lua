JamConfig = {
    Command = 'jam',
    Range = 7.0, -- metres; installed pma-voice defaults to 3m (native) / 7m (non-native).
    MaxPerformers = 8,
    MaxNotes = 16,
    MaxOps = 32,
    EventsPerSecond = 100,
    EventBurst = 160,
    TickMs = 250,
    SnapshotMs = 1000,
    SessionTimeoutMs = 4500,
    MaxNoteMs = 120000,
    -- open: everyone; ace: JamConfig.Ace; ox_inventory: instruments' configured item.
    Access = 'open',
    Ace = 'flecity.jam',
    Items = { piano = 'jam_piano', guitar = 'jam_guitar', bass = 'jam_bass', clarinet = 'jam_clarinet', drums = 'jam_drums' },
    -- Disabled until GTA animations and attachments have passed the target server's visual check.
    Presentation = false,
    PttControl = 249,
    ReservedKeys = { 'KeyN', 'CapsLock', 'F8', 'F11', 'AltLeft', 'AltRight' },
    DisableControls = { 1, 2, 21, 22, 23, 24, 25, 30, 31, 37, 44, 45, 47, 58, 75, 140, 141, 142, 143, 177, 199, 200, 245, 257, 263, 264, 288, 289, 311 },
    -- Optional integration: return false with a reason while your UI/death system is busy.
    CanStartClient = function()
        local state = LocalPlayer and LocalPlayer.state
        return not state or not (state.isDead or state.inLaststand or state.invOpen or state.invBusy)
    end
}
