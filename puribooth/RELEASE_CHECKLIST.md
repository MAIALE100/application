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
- [x] Hachi Maru Pop identified as SIL OFL 1.1
- [x] Hitori Gothic distribution page permits embedding and states SIL OFL
- [ ] obtain permission for embedding / redistribution of Heisei Joshi Font
      OR replace it with a redistributable font before creating the operator ZIP
- [ ] include required font license / attribution files in release ZIP

## Final validation
- [ ] fresh-install test with empty puribooth tables
- [ ] one-player full flow: pay -> theme -> camera -> 4 shots -> edit -> PuriPhoto -> save
- [ ] cancellation / refund test
- [ ] resource restart refund test
- [ ] two-player shared background / floor test
- [ ] two booths used simultaneously with different themes
- [ ] booth remove / restart / persistence test
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
