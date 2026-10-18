# FRAME Integration Pre-Test

## Status
Internal integrated build. Event creation, submissions, organizer media saving, results, ads, staff review and billing paths are included.

## Start order
1. framework (Qbox on the test server)
2. oxmysql
3. lb-phone
4. frame_integration

## Install
Run `sql/install.sql` once on a clean FRAME test database, then add `ensure frame_integration` after `lb-phone`.

## Staff test permission
Replace `YOUR_CITIZENID` and run:
```sql
INSERT INTO frame_permissions(player_identifier, role, scope)
VALUES ('YOUR_CITIZENID','weazel_staff','global')
ON DUPLICATE KEY UPDATE role=VALUES(role);
```
For admin use `admin`.

## Test order
1. Open FRAME and create an event.
2. Publish it and join it from a participant.
3. Submit a Gallery image and a Camera image.
4. As organizer, open submissions and save one to LB Phone Gallery.
5. Create an ad linked to an owned event.
6. As Weazel Staff, approve/reject the ad.
7. Verify Home Banner display after its start time.
8. Verify `frame_ad_daily_stats` increments.
9. Verify `frame_audit_logs` contains EVENT_CREATE, EVENT_PUBLISH, SUBMISSION_CREATE, SUBMISSION_DOWNLOAD and AD_CREATE as applicable.

## Known environment-dependent checks
- Flecity production framework adapter remains pending until the production framework is identified.
- Media-host allowlisting remains pending until Flecity LB Phone upload provider/domain is known.
- Non-zero ad prices should be tested on Qbox with a disposable bank balance before production.
