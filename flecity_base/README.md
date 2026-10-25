# BASE

BASE is a shared workspace application for Flecity's LB Phone.

## v0.1 development scope

- Automatic personal `MY SPACE`
- User-created workspaces for businesses, crews, teams, projects, and custom groups
- Role model: OWNER / MANAGER / MEMBER
- Invite, accept, decline, leave, remove member
- Shared memo
- Inventory ledger with change history
- Task management
- Accounting ledger with non-destructive voids
- User-defined calculators saved per workspace (1-8 inputs, formulas, rounding, money/number output)
- QBox citizenid identity
- oxmysql persistence
- LB Phone custom app registration
- Console self-test

## Design rules

BASE is not tied to a QBox job or gang. A legal company, informal crew, racing team, media team, or other group can use the same workspace model.

v0.1 does **not** move real bank money and does **not** synchronize ox_inventory. Accounting and stock are ledgers only. This keeps the initial release low-risk and portable for server operators.

Future modules can add custom roles/permissions, payroll/time tracking, reusable templates, and optional job/gang/society integrations.

## Test command

From the server console:

```
base_selftest
```

Expected result: all checks PASS.


## Access model

- OWNER: workspace creator and full workspace administrator.
- MANAGER: delegated day-to-day management.
- MEMBER: normal shared-workspace user.
- ADMIN: server-wide always-on maintenance access through ACE.
- WEAZEL SUPPORT: server-wide maintenance access that must be explicitly switched ON by an eligible WEAZEL owner/maintainer.

See `ACCESS.md` for server configuration and privacy/audit behavior.
