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
