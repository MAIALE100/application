# Flecity Games — Operator Install Guide

This resource provides two LB Phone custom apps:

- PLAY — solo mini-games
- PARTY — multiplayer mini-games

It is isolated under `flecity_games` and does not modify PuriPhoto, Photo Diary, FRAME, or their tables.

## Production environment confirmation

Before production installation, confirm the operator-provided environment matches the adapter:

- Framework and framework version
- LB Phone version
- oxmysql availability
- MySQL / MariaDB runtime
- persistent character identifier
- FiveM artifact/runtime

The current development adapter is Qbox/`qbx_core` and uses character `citizenid`.
If production uses another framework, replace only the framework adapter before release.

## Installation

1. Copy the `flecity_games` folder into the server resources directory.
2. Ensure framework, oxmysql, and LB Phone start before this resource.
3. Add:

```cfg
ensure flecity_games
```

after LB Phone in `server.cfg`.

4. Start or restart only this resource:

```text
ensure flecity_games
```

or, if already running:

```text
restart flecity_games
```

A full FiveM server restart is normally not required for resource-only updates.

## Database

The resource creates/updates its own tables on startup using non-destructive, idempotent schema setup.

Tables:

- `flecity_game_profiles`
- `flecity_game_scores`
- `flecity_game_saves`
- `flecity_game_achievements`
- `flecity_game_daily`

Manual SQL is normally unnecessary. `sql/001_initial.sql` is included only as a fallback when automatic DDL permissions are restricted.

The resource does not issue DROP TABLE or TRUNCATE TABLE.

## Expected startup result

A healthy startup should include:

```text
[FlecityGames] database schema ready
[FlecityGames] LB Phone callbacks registered <count>/<count>
[FlecityGames] startup preflight READY_FOR_LIVE_TEST
```

For a compact diagnostic summary:

```text
game_status
```

Additional diagnostics:

```text
game_preflight
game_selftest
game_healthcheck
```

These commands are diagnostic-only and do not delete player data.

## Rollback

To stop the apps without deleting persistent data:

1. Remove or comment `ensure flecity_games`.
2. Stop/remove the `flecity_games` resource.

The Flecity Games database tables may be left in place. They do not affect other apps when the resource is stopped.

Database deletion is intentionally not included in the automatic rollback procedure.

## Update policy

Resource-only updates should replace only `flecity_games` and restart only that resource.

Do not overwrite or edit PuriPhoto, Photo Diary, FRAME, LB Phone core files, Qbox core files, or unrelated database tables as part of a Flecity Games update.

## Verification

Complete `TESTING.md` on a test environment before production release. Multiplayer verification requires at least two clients, with the 3+ player social games tested separately.
