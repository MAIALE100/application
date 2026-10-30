# BASE test checklist

## Automated custom-field regressions

Run from repository root:

```bash
lua5.4 flecity_base/tests/custom-fields.lua
```

This executes the actual Lua validation/persistence helpers against mocked query
results: Japanese/UTF-8 limits, malformed text rejection, explicit clears,
duplicate numeric field IDs, number/date/check validation, nil/false write
results, commit failure, and missing custom-field tables in the DB selftest.
It does not execute oxmysql, SQL transactions, or multiplayer concurrency.
See `CI_REVIEW_2026-10-30.md` for the current CI startup blocker and verification.

## Startup

1. Run `base-update.cmd`.
2. In txAdmin run `refresh` and `restart flecity_base`.
3. Run `base_selftest`.
4. Confirm BASE opens in LB Phone without a blank screen.

# Solo test pass

These checks can be completed by one tester on the test server.

## MY SPACE

- First launch creates exactly one MY SPACE.
- Reopening BASE does not duplicate MY SPACE.
- OWNER is displayed for the current character.
- MY SPACE cannot be renamed, deleted, left, or shared.

## Workspace creation and settings

- Create business, crew, team, project, and custom BASE types.
- Change BASE name, icon, and type from BASE settings.
- Changes survive `restart flecity_base`.
- Delete requires the exact BASE name.
- Deleting a BASE returns to another available BASE without breaking the UI.

## Memo

- Create, edit, and delete a memo.
- Add category and comma-separated tags.
- Search title, body, category, and tags.
- Filter by category.
- Pin/unpin directly from the memo card.
- Pinned notes sort above normal notes.
- Japanese text and line breaks render correctly.

## Stock

- Create an item with category, quantity, minimum stock, and unit.
- Test -10, -1, +1, +10 quick adjustments.
- Quantity never becomes negative.
- Low-stock filtering works.
- Category filtering works together with low-stock filtering.
- Custom quantity adjustment accepts a note.
- Per-item history shows actor, timestamp, before/after quantity, delta, and note.
- Recent cross-item activity updates.
- Edit item name/category/minimum/unit.
- Delete requires exact item name.
- Deleting an item also removes its item-specific movement history without a server error.

## Tasks

- Create a task with priority, assignee, due time, and details.
- Test explicit workflow labels: 開始 -> 完了 -> 再開.
- Edit task content.
- Delete task.
- Test all / 自分 / 期限切れ filters.
- Completed tasks are hidden by default and can be shown.
- Overdue tasks are visibly highlighted.

## Accounting

- Record income and expense.
- Balance equals income minus expense.
- Search by category, note, actor CSN, or amount.
- Filter by income/expense.
- Filter by category.
- Voided entries are hidden by default and can be shown.
- Void an entry and confirm totals exclude it.
- Create a custom calculator.
- Create 1 to 8 custom input fields.
- Use `v1` through `v8` in formulas.
- Test +, -, *, /, %, parentheses, decimals, and unary minus.
- Division by zero must show an error.
- Unknown variables must be rejected.
- Test floor / round / ceil / none.
- Test money and numeric results.
- Save calculator result directly to the ledger.
- Calculator remains after `restart flecity_base`.

## Overview dashboard

- BASE opens on the 概要 tab.
- Overview shows memo count, stock shortage count, open-task count, overdue-task count, and current ledger balance.
- Tapping 在庫不足 opens the stock tab with the low-stock filter active.
- Tapping the overdue task card opens tasks with the overdue filter active.
- Tapping memo or balance cards opens the matching module.
- Quick-add buttons open memo, stock, task, and accounting forms according to role permissions.
- Recent memo, task, stock movement, and accounting activity shows up to three rows per module.
- Empty workspaces show a simple activity-empty state.
- Switching between BASE workspaces refreshes all overview figures.

## Workspace icon picker

- New BASE creation shows categorized icon choices instead of a plain icon text field.
- BASE settings uses the same icon picker.
- 96 icon choices are available across work/business, team/crew, project, and other categories.
- Selecting an icon updates the preview immediately.
- The selected icon is saved and shown in the workspace pill and BASE information.
- Existing custom icons that are not in the predefined list remain selectable and are not overwritten.
- The icon list scrolls inside the modal without pushing the save/cancel actions off-screen.

## Guided first-use UI

- Empty memo, stock, task, and accounting pages explain what to create first.
- OWNER/MANAGER empty states expose the correct first-action button.
- Workspace status shows BASE type, current role, and member count.
- Members page shows BASE type, member count, creation time, and app version.
- Switching BASE workspaces updates the context display immediately.

## Large-list usability

- Memo shows total / matched / displayed counts.
- Memo supports updated-newest, updated-oldest, and title sorting.
- Stock supports text search plus category and low-stock filters.
- Stock supports name, low-stock priority, quantity, and recently-updated sorting.
- Task search matches title, details, assignee, and creator.
- Task supports due-date, priority, recently-updated, and title sorting.
- Accounting supports newest, oldest, amount-high, and amount-low sorting.
- Lists initially render 40-50 rows and use "さらに表示" for the rest.
- Switching to another BASE resets search/filter state so previous conditions do not hide the new BASE's data.
- Ledger browsing can retrieve up to 300 recent entries while still rendering 50 at a time.

## Invalid input / destructive safety

- Accounting rejects 0, negative, fractional, and values above 1,000,000,000.
- Stock rejects negative initial quantity, fractional quantity, and values above 1,000,000.
- Stock adjustment rejects zero, fractional deltas, below-zero results, and results above 1,000,000.
- Invalid task dates such as 2026-02-30 are rejected.
- Long text fields stop at their configured UI limit without breaking Japanese UTF-8 text.
- Rapidly clicking the same action does not create duplicate modal submissions.
- Memo deletion requires a confirmation dialog.
- Task deletion requires a confirmation dialog.
- Accounting void requires a confirmation dialog and remains as an audit record.
- Stock deletion requires exact item-name confirmation.
- BASE deletion requires exact BASE-name confirmation.

## Safety / persistence

- Run `base_selftest` after an update and confirm all 8 checks pass, including `validators`, `stock_txn`, and `custom_fields`.
- Restart only `flecity_base` and confirm existing data remains.
- Create several BASE workspaces and switch between them.
- Refresh the app repeatedly and confirm no duplicate MY SPACE is created.

## Creator attribution

- Memo cards show creator name and CSN.
- Stock items show who registered the item.
- Stock recent activity and item history show who changed quantity.
- Tasks show who created the task separately from the assignee.
- Accounting entries show who recorded the entry.
- Existing rows are backfilled from current BASE membership where possible.
- Creator names remain readable after restart.

# Deferred multi-user / production-role tests

These should not block solo development.

## Membership

- Invite another citizenid.
- Accept and decline invitations from the second character.
- MEMBER can leave.
- OWNER can remove MEMBER.
- Removed users lose API access.

## MANAGER

- OWNER promotes MEMBER -> MANAGER.
- OWNER demotes MANAGER -> MEMBER.
- MANAGER can invite and remove ordinary MEMBER accounts.
- MANAGER cannot promote/demote roles.
- MANAGER cannot remove another MANAGER.
- MANAGER cannot rename or delete the BASE.
- MEMBER management restrictions are enforced server-side.

## Concurrent access

- The development build requires oxmysql v2.12.0+ with `MySQL.startTransaction` support (`base_selftest` reports `stock_txn PASS`).
- Two users updating the same stock item never silently overwrite each other.
- Run simultaneous +1 and -1 adjustments on the same item; final quantity matches the sum of successful operations and each movement has the correct before/after chain.
- Force a movement insert failure on a disposable test DB: the stock quantity change must roll back. Do not intentionally break the production database.
- Create an item with nonzero initial quantity; its initial movement must exist, otherwise item creation must roll back.
- Simultaneously accept invitations when a workspace has only one free slot: at most one acceptance may succeed, and no workspace exceeds the configured member cap.
- Simultaneously invite multiple citizenids near the pending-invite cap; the cap must not be exceeded.
- Repeatedly accept the same invite: exactly one membership is created, with the invite ending in accepted status.
- Forged workspace IDs return NOT_A_MEMBER.
- Assignee restrictions work for another citizenid.

## ADMIN / WEAZEL SUPPORT

- ADMIN with ACE `flecity.base.admin` sees all BASE workspaces at all times.
- Eligible WEAZEL maintainer sees only normal memberships while SUPPORT is OFF.
- WEAZEL SUPPORT ON exposes all BASE workspaces.
- SUPPORT OFF immediately returns to normal visibility.
- Reconnect resets WEAZEL SUPPORT to OFF.
- Non-member global workspace opens are written to `flecity_base_access_audit`.
- WEAZEL SUPPORT ON/OFF changes are written to `flecity_base_access_audit`.
- An ADMIN or WEAZEL maintainer who is also a normal member retains their global maintenance permissions while the global mode is active.
- Character unload or WEAZEL job change clears active support access without requiring a disconnect.

# Deferred integrations

- Real bank / society transfers
- ox_inventory synchronization
- Payroll / time clock
- Reusable user-created workspace templates
- Job / gang / society linking


## Submission package

- Run `base-package.cmd` from the repository root.
- The package must contain a single `flecity_base` resource folder.
- The package must not contain `base-update.*`, development machine paths, `INSTALL.md`, or `TESTING.md`.
- Packaged `config.lua` uses `FlecityBaseConfig.Debug = false`.
- `OPERATOR_GUIDE.md` and `ACCESS.md` are included.
- The package passes Lua/JavaScript/CSS safety checks when the corresponding local tools are available.

## Automation scope

GitHub Actions checks Lua syntax, JavaScript syntax, CSS compatibility, packaging files, and static source regression guards. These cannot prove SQL row-lock behavior, complete transaction rollback, or correctness with two real FiveM players; the above live checks remain required.

## Custom stock field smoke test (v0.11.0-dev; test server only)

1. After running `base-update.cmd` and restarting only `flecity_base`, run `base_selftest` and verify **8/8 PASS**.
2. In LB Phone, open BASE → an existing BASE or MY SPACE → 在庫 → 項目設定.
3. Create the fields `保管場所` (文字), `単価` (数値), `入荷日` (日付), `確認済み` (チェック).
4. Create an item with initial quantity 5 and custom values. Confirm the item card displays all extra fields and stock movement history shows initial 5.
5. Open item 設定 and edit every extra value. Switch BASEs, return, and confirm data is retained.
6. Hide `単価`, verify it disappears for regular members; show it again and verify the saved value reappears.
7. Restart only `flecity_base` and confirm all values, field definitions, and visibility survive.
8. On a disposable BASE, test invalid dates, numbers above the range, more than 2 decimal places, a seventh field, duplicate field names, and other users' workspace IDs.
9. Two connected testers should adjust the same stock item concurrently; quantity and movement history must agree. A second tester invited as MEMBER can view custom fields but cannot define or hide them.
10. Do not run destructive DB fault-injection on the main Flecity server. Restore test data or delete disposable workspaces only after checking their contents.

Release remains **on hold** until live FiveM/MariaDB testing and CI status are resolved.

