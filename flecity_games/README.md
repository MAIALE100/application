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

### PLAY — 7/7 enabled

- QUICK TAP — reaction timing with server plausibility validation
- STOP! — server-recalculated marker score
- STACK — overlap/height arcade run
- BLOCK — endless placement, line clear, combo score, auto-save/resume
- MERGE — deterministic 4x4 merge game, auto-save/resume
- MINES — deterministic board, flags, flood reveal, server-verified clear, auto-save/resume
- NONOGRAM — deterministic puzzle/clues, server-verified solution, auto-save/resume

### PARTY — 8/8 enabled

- REACTION — synchronized reveal and server timing validation
- STOP! BATTLE — shared server-owned target/motion state
- VOTE — server-owned voting and aggregation
- MAJORITY — synchronized two-choice social voting
- WORD WOLF — viewer-private topics, reveal only at result
- LIAR — viewer-private roles, reveal only at result
- DRAW — drawer-private prompt, server-owned strokes and guesses
- TELEPHONE — sequential private text/drawing chain with final reveal

PARTY rooms keep the same members while changing games. Room Code and internal Room ID are separate. Reconnect recovery, disconnect grace, immediate host migration, ready state, and host-only round control are implemented.

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
- deterministic Daily QUICK TAP / STOP! challenge parameters
- PLAY statistics from completed runs
- common achievements:
  - FIRST PLAY
  - 100 GAMES
  - LIGHTNING
  - STACK MASTER
  - BLOCK MASTER
- configurable achievement thresholds
- non-destructive `game_selftest`
- non-destructive `game_healthcheck`
- rate limits and duplicate score-token protection

Achievements are collection/title features only; no FiveM currency reward is attached.

## Database

`sql/001_initial.sql` creates only Flecity Games tables and uses `CREATE TABLE IF NOT EXISTS`:

- `flecity_game_profiles`
- `flecity_game_scores`
- `flecity_game_saves`
- `flecity_game_achievements`
- `flecity_game_daily`

No destructive migration or data deletion is performed by the resource.

## Test-server install

1. Import `sql/001_initial.sql` into the test database.
2. Add the `flecity_games` folder to test-server resources.
3. Ensure `oxmysql` and `lb-phone` start first.
4. Ensure the framework adapter matches the actual server framework.
5. Add `ensure flecity_games` to the test server config.
6. Run `game_selftest` in the server console.
7. Run `game_healthcheck`.
8. Open PLAY and PARTY from LB Phone.
9. Test PARTY with at least two clients; social games need their configured minimum player counts.

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

BLOCK and MERGE still use client-run gameplay state with server-side score/session bounds rather than full server replay validation. MINES, NONOGRAM, STOP!, and several PARTY flows have stronger server-side reconstruction/validation and can be used as the model for later hardening.
