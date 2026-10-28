# WAVE development status

Branch: `wave/dev`
Test resource version: `0.3.6-test`

## Build and deployment

Run `wave-update.cmd` from the existing `D:\FiveM_Dev\application` checkout.
The CMD fetches the latest updater from `origin/wave/dev`; the updater reconstructs
the SHA-verified base/app, applies the SHA-verified v0.3 patch and the
`wave-v030-atomic-status.patch` safety patch, v0.3.1 release-action feedback, v0.3.2 duplicate-release guard, v0.3.3/0.3.4 studio extras and v0.3.5 long-score navigation and v0.3.6 selected-track range editing, checks syntax where local
runtimes are available, stages, backs up, deploys, and verifies file hashes.
Before replacing the installed resource, staging and the backup are SHA256-verified
against their source trees (including build metadata). A failed deployment
attempts to restore the previous resource and verifies the restored files.
The CMD and updater now pin the bootstrap script, base package, app and patches to
one immutable Git commit, avoiding mixed-version builds if another process fetches.
After validation and duplicate-resource checks, the updater compares every generated
file with the installed resource using SHA256 (ignoring only `.wave-build.txt`).
If all files already match, it exits successfully **without copying files,
creating a backup, or requiring a resource restart**. A mismatch follows the
normal verified deployment and rollback path. The updater now rejects
symlinks/junctions inside the installed resource and at the backup root
before copying or deleting anything, including broken links. The guard is
also rechecked before replacing or restoring a resource. The path guard
now also rejects existing and dangling symlinks/junctions in ancestor folders
(such as the [lb-phone] directory), not only inside the resource or backup.
Backup retention
now inspects each expired backup's entire tree and skips candidates containing
nested junctions/symlinks instead of risking recursive deletion through a link.
It also rechecks the backup root at cleanup time and before each deletion to
reject a root replaced with a symlink/junction after deployment preflight.
A regression test checks that a linked backup root cannot prune external data.
Deployment now rechecks the installed resource against its verified backup
immediately before replacement. If a file changed after backup, or a destination
appeared during a first install, the update aborts before setting the rollback
flag; newer files are not overwritten by an unnecessary restore. This is a
best-effort preflight, not a cross-process filesystem transaction.
First-install rollback now also validates the destination for reparse points
immediately before removing an incomplete installation, so a swapped junction
or symlink is rejected rather than recursively deleted. The path-safety regression
asserts this rollback guard is present and ordered before deletion.
First-install rollback now also requires proof that the updater's Move-Item
completed and that the destination still matches the validated build, including
the absence of extra files. If another process creates the destination during
the move, or changes files before rollback, the updater preserves the directory
instead of deleting data it cannot prove it owns. The deployment preflight
regression covers both owned and unowned first-install rollback cases.
Existing-install rollback now checks whether the destination is still the verified
previous resource or the updater's staged build. An intact previous resource is
left alone; a missing destination or unchanged staged build can be restored.
If files were changed or added after deployment began, rollback preserves the
destination rather than deleting data it cannot prove it owns. This is a
best-effort check, not an atomic filesystem operation; such a failed update
may require manual recovery from the verified backup.

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

The studio extras and v0.3.5 score-tools SHA256 values are pinned in both the Windows updater and GitHub Actions. The `wave-v033-integrity-test.py` regression checks both source hashes, verifies that score-tools is deployed and tested in CI, and compares the combined ordered CSS rules from both CI append steps against the Windows updater. This prevents stale hashes or split CSS blocks from silently breaking updates. Navigation controls do not change saved project format.


Offline checks on the extracted v0.3.0 resource plus atomic-status, idempotent-save,
and rate-limit patches: `git apply --check`, `node --check`, Lua 5.3 parsing
of four Lua files, ten rate-limit cases, eight save cases, 33 callback-map
entries, and fifteen static security/compatibility assertions all passed.
The updater, bootstrap, and PowerShell regression tests are ASCII-only. Source
commit pinning has a dedicated regression test. The path-safety guard has
its own PowerShell regression for ordinary trees, nested links, dangling links,
linked resource roots, linked backup roots, and linked or dangling
ancestor directories. The no-op regression now
also covers strict backup verification and metadata integrity. The backup-retention
regression now covers nested symlink candidates and verifies that unrelated
targets are preserved while ordinary expired backups are pruned. Native PowerShell
syntax and these cases, including the new deployment preflight regression,
and the existing-install rollback ownership regression still need a working `pwsh` runner.
The rollback test now uses a literal PowerShell search string for the
`$rollbackAction -eq 'preserve'` guard; its previous double-quoted string
expanded the variable and caused a false failure. GitHub Actions currently fails before
starting any steps; it must not be represented as passing CI.

Next in-game test after a successful `wave-update.cmd`:
`refresh`, `restart wave`, `wave_selftest`; publish one track and check
owner unpublish/republish and confirm that each action shows an inline
success/error result. Verify that an admin-suspended track cannot be
republished or deleted by its creator.

Do not deploy to production until the in-game checks pass.

## Navigation refinement (2026-10-29)

Studio quick navigation now offers four- and eight-bar jumps. Jumps are
clamped to the existing 1-128-bar range and do not modify notes or saved
projects. Estimated duration rounds up to whole seconds, matching the
server's published-track duration calculation. Pure navigation boundary
regressions are covered by `wave-v035-score-tools-test.js`.

After the next normal `wave-update.cmd`, check the four- and eight-bar
buttons near the first and last bar; no new server commands are needed.

## Range editing (2026-10-29)

Studio supports 4/8-bar copy, paste and range clear on the selected track.
The clipboard is in-memory and scoped to the current project; switching
projects invalidates it. A paste that would exceed the song length is
rejected without truncating notes. Edits use the existing undo stack and
local-draft saving, with no change to project JSON or server financial flows.
The new pure-function regression covers overlapping ranges, empty clips,
end-of-song boundaries, immutable source notes and invalid inputs.

Next in-game check: run `wave-update.cmd` once, open a test project of at
least 12 bars, copy 4 bars, paste into a different 4-bar region, undo,
then repeat with 8 bars and check the last bar rejects overflow.
Only restart the WAVE resource if the updater reports deployed changes;
no full server reboot is required. Do not use an irreplaceable project for
this first UI test.

## Range-edit paste preview (2026-10-29)

The selected 4/8-bar window now displays its note count, and the paste target
previews how many notes will be overwritten and inserted. Paste is disabled
with an explanation when the resulting track would exceed 8192 notes, or
when the copied range would overrun the song. This is a UI-only change with
no modification to save JSON, server, financial, publish, or undo behavior.
The preview refreshes on toolbar focus/hover after track selection changes.
Regression tests cover invalid targets and the 8192-note boundary.

## Empty-range clear refinement (2026-10-29)

The selected-track 4/8-bar clear button is disabled when its window contains
no notes. The pure clear helper returns the original notes array for empty
windows, avoiding unnecessary allocations and preserving no-op identity.
This does not change the project save schema, Undo behavior for actual edits,
or any banking, permission or release code. Regression cases cover empty and
nonempty windows. No additional in-game action is required beyond the existing
range-edit smoke test after the next successful normal update.
