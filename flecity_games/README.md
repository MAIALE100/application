## Current test candidate

- Resource version: **0.14.0-test**
- PLAY JavaScript, PARTY JavaScript, and shared bridge static syntax checks pass.
- Initial game registry: **20/20 enabled**.
- Runtime startup diagnostics execute automatically after DB/bootstrap callback registration.

# Flecity Games

LB Phone game platform with two independent apps:

- **PLAY** — solo mini-game center
- **PARTY** — persistent-room multiplayer mini-game center

The resource is isolated under `flecity_games/` and does not modify PuriPhoto, Photo Diary, FRAME, or their database tables.

## Environment boundary

Repository code confirms the current development integration shape:

- LB Phone custom apps use `AddCustomApp`.
- Client/server calls use `AwaitCallback` and `RegisterCallback`.
- The framework adapter currently targets Qbox/`qbx_core` and character `citizenid`.
- oxmysql is used for persistent PLAY data.

Framework-specific access stays inside the Bridge/Adapter layer so a later QBCore/ESX/other adapter can replace Qbox without rewriting game logic.

Exact Flecity-installed LB Phone, framework, database, and artifact versions remain **LIVE VERIFICATION PENDING** until the operator replies.

## Initial game set

### PLAY — 12/12 enabled

- QUICK TAP — reaction timing with server plausibility validation
- STOP! — server-recalculated marker score
- STACK — overlap/height arcade run
- BLOCK — endless placement, line clear, combo score, auto-save/resume
- MERGE — deterministic 4x4 merge game, auto-save/resume
- MINES — deterministic board, flags, flood reveal, server-verified clear, auto-save/resume
- NONOGRAM — deterministic puzzle/clues, server-verified solution, auto-save/resume
- MEMORY — deterministic 4x4 card matching, server-replayed selection history, time ranking
- COLOR MATCH — 10-round Stroop-style color recognition, server-replayed answer history, time ranking
- NUMBER RUSH — deterministic 5x5 number hunt, server-replayed tap history, miss penalties, time ranking
- HIGH & LOW — deterministic number sequence, server-replayed guesses, streak ranking

- SIMON — repeat an increasingly long seeded four-pad sequence; server replay validates every input

### PARTY — 8/8 enabled

- REACTION — synchronized reveal and server timing validation
- STOP! BATTLE — shared server-owned target/motion state
- VOTE — server-owned voting and aggregation
- MAJORITY — synchronized two-choice social voting
- WORD WOLF — viewer-private topics, reveal only at result
- LIAR — viewer-private roles, reveal only at result
- DRAW — drawer-private prompt, server-owned strokes and guesses
- TELEPHONE — sequential private text/drawing chain with final reveal

PARTY rooms keep the same members while changing games. Room Code and internal Room ID are separate. Reconnect recovery, disconnect grace, immediate host migration, ready state, and host-only round control are implemented. Room changes use viewer-safe LB Phone push messages for near-immediate refresh, with both raw message and official `onNuiEvent` listeners supported. DRAW uses incremental stroke pushes, and a 10-second poll remains only as recovery fallback. Monotonic room revisions prevent older poll/push snapshots from overwriting newer state. A character cannot silently join a second room while its previous disconnected room is still retained, disconnected voters are excluded from final tallies, and rounds abort safely when disconnects make the configured minimum player count or secret-role state invalid.

## Platform features

Implemented:

- per-character persistence through the framework adapter
- resumable PLAY saves
- TODAY / WEEK / ALL TIME ranking
- one leaderboard slot per character
- Daily Challenge with a shared daily game + seed
- Daily leaderboard isolated from ordinary runs
- deterministic Daily BLOCK piece sequence
- deterministic Daily MINES board
- deterministic Daily NONOGRAM puzzle
- deterministic Daily MEMORY card layout
- deterministic Daily NUMBER RUSH number layout
- deterministic Daily QUICK TAP / STOP! challenge parameters
- PLAY statistics from completed runs
- common achievements:
  - FIRST PLAY
  - 100 GAMES
  - LIGHTNING
  - STACK MASTER
  - BLOCK MASTER
  - PERFECT MEMORY
- configurable achievement thresholds
- character-persisted SOUND / REDUCED MOTION settings shared by PLAY and PARTY
- deterministic server replay validation for BLOCK, MERGE, STACK, MEMORY, COLOR MATCH, NUMBER RUSH, and HIGH & LOW final scores
- autosave bound to the active server session and server-issued seed
- resumable-game seed is loaded from the database by the server; the UI cannot choose a resume seed
- non-destructive `game_preflight`, `game_selftest`, and `game_healthcheck`
- rate limits and duplicate score-token protection

Achievements are collection/title features only; no FiveM currency reward is attached.

## Database

The resource bootstraps its own schema on startup using idempotent `CREATE TABLE IF NOT EXISTS` statements. `sql/001_initial.sql` is retained as a manual fallback:

- `flecity_game_profiles`
- `flecity_game_scores`
- `flecity_game_saves`
- `flecity_game_achievements`
- `flecity_game_daily`

No destructive migration or data deletion is performed by the resource.

## Test-server install

1. Add the `flecity_games` folder to test-server resources.
2. Ensure `oxmysql` and `lb-phone` start first.
3. Ensure the framework adapter matches the actual server framework.
4. Add `ensure flecity_games` to the test server config.
5. Start the resource; the Flecity Games tables are created automatically.
6. Confirm the automatic startup log reports `startup preflight READY_FOR_LIVE_TEST`.
7. Use `game_preflight`, `game_selftest`, and `game_healthcheck` only when additional diagnosis is needed.
8. Follow `TESTING.md` for the one-client smoke test.
9. Continue to the two-client and three-client PARTY matrix.

## LIVE VERIFICATION PENDING

Static implementation does not replace an actual FiveM test. Verify on the Flecity test server:

- installed LB Phone API/version behavior
- actual framework/version and character identity
- oxmysql + MySQL/MariaDB compatibility
- both custom apps from one resource
- phone close/open and NUI focus behavior
- autosave/resume after phone close
- multi-client room synchronization
- disconnect/reconnect and host migration
- REACTION / STOP! BATTLE latency fairness
- DRAW stroke polling behavior
- TELEPHONE private-turn visibility
- Daily Challenge rollover at the server/database date boundary
- ranking and achievement writes under real database load

BLOCK, MERGE, STACK, MEMORY, COLOR MATCH, NUMBER RUSH, and HIGH & LOW submit deterministic operation/selection histories and the server replays them before accepting a score. MINES and NONOGRAM reconstruct the board/solution from the seed, while STOP! and PARTY timing games use server-owned timing state. Real-client latency and synchronization still require the live tests in `TESTING.md`.


## Low-effort test-server update workflow

The repository root includes:

- `games-update.cmd`
- `games-update.ps1`

On the local Flecity test machine, run `games-update.cmd`. It:

1. fetches and pulls `games/platform-core`
2. mirrors only `flecity_games/` into the configured test-server resource folder
3. preserves the rest of the server
4. writes a test-only reload marker

The test copy enables the optional `dev_reload.lua` watcher by creating `dev-auto-reload.enabled` only in the test-server destination. This marker is not committed into the production resource.

The first time the watcher is installed, run `restart flecity_games` once in the server console. After that, future `games-update.cmd` runs update only `flecity_games`; it restarts that resource automatically only when resource files actually changed. If nothing changed, no restart is requested. The whole FiveM server does not need to restart.

