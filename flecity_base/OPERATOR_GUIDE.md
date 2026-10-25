# BASE operator guide

BASE is an independent LB Phone resource for Flecity.

## Runtime requirements

- QBox 2.5.4 or compatible QBox build
- oxmysql
- LB Phone
- citizenid is used as the player identifier

## Installation

1. Place the `flecity_base` folder in a server resources directory.
2. Ensure dependencies start before BASE.
3. Add `ensure flecity_base` to the server resource startup configuration.
4. Start or restart `flecity_base`.
5. Run `base_selftest` from the server console.

BASE creates and migrates its own database tables. Manual SQL import is not required for normal installation.

Expected self-test:

```
qbx_core     PASS
lb-phone     PASS
oxmysql      PASS
database     PASS
callbacks    PASS
validators   PASS
```

## Access configuration

Recommended ADMIN mapping:

```
add_ace group.admin flecity.base.admin allow
```

WEAZEL SUPPORT can use either the configured QBox WEAZEL boss role or a dedicated ACE:

```
add_ace <principal> flecity.base.weazel_support allow
```

WEAZEL SUPPORT is OFF by default and is session-only. Global maintenance access is audited in `flecity_base_access_audit`.

See `ACCESS.md` for the complete role model.

## Data behavior

BASE uses its own tables with the `flecity_base_` prefix.

- MY SPACE is created automatically per citizenid.
- Workspaces are independent from QBox job/gang registration.
- Stock is an internal ledger and does not modify ox_inventory.
- Accounting is an internal ledger and does not move real bank/society money.
- Creator/operator names and citizenids are retained for auditability.

## Update procedure

1. Back up the database according to normal server procedures.
2. Replace the `flecity_base` resource files with the new release.
3. Run `refresh`.
4. Run `restart flecity_base`.
5. Run `base_selftest`.

Database migrations run automatically on resource startup.

## Removal

Stopping or removing the resource does not automatically drop BASE database tables. This is intentional to avoid accidental data loss.
