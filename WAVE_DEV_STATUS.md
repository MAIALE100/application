# WAVE development status

Branch: `wave/dev`
Test resource version: `0.3.3-test`

## Build and deployment

Run `wave-update.cmd` from the existing `D:\FiveM_Dev\application` checkout.
The CMD fetches the latest updater from `origin/wave/dev`; the updater reconstructs
the SHA-verified base/app, applies the SHA-verified v0.3 patch and the
`wave-v030-atomic-status.patch` safety patch, v0.3.1 release-action feedback, v0.3.2 duplicate-release guard, and v0.3.3 studio extras, checks syntax where local
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

The v0.3.3 studio extras SHA256 is pinned in both the Windows updater and GitHub Actions. The `wave-v033-integrity-test.py` regression checks both pins against the actual asset, preventing a UI-only edit from making `wave-update.cmd` fail before deployment. The bar navigator is UI-only and does not change saved project format.


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
