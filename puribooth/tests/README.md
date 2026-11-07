# Isolated FLEPURI tests

`node tests/run-collection-recovery.integration.mjs` runs the production `config.lua` and `server/main.lua` through Fengari against an in-memory transactional MySQL adapter and mock Renewed-Banking exports. It exercises sale collection, ambiguous bank results, retry/idempotency, restoration/finalization failure, re-entrant lock contention, and routing-bucket helpers. It never connects to MariaDB or a bank resource and is not a FiveM runtime test.

Fengari is an optional test-only Lua 5.3 runtime; it is not a resource/runtime dependency. If Fengari is not on `PATH`, set `FENGARI_NODE_SCRIPT` to `fengari-node-cli/src/lua-cli.js`. Example in PowerShell:

```powershell
$env:FENGARI_NODE_SCRIPT = 'C:\path\to\node_modules\fengari-node-cli\src\lua-cli.js'
node .\tests\run-collection-recovery.integration.mjs
```

Also run the existing source guard tests with `node --test tests/*.test.mjs`. Database/export semantics and real owner permissions remain subject to the operator's isolated MariaDB and test02 verification.
