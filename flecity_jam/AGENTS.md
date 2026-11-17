# Flecity JAM scope (2026-11-16)

## Current handoff — 2026-11-17

0.3.1-test is installed and started on Test_01. Fixed source7e97bade passed132 local checks; installed81/81, previous0.3.0 backup81/81, copy rollback81→81→81, protected5304 files+5 configs+txAdmin unchanged. Receipt jam-update-1ed9e34d/receipt.json SHA2562563ad116ebad748cf386c1144b0a903b7c95732fb7b12ca9c5f8477052d31ed. The latest package, QA and three notebook steps are in outputs/FLECITY_JAM_20261116/piano-keyboard-20261117/ in the original chat workspace. Actual FiveM keyboard/audio/U-J/PTT remain NOT_RUN; do not launch desktop FiveM. Other FLECITY apps stay paused. Read this newer handoff before the historical candidate notes below.

The active 0.3.1-test task replaces default chromatic36 with JAM-specific piano25 white/black rows. Preserve legacy18/expanded36 presets and custom settings; write only v3 preferences, leaving v1/v2 bytes unchanged. Use ArrowUp/ArrowDown and screen controls for octave changes in all presets; Z/X are notes. Reserve N/CapsLock/PTT and system keys, and use letter/digit positions for the JIS-safe default. Current docs describe a candidate: record fresh test counts and deployment receipts instead of carrying over 0.3.0 results. The installed 0.3.0 baseline and all81 files are preserved under piano-keyboard-20261117. Live FiveM input/audio/PTT acceptance remains user-notebook-only NOT_RUN. Do not start the desktop FiveM client or change other paused apps.

The current keyboard/input improvement task is based on installed 0.2.2-test and Git e6e26c7a, verified across all 81 installed files with a full backup. The 0.3.0-test candidate is developed in the attached managed JAM worktree; do not overwrite it with the older AutoDev copy. Use the latest QA, deployment receipt and Git source hashes to determine whether installation is complete. Keep other apps paused and preserve config.lua, samples, Voice and DB. Local keyboard/browser checks do not prove live U/J suppression or PTT coexistence.

0.3.0-test is now installed on Test_01: 81/81 hashes, config and sample preservation, rollback simulation, and server jam_status verified. Local checks are 122/122 PASS. The user will perform live FiveM acceptance on their travel notebook. Do not launch or perform FiveM acceptance on this desktop again; the agent-launched client and launcher were closed. Live U/J, PTT/radio and audio remain NOT_RUN. See outputs/FLECITY_JAM_20261116/input-keyboard-20261117/ in the original chat workspace and docs/QA_JA.md.

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
