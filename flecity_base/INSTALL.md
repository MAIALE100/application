# BASE test installation

Requirements:

- QBox
- oxmysql
- LB Phone

The resource creates its own tables at startup.

## Test server

From `D:\FiveM_Dev\application` run:

```
.\base-update.cmd
```

Then in txAdmin console:

```
ensure flecity_base
```

For later updates:

```
restart flecity_base
```

Run:

```
base_selftest
```

The current development updater deploys to:

`D:\FiveM_Test_Server\txData\Qbox_D233FD.base\resources\[lb-phone]\flecity_base`

Set the environment variable `FLECITY_BASE_TARGET` to override that destination.

## Production submission

Production packaging will be generated separately after live testing. The production package must not contain development updater scripts or machine-specific paths.


## Production access configuration

To give the server ADMIN group always-on BASE maintenance access:

```
add_ace group.admin flecity.base.admin allow
```

WEAZEL SUPPORT normally detects the configured QBox `weazel` job and boss flag. If the production server needs an explicit maintenance principal instead, grant:

```
add_ace <principal> flecity.base.weazel_support allow
```

Review `config.lua` and `ACCESS.md` before production submission.
