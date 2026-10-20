# Flecity Games

LB Phone game platform with two apps:

- **PLAY** — solo mini-game center
- **PARTY** — multiplayer room-based mini-game center

## Phase 0 findings

Existing repository code confirms these integration patterns:

- LB Phone custom apps use `AddCustomApp`.
- Server callbacks use `RegisterCallback`; clients call through `AwaitCallback`.
- Qbox character identity uses `qbx_core` player data `citizenid`.
- oxmysql is already used by the existing Flecity apps.

Exact installed resource versions are not stored in this repository and remain **LIVE VERIFICATION PENDING**.

## Phase 1 implemented

- PLAY and PARTY registered as two LB Phone apps from one isolated resource
- shared Game Registry for all planned initial games
- Qbox adapter isolated from game logic
- PLAY session, resume-save, score-validation, and ranking base
- PARTY authoritative in-memory Room state
- display Room Code separated from internal Room ID
- ready state, host-only game selection, round-state base
- disconnect grace, automatic reconnect, and immediate host migration
- rate limits
- idempotent initial database schema
- non-destructive `game_selftest` and `game_healthcheck`
- readable phone-first UI shells
- per-player leaderboard aggregation so one player cannot occupy multiple ranking slots
- explicit resume-save reset for new runs

## Reference-game status

- QUICK TAP — playable vertical slice; live timing/latency verification required.
- BLOCK — playable reference implementation with auto-save/resume, new-run reset, line clears, combo score, and score submission.
- REACTION — playable PARTY reference flow with server-owned round state, one submission per player, flying detection, and results.
- VOTE — playable PARTY reference flow with server-owned targets, self-vote rejection, aggregation, and Japanese prompts.

## Test-server install

1. Import `sql/001_initial.sql` into the oxmysql database.
2. Add the `flecity_games` folder to the test server resources.
3. Ensure `oxmysql` and `lb-phone` start first.
4. Ensure Qbox exposes the same `qbx_core` APIs already used by FRAME and Photo Diary.
5. Add `ensure flecity_games` to the test server config.
6. Run `game_selftest` in the server console.
7. Open PLAY and PARTY from LB Phone.

Current public LB Phone documentation was rechecked against the integration shape used here: custom UI apps use `AddCustomApp`, UI paths include the resource name, clients can use `AwaitCallback`, and servers can use `RegisterCallback`. The exact Flecity-installed LB Phone version is still **LIVE VERIFICATION PENDING**.

Phone close/open behavior, NUI focus, actual database compatibility, two-client room synchronization, and network timing are **LIVE VERIFICATION PENDING** until tested in FiveM.
