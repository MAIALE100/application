# BASE v0.1 test checklist

## Startup

1. Run `base-update.cmd`.
2. In txAdmin use `ensure flecity_base` on first install, or `restart flecity_base` after updates.
3. Run `base_selftest`.
4. Confirm BASE appears in LB Phone and opens without a blank screen.

## Personal workspace

- First launch automatically creates **MY SPACE**.
- MY SPACE cannot invite members, be left, renamed, or deleted.
- Reopening BASE must not create duplicate MY SPACE records.

## Workspace

- Create business, crew, team, project, and custom workspaces.
- Rename a user-created workspace.
- Invite a second citizenid and accept/decline from that character.
- OWNER can remove a MEMBER.
- MEMBER can leave.
- Delete requires the exact workspace name.
- Deleting a workspace removes all child data through foreign-key cascades.

## Memo

- Create, edit, pin, and delete.
- Japanese text and line breaks display correctly.
- Deleted notes no longer appear.

## Stock

- Create an item with initial quantity and minimum stock.
- +1 / -1 updates the quantity.
- Quantity cannot become negative.
- Low-stock badge appears at or below the minimum.
- Custom adjustments accept notes.
- History shows actor CSN, timestamp, before/after quantity, delta, and note.

## Tasks

- Create tasks with priority, assignee, due time, and details.
- Move todo -> doing -> done -> todo.
- Edit and delete tasks.
- A non-member citizenid cannot be assigned.

## Money

- Record income and expense.
- Balance equals income minus expense.
- Actor CSN is displayed.
- OWNER can void an entry without deleting its audit record.
- MEMBER cannot void entries.

## Custom calculators

- OWNER can create a calculator for the current BASE.
- Create 1 to 8 input fields with custom labels, units, and default values.
- Formula variables use `v1` through `v8`.
- Supported operators: `+`, `-`, `*`, `/`, `%`, and parentheses.
- Test unary minus and decimal values.
- Division by zero shows an error instead of Infinity/NaN.
- Unknown variables are rejected by the server.
- Test rounding modes: floor, round, ceil, none.
- Test result formats: money and number with a custom unit.
- MEMBER can use saved calculators but cannot create/edit/delete them.
- OWNER can edit and delete saved calculators.
- Calculators remain after restarting `flecity_base`.

## Multi-user checks

- Two users changing the same stock item should never silently overwrite each other.
- A user removed from a BASE must immediately lose API access after the next request.
- A forged workspace id must return NOT_A_MEMBER.

## Deferred from v0.1

- Real bank/society transfers
- ox_inventory synchronization
- Custom roles and granular permissions
- Payroll / time clock
- Reusable user-created templates
- Job / gang / society linking
