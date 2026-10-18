# Photo Diary v0.1 Specification

## Product boundary
Private memory diary. Not a social network. No public feed, follows, likes, rankings, or public comments.

## v1 user features
- Create diary entry: date, title, body, mood, up to 5 LB Phone gallery images.
- Browse recent entries.
- Monthly calendar indicator.
- "On this day" memories.
- Direct read-sharing to a specified phone number (data model included; recipient inbox UI is v0.2).
- Birdy handoff entry point. Direct post prefill requires Flecity's installed Birdy API identifier and version.

## Monetization boundary
Core diary remains free. `FreeShareSlots=1`. Paid share-slot entitlements are modeled but disabled by default. No money can be charged until both player-money and Weazel-company-account adapters are explicitly configured.

## Security
- Ownership checks on update/delete/share.
- Server-side title/body/date/photo-count validation.
- Only http(s) image URLs accepted.
- Unique share recipient constraint.
- Money logic server-only and fail-closed.

## Future interoperability
Tables and identifiers are intentionally separate from Photo Mission / Scene. Cross-app links can later use diary entry IDs and photo URLs without merging the resources.
