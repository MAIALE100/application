# BASE test checklist

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

- Run `base_selftest` after an update and confirm all 6 checks pass, including `validators`.
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

- Two users updating the same stock item never silently overwrite each other.
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

# Deferred integrations

- Real bank / society transfers
- ox_inventory synchronization
- Payroll / time clock
- Reusable user-created workspace templates
- Job / gang / society linking
