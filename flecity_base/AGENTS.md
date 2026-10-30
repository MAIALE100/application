# BASE — Codex 作業指示 (scope: flecity_base/)

## Purpose and environment

BASE is a Flecity FiveM application integrated as an independent LB Phone resource, built for QBox 2.5.4, oxmysql, LB Phone 2.9.0, and `citizenid` (CSN). Its goal is to stay simple by default while allowing optional custom stock fields and later other workspace customizations.

Codex owns implementation, test execution, code review fixes, and concise developer reports. The human operator owns FiveM in-game tests, production access, and release approval. Do **not** interpret a green static test as a successful live FiveM test.

## Branch and release safety

- Work on a dedicated task branch based on `base/workspace-dev` and open a reviewable pull request targeting `base/workspace-dev`. Do not target or merge into `main` or `release/base-v0.10.0-beta.1` without explicit approval.
- Operator submission is **on hold**. Do not generate an operator ZIP, enable automatic release workflows, deploy to Flecity production, or edit server.cfg as part of ordinary tasks.
- Do not modify other apps/resources (LOOP, LINK, WAVE, PuriPhoto, Puribooth, etc.) unless the task specifically requests them.
- Preserve all existing BASE data. Prefer additive/idempotent SQL migrations; never drop or rewrite production records automatically.
- The bank, job society account and ox_inventory are out of scope. Stock and accounting are **internal ledgers only**; no real item or bank/society money changes.

## Access-control invariants

- A normal member can view permitted workspace records, adjust stock, use calculators, and record accounting; the OWNER/MANAGER administers structures and field definitions.
- No API may trust client-provided roles, source identity, field types, or another workspace's record IDs. Authenticate using the server's current QBox source -> citizenid, then check both workspace membership/role and record ownership.
- Global ADMIN access requires `flecity.base.admin` ACE. WEAZEL support is eligible via configured boss/grade or its specific ACE, and global access must be manually switched ON; no broad grants to regular WEAZEL employees.
- WEAZEL support clears on disconnect, character unload, job updates or resource restart. Maintenance actions involving nonmember workspaces should be auditable.
- Keep `MY SPACE` personal and unshareable.

## Project structure

- `config.lua` — limits, templates, special permissions.
- `client/main.lua` — LB Phone custom app registration, NUI ↔ LB Phone callbacks.
- `server/framework.lua` — QBox player and job APIs.
- `server/database.lua` and `sql/schema.sql` — DB bootstrap and schema reference; keep in sync.
- `server/main.lua` — authenticated, authorized server callbacks.
- `server/custom_fields.lua` — optional stock field validation and persistence.
- `web/app.js`, `web/app.css`, `web/index.html` — small-screen NUI.
- `tests/source-regression.mjs`, `TESTING.md`, `HYBRID_ROADMAP_JA.md` — regression checks, manual tests, longer-term scope.
- Updater lives at repo root: `base-update.cmd` / `base-update.ps1`. It is intended for a Windows **test** server, not for Codex Cloud.

## Implementation standards

1. Read relevant source files and `HYBRID_ROADMAP_JA.md` / `TESTING.md` before patching.
2. Implement a self-contained change that improves stability or an explicitly requested feature; keep the existing phone UI usable without configuring custom fields.
3. Validate user values, limits, date/number formats and HTML escaping. Use parameterized SQL; never concatenate user-controlled SQL or run untrusted formula code.
4. Inventory quantity and history, initial stock and history, and invited-member inserts/acceptance should remain atomic where necessary. Keep a consistent locking order in concurrent writes. Test transaction failure paths in a disposable database, not Flecity production.
5. Preserve BASE module boundaries and avoid unnecessary polling, network requests, DB work, or new dependencies.
6. No secrets, tokens, personal CSNs or environment-specific local paths in commits or logs.

## Verification to perform autonomously

Run as many as the available environment supports and include exact results:

```bash
node --check flecity_base/web/app.js
node flecity_base/tests/source-regression.mjs
find flecity_base -name '*.lua' -print0 | xargs -0 -r -n1 luac5.4 -p
```

- Verify `fixBlur=true` CSS does not introduce `px` units.
- Verify server and client callback names agree, schema is reflected in both `database.lua` and `schema.sql`, and resources listed in `fxmanifest.lua` exist.
- Investigate GitHub Actions failures without claiming they passed; if no job steps/logs are available, report a CI infrastructure/setup blocker explicitly.
- If a test dependency is unavailable, report "NOT RUN" and why; never report an unexecuted test as PASS.
- Do not run `base-update.cmd`, `txAdmin`, `base_selftest`, or a production migration from the cloud. Collect these as final human test instructions only when needed.

## Pull-request deliverable

Summarize changed files, reason for changes, test commands and outcomes, safety impact, known risks, and the **minimal** remaining cmd/txAdmin/phone steps. Ask the human for live input only once static verification and readily automatable fixes are complete.

## Current next task

Read `CODEX_NEXT_TASK.md`. Prioritize fixing/validating CI and Lua transaction API assumptions, then any regressions in v0.11.0-dev stock optional fields, before expanding custom fields to tasks/accounting.
