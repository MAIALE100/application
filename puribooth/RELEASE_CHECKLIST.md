# FLEPURI v1.0.1 release checklist

## Static / automated validation
- [x] FLEPURI resource version 1.0.1
- [x] PuriPhoto compatibility runtime version 1.1.1
- [x] QBox 2.5.4+ compatibility floor declared
- [x] DB auto schema + schema selftest
- [x] per-booth accounting invariant selftest
- [x] Weazel management checks are server-side
- [x] cash / bank payment paths are server-side
- [x] duplicate booth/player start locks
- [x] sale-record failure refund fallback
- [x] pre-capture disconnect refund uses citizenid
- [x] background payload JPEG-only / size limit / cooldown
- [x] 1 -> 2 -> 3 -> 4 countdown sequence enforced server-side
- [x] premature captureComplete rejected
- [x] PuriPhoto version / index / JS / CSS / client bridge preflight
- [x] PuriPhoto two-phase get -> render -> confirm -> receipt handoff
- [x] handoff timeout keeps FLEPURI edit state
- [x] PuriPhoto handoff can be cancelled on timeout
- [x] production bundle contains boothImportAvailable
- [x] production bundle contains puriphotoGetBoothImport
- [x] production bundle contains puriphotoConfirmBoothImport
- [x] PuriPhoto package / lock root metadata aligned
- [x] production index has no external Google Fonts dependency
- [x] Renewed-Banking account existence selftest
- [x] Renewed-Banking collection history integration
- [x] company payout failure restores claimed booth balance
- [x] font binaries excluded from operator package
- [x] release packager verifies ZIP and SHA256
- [x] JavaScript syntax checks pass
- [x] Lua structural checks pass
- [x] NUI callback wiring checks pass
- [x] client/server event wiring checks pass
- [x] Config reference/definition checks pass

## Runtime acceptance on FiveM
- [ ] puribooth_selftest PASS on operator-like environment
- [ ] non-weazel cannot place / remove / change price / view sales / collect
- [ ] weazel can place / remove / change price / view sales / collect
- [ ] booth location / heading / price persists after restart
- [ ] one-player pay -> theme -> camera -> 4 shots -> edit -> PuriPhoto -> save
- [ ] PuriPhoto displays the handed-off image before FLEPURI editor closes
- [ ] PuriPhoto handoff failure restores FLEPURI editor focus/state
- [ ] pre-capture cancel refund
- [ ] pre-capture disconnect refund
- [ ] technical failure refund
- [ ] capture timeout refund
- [ ] resource restart refund
- [ ] two-player shared background / floor
- [ ] two booths simultaneously with different themes/countdowns
- [ ] successful capture increments only target booth accounting
- [ ] refunded session does not increment sales
- [ ] collect one booth
- [ ] collect all booths
- [ ] bank transaction history shows FLEPURI sale collection
- [ ] failed company-bank payout restores pending balance
- [ ] no legacy booth auto-spawns

## Release package
- [x] operator install guide
- [x] PuriPhoto compatibility guide
- [x] acceptance test guide
- [x] optional PuriPhoto compatibility patch recipe
- [x] internal checklist excluded from operator ZIP
- [x] optional font binaries excluded
- [ ] final v1.0.1 ZIP generated and SHA256 fixed
