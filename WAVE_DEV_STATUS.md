# WAVE development status

Branch: `wave/dev`
Test resource version: `0.3.0-test`

## Build and deployment

Run `wave-update.cmd` from the existing `D:\FiveM_Dev\application` checkout.
The CMD fetches the latest updater from `origin/wave/dev`; the updater reconstructs
the SHA-verified base/app, applies the SHA-verified v0.3 patch and the
`wave-v030-atomic-status.patch` safety patch, checks syntax where local
runtimes are available, stages, backs up, deploys, and verifies file hashes.
A failed deployment attempts to restore the previous resource.
After validation and duplicate-resource checks, the updater compares every generated
file with the installed resource using SHA256 (ignoring only `.wave-build.txt`).
If all files already match, it exits successfully **without copying files,
creating a backup, or requiring a resource restart**. A mismatch follows the
normal verified deployment and rollback path.

This branch currently stores its test resource as validated base64 parts plus
patches, not a complete source tree. Do not edit a deployed resource as the
source of truth. Future changes must update the reproducible build pipeline.

## Security invariants

- Only authorized server admins and Weazel bosses can access admin callbacks.
- Public track data must not expose the creator citizenid.
- Purchases debit QBox bank; earnings accrue to WAVE DB wallets.
- Creator payouts transfer to QBox bank only on explicit withdrawal.
- Artist-owned release actions must never override a concurrent admin suspension
  or restore a deleted release. The atomic-status patch adds SQL state predicates.
- Published tracks require a confirmed rights declaration and a valid project.

## Verification

Offline checks on the extracted v0.3.0 resource plus atomic-status, idempotent-save,
and rate-limit patches: `git apply --check`, `node --check`, Lua 5.3 parsing
of four Lua files, ten rate-limit cases, eight save cases, 33 callback-map
entries, and fifteen static security/compatibility assertions all passed.
The updater and the no-op test are ASCII-only and passed lexical delimiter
checks. Native PowerShell syntax and the five-case no-op regression still
need a working `pwsh` runner. GitHub Actions currently fails before
starting any steps; it must not be represented as passing CI.

Next in-game test after a successful `wave-update.cmd`:
`refresh`, `restart wave`, `wave_selftest`; publish one track and check
owner unpublish/republish. Verify that an admin-suspended track cannot be
republished or deleted by its creator.

Do not deploy to production until the in-game checks pass.
