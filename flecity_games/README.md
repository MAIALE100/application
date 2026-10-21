## Current test candidate

- Resource version: **0.34.0-test**
- PLAY JavaScript, PARTY JavaScript, and shared bridge static syntax checks pass.
- Initial game registry: **25/25 enabled**.
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

### PLAY — 15/15 enabled

- QUICK TAP — reaction timing with server plausibility validation
- STOP! — server-recalculated marker score
- TOWER — precision stacking with PERFECT streak scoring
- BLOCK — endless placement, line clear, combo score, auto-save/resume
- MERGE — deterministic 4x4 merge game, auto-save/resume
- FALL — deterministic 10x18 hard-drop block game with 7 pieces, line clears, combo scoring, auto-save/resume, and server-replayed placements; deterministic next-piece preview; compact placement history and non-blocking periodic autosave for long runs
- MINES — deterministic board, flags, flood reveal, server-verified clear, auto-save/resume
- NONOGRAM — deterministic puzzle/clues, server-verified solution, auto-save/resume
- MEMORY — deterministic 4x4 card matching, server-replayed selection history, time ranking
- SORT — deterministic 6-tube color sorting puzzle, auto-save/resume, time + move-penalty ranking
- SLIDE — deterministic 4x4 sliding-number puzzle, auto-save/resume, server-replayed moves, time + move-penalty ranking; Daily Challenge supported
- COLOR MATCH — 10-round Stroop-style color recognition, server-replayed answer history, time ranking; Daily Challenge supported
- NUMBER RUSH — deterministic 5x5 number hunt, server-replayed tap history, miss penalties, time ranking
- RANGE RUSH — 3-life HIGH/LOW reflex run with adaptive timer, streak multiplier, and server-owned score

- SIMON — repeat an increasingly long seeded four-pad sequence; server replay validates every input; Daily Challenge supported

### PARTY — 10/10 enabled

- REACTION — synchronized reveal and server timing validation
- STOP! BATTLE — shared server-owned target/motion state
- VOTE — server-owned voting and aggregation
- MAJORITY — synchronized two-choice social voting
- MINORITY — synchronized two-choice social voting where the less-popular choice wins
- TIC-TAC — 2-player server-authoritative 3x3 turn game
- WORD WOLF — viewer-private topics, reveal only at result
- LIAR — viewer-private roles, reveal only at result
- DRAW — drawer-private prompt, server-owned strokes and guesses
- TELEPHONE — sequential private text/drawing chain with final reveal

PARTY rooms keep the same members while changing games. Room Code and internal Room ID are separate. Reconnect recovery, disconnect grace, immediate host migration, ready state, and host-only round control are implemented. Room changes use viewer-safe LB Phone push messages for near-immediate refresh, with both raw message and official `onNuiEvent` listeners supported. DRAW uses incremental stroke pushes, and a 10-second poll remains only as recovery fallback. Monotonic room revisions prevent older poll/push snapshots from overwriting newer state. A character cannot silently join a second room while its previous disconnected room is still retained, disconnected voters are excluded from final tallies, and rounds abort safely when disconnects make the configured minimum player count or secret-role state invalid.

## UI clarity pass

- LB Phone `fixBlur=true` enabled.
- Shared PLAY/PARTY CSS uses rem-based sizing instead of px for blur-safe custom-app rendering.
- PLAY game library uses dedicated SVG icons for all 15 solo games.
- Game cards use larger icons, stronger text contrast, clearer metadata, and a Daily Challenge game icon.
- PLAY home shows up to three recently played games using server-side score history timestamps.
- GAME LIBRARY can be filtered by Quick / Arcade / Endless / Puzzle without reloading the app.
- おまかせ launches a random game from the currently visible category.
- PLAY game cards can be starred as favorites; favorites persist per character in the existing profile settings JSON.
- The Favorites filter shows only starred games, with a maximum of eight favorites.
- Profile setting updates are partial/merge-safe so PARTY sound or reduced-motion changes do not erase PLAY favorites.

## Platform features

Implemented:

- per-character persistence through the framework adapter
- resumable PLAY saves
- save-generation guards prevent stale in-flight autosaves from resurrecting a reset run
- phone-hide lifecycle cleanup, stale session-start cancellation, and score-finalization race protection
- untouched resumable runs are not persisted; stale empty saves are removed on bootstrap
- Daily screens use TODAY BEST, result timers freeze to the confirmed score, and duplicate BEST rows are removed
- PLAY shutdown uses official LB Phone onClose / phoneToggled hooks with delayed server-side orphan cleanup
- idempotent PLAY session starts prevent duplicate runs when only the callback response is lost
- Daily runs expire cleanly at the database date boundary and refresh to the new challenge
- TODAY / WEEK / ALL TIME ranking
- period-specific personal BEST + rank, tie-aware leaderboard positions, and a privacy-safe highlighted self row
- one leaderboard slot per character
- Daily Challenge with a shared daily game + seed
- Daily leaderboard isolated from ordinary runs
- deterministic Daily BLOCK piece sequence
- deterministic Daily MINES board
- deterministic Daily NONOGRAM puzzle
- deterministic Daily MEMORY card layout
- deterministic Daily NUMBER RUSH number layout
- deterministic Daily SIMON sequence with server-authoritative round validation
- deterministic Daily SLIDE board with server-replayed move validation
- deterministic Daily COLOR MATCH 10-question sequence with server-replayed answer validation
- deterministic Daily QUICK TAP / STOP! challenge parameters
- PLAY statistics from completed runs
- 16 collection/title achievements across PLAY:
  - FIRST PLAY
  - 100 GAMES
  - LIGHTNING
  - BULLSEYE
  - STACK MASTER
  - BLOCK MASTER
  - MERGE MASTER
  - MINES SPRINTER
  - LOGIC SOLVER
  - PERFECT MEMORY
  - COLOR FOCUS
  - NUMBER ACE
  - HIGH ROLLER
  - SIMON MASTER
  - SLIDE MASTER
  - FALL MASTER
- configurable achievement thresholds
- character-persisted SOUND / REDUCED MOTION settings shared by PLAY and PARTY
- deterministic server replay validation for BLOCK, MERGE, FALL, TOWER, SORT, SLIDE, MEMORY, COLOR MATCH, NUMBER RUSH, and RANGE RUSH final scores
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

BLOCK, MERGE, STACK, MEMORY, COLOR MATCH, and NUMBER RUSH submit deterministic operation/selection histories and the server replays them before accepting a score. HIGH & LOW and SIMON advance through server-authoritative per-action state. MINES and NONOGRAM reconstruct the board/solution from the seed, while STOP! is recalculated from server-issued timing parameters. Real-client NUI behavior still requires the live tests in `TESTING.md`.


## Fully automatic test-server updates

After one final manual refresh, background updating can be enabled automatically.

The automatic updater:

- watches `games/platform-core` every 30 seconds
- waits for the detected commit to remain stable before deployment
- uses a dedicated detached Git worktree so normal FRAME / Photo Diary / other branch work is never switched or reset
- runs the existing safety validation before deployment
- keeps the previous test-server build in place when validation or deployment fails
- mirrors only `flecity_games` into the test server
- updates the reload token so only `flecity_games` restarts; the full FiveM server is not restarted
- restarts its own watcher when the watcher script itself is updated
- resumes automatically at Windows logon through Task Scheduler, with the Startup folder as a fallback
- writes its diagnostic log under `%LOCALAPPDATA%\FlecityGamesAutoUpdate\auto-update.log`

One-click controls are also included:

- `games-auto-update-install.cmd`
- `games-auto-update-disable.cmd`

The normal `games-update.cmd` automatically enables the background updater once when it is not already installed and has not been explicitly disabled.

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


### 0.19.0 visual quality pass
- Distinct visual identity for all 12 PLAY games on the home library.
- QUICK TAP and STOP! now communicate live state visually, not only through text.
- BLOCK, MERGE, MINES, NONOGRAM, NUMBER RUSH and HIGH & LOW add tactile interaction feedback without changing server scoring rules.
- STACK, MEMORY and SIMON receive stronger game-specific presentation and animation.
- Reduced-motion remains respected for the new visual effects.

### 0.19.1 retention pass
- All 12 PLAY games now expose S/A/B/C rank goals from server-validated scores.
- Home cards show the current rank and the next target instead of only a raw BEST value.
- Daily Challenge derives a consecutive-day streak from existing validated Daily score history without adding a new table.

### 0.20.0 gameplay redesign
- HIGH & LOW is replaced by RANGE RUSH: a 30-round server-timed classification game based on judgment speed rather than luck.
- RANGE RUSH scores speed, streak and correctness server-side; timeout/mistake ends the run.
- MERGE now uses server-validated CHAIN multipliers: consecutive merge-producing moves increase scoring up to x5, while a non-merge move resets the chain.
- MERGE adds next-tile goals, fever/milestone feedback and versioned saves for the new scoring rules.
- BLOCK remains drag-first with STREAK / BLAST / FEVER feedback from the 0.19.2 flagship pass.

### 0.21.0 TOWER redesign
- STACK is presented as TOWER while retaining the stable internal game id for existing data compatibility.
- Ranking score is now server-replayed points instead of raw layer count.
- Placement precision contributes to points; PERFECT placements preserve width and build a capped streak multiplier.
- Server metadata records height, max PERFECT streak and final width for achievements and diagnostics.

### 0.22.0 RANGE RUSH v3
- RANGE RUSH is now a 3-life cognitive reflex game instead of one-miss sudden death.
- Each five-round stage tightens the response window while keeping a 1.2s lower bound.
- Consecutive correct answers raise the score multiplier up to x4.
- Close comparisons and faster answers add difficulty/speed bonuses.
- Server state owns lives, timing, streak, score, and the next round; the client only submits HIGH/LOW/timeout actions.

### 0.23.0 SORT
- Added SORT, a six-tube color organization puzzle designed for short-to-medium phone sessions.
- Four colors appear four times each; two empty tubes create planning space.
- Every move is replay-validated from the server seed, and completion requires four full monochrome tubes.
- Ranking score is authoritative elapsed time plus a 350ms penalty per move, rewarding both speed and efficient solutions.
- SORT supports autosave/resume and phone-close safety through the existing PLAY lifecycle.
