# FLEPURI release checklist

## Runtime
- [x] QBox 2.5.4 / oxmysql integration
- [x] booth DB auto schema
- [x] admin place / remove / list
- [x] cash / bank charge and refund paths
- [x] fixed-camera 4-shot capture
- [x] background / floor presets and custom image conversion
- [x] multi-booth session isolation
- [x] participant theme / countdown isolation
- [x] PuriBooth editor
- [x] PuriPhoto handoff
- [x] interaction ring and placement direction preview
- [x] legacy booth auto-spawn disabled

## Performance / cleanup
- [x] decoration canvas base-layer cache
- [x] freehand incremental drawing
- [x] stamp drag / eraser RAF throttling
- [x] duplicate editor keyboard listener removed
- [x] background image sync uses latent events
- [x] idle booth loop sleeps when no booth is nearby
- [x] PuriPhoto release build forces empty dist before build
- [ ] run final fresh PuriPhoto production build and confirm generated size

## External dependencies
- [ ] confirm qbx_core is available on Flecity
- [ ] confirm oxmysql is available on Flecity
- [ ] confirm lb-phone is available on Flecity
- [ ] confirm screenshot-basic is started on Flecity
- [ ] confirm target PuriPhoto version / replace with bundled compatible PuriPhoto

## Fonts / licensing
- [x] PopRum Kiwi Telop identified as SIL OFL 1.1
- [x] Gal Moji Gothic Free identified as SIL OFL 1.1
- [x] Hachi Maru Pop identified as SIL OFL 1.1
- [x] Hitori Gothic distribution page permits embedding and states SIL OFL
- [x] replace Heisei Joshi Font with redistributable OFL alternatives
- [x] exclude font binaries from operator ZIP and provide official download links instead

## Final validation
- [ ] verify collection retry and review commands reject concurrent payout / recovery calls
- [ ] verify finalizing_retry / restoring_retry are idempotent with a disposable DB transaction test
- [ ] verify ambiguous bank export results remain paying until manual transaction-history review
- [ ] verify okokBanking AddMoney return behavior and transaction-history export resource for the target version
- [ ] verify parallel booths and capture sessions are isolated across routing buckets
- [ ] verify non-weazel player cannot place / remove / change price / view sales
- [ ] verify weazel player can place / remove / change price
- [ ] verify each booth keeps an independent price after restart
- [ ] verify successful capture increments only that booth's balance / lifetime / count
- [ ] verify refunded sessions do not increment sales
- [ ] verify /puribooth sales totals match per-booth totals
- [ ] verify highest-grade weazel owner can run /puribooth collect all
- [ ] verify normal weazel cannot run /puribooth collect
- [ ] verify ACE group.admin / group.god cannot bypass collection restriction
- [ ] verify /puribooth collect all deposits once and clears only claimed balances
- [ ] verify failed company-bank payout restores booth balances
- [ ] fresh-install test with empty puribooth tables
- [ ] one-player full flow: pay -> theme -> camera -> 4 shots -> edit -> PuriPhoto -> save
- [ ] cancellation / refund test
- [ ] resource restart refund test
- [ ] two-player shared background / floor test
- [ ] two booths used simultaneously with different themes
- [ ] booth remove / restart / persistence test
- [ ] puribooth_selftest confirms management_job=PASS and payout=PASS
- [ ] puribooth_selftest PASS on final operator-like environment
- [ ] verify no legacy test booth appears after restart

## Operator ZIP
- [ ] clean PuriPhoto build
- [ ] decide font permission / replacement
- [ ] stage only runtime files + README + licenses
- [ ] include operator install / config notes
- [ ] create ZIP
- [ ] extract ZIP into a clean folder and verify contents
- [ ] final SHA / version tag
