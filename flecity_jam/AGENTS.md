# Flecity JAM scope (2026-11-16)

## Current handoff — 2026-11-17

The user explicitly resumed JAM and authorized necessary access, edits and test-server deployment without routine confirmations. Source of truth is now `D:/FiveM_AutoDev/workspace-clean/flecity_jam` at 0.2.2-test; the inherited 0.2.1 candidate and older source were preserved. Other apps remain paused.
The current session can write to the test server. 0.2.2-test has been installed with verified backup/rollback, but JAM is not started: authenticated txAdmin UI input timed out. See docs/QA_JA.md and .flecity-dev/jam/continuation.json. Native Lua 5.4.8 now works; 97 local checks passed. Live multiplayer, listening and PTT remain unverified. The older hourly JAM automation remains disabled; no background work is promised.

## Historical instructions

The user's Flecity JAM instruction explicitly resumes this resource only. Other applications remain paused.
The subsequent 2026-11-16 instruction explicitly authorizes JAM installation/testing at D:\FiveM_Test_Server and continued improvements. This does not override tool filesystem restrictions. The initial directory creation was denied; deployment remains BLOCKED until the execution environment grants write access. Never route the same denied write through UI or another execution mechanism.
Keep runtime dependencies limited to FiveM OneSync. Do not modify WAVE, voice, server settings, existing DBs, or other applications.
Use the existing common development runner for static checks and checkpoints. This new resource is not enrolled in the legacy all-app scheduler; never start that scheduler.
An hourly JAM-only task is now enabled. Read .flecity-dev/jam/continuation.json for its current state; acquire the common mutex and preserve existing unrelated work. Do not restart any older automation.
Tests below are local simulations unless explicitly identified as live FiveM. No percentage or release-ready claim without real multiplayer, audio, PTT and soak evidence.
Keep runtime files, tests, docs and sample provenance together. Distribution excludes tests/devtools. Audio-source licenses must accompany distribution.
