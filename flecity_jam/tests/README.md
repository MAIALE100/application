Run from the project root: `node devtools/flecity/cli.mjs test flecity_jam --suite static`.
This uses the existing common runner and logs without touching other applications.

Standalone JS: `node --test tests/model.test.mjs` from this resource.
Native Lua 5.4: `lua5.4 tests/engine.lua` and `lua5.4 tests/client.lua` from this resource.
The existing environment can alternatively run these with Fengari. That is a Lua 5.3 simulation, not a native FiveM result.

Browser: `node tests/browser.mjs` uses the existing `.flecity-dev/local.json` browser configuration, or `JAM_PLAYWRIGHT_MODULE`, or an installed `playwright` package and its Chromium. It fulfills local assets in-process; no external server/network is required. `JAM_SOAK_SECONDS=120` enables a two-minute real-time audio soak with eight simulated performers. Screenshots/results go to `.flecity-dev/jam/browser/`.

Do not run `test all` or the legacy app scheduler: other Flecity applications remain paused.
Live acceptance: `docs/LIVE_CHECKLIST_JA.md`. All live checks remain NOT_RUN.
