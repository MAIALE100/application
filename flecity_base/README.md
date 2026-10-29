# BASE

BASE is a shared workspace application for Flecity's LB Phone.

It is designed for businesses, crews, teams, projects, informal groups, and personal use without requiring a QBox job or gang registration.

## Current feature set

- Automatic personal `MY SPACE`
- Overview dashboard for shortages, tasks, balance, and recent activity
- User-created BASE workspaces with a categorized workspace icon picker
- OWNER / MANAGER / MEMBER role model
- ADMIN and opt-in WEAZEL SUPPORT maintenance access
- Invite / accept / decline / leave / remove member
- Shared memo with pinning, category, tags, search, and sorting
- Inventory ledger with creator/operator attribution and movement history
- Transaction-locked inventory creation/adjustments: quantity and movement log commit or roll back together
- Serialized workspace invitation/acceptance to preserve membership limits under concurrent use
- Task management with assignee, due date, priority, filters, search, and sorting
- Accounting ledger with creator attribution, summaries, search, filters, sorting, and non-destructive voids
- User-defined calculators saved per workspace
- Incremental list rendering for large datasets
- Automatic database creation and migrations
- Console self-test including validation checks
- Clean operator submission packaging

## Design boundaries

BASE intentionally does not move real bank/society money and does not synchronize ox_inventory.

Accounting and stock are internal ledgers. This keeps the resource portable and reduces the risk of affecting server economy or inventory data.

## Runtime

- QBox
- oxmysql **v2.12.0 or newer** (development build uses the experimental `MySQL.startTransaction` API; validate compatibility before deployment)
- LB Phone
- citizenid identity

## Test command

From the server console:

```
base_selftest
```

Expected result: all checks PASS (including `stock_txn` for the transaction API). Static CI guards do not replace a live MariaDB / multiplayer test.

## Access model

- OWNER: workspace creator and full workspace administrator.
- MANAGER: delegated day-to-day management.
- MEMBER: normal shared-workspace user.
- ADMIN: server-wide always-on maintenance access through ACE.
- WEAZEL SUPPORT: server-wide maintenance access that must be explicitly switched ON by an eligible maintainer.

See `ACCESS.md` for configuration and audit behavior.

## Operator installation

See `OPERATOR_GUIDE.md`.

## Large-list behavior

Memo, stock, task, and ledger pages support search/filter/sort controls and incremental rendering so the phone UI does not create hundreds of cards at once.
