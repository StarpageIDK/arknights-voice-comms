# 1.2.0 — Stability and usability

Released 2026-11-04.

## Fixes

- Clearing the operator search also clears its keyboard selection. Arrow keys can no longer target an invisible result left over from the previous query.
- Settings that cannot be written because browser storage is full or blocked remain authoritative for the current session, even when an older persisted value exists.
- New rounds reread recent operator history, including rounds started in another tab. The existing last-50 rule and small-pool fallback are unchanged. Simultaneous starts in separate tabs are not an atomic transaction.
- The statistics dialog updates when another tab records a result, preserving its selected statistics language.
- Switching away from a loading voice clip cancels its network request and removes the incomplete cache entry. Returning to that clip can retry normally.
- An empty saved rarity pool recovers to all rarities on startup instead of leaving the game unusable after a roster change.
- Starting a new round clears the preceding result's success/failure styling and returns keyboard focus to the answer input.
- Changing clips cancels any in-progress seek gesture.

## Usability

- Loading the operator list has a 20-second timeout and an explicit retry button.
- Audio status identifies the actual voice category during loading, readiness and playback; playback errors restore the Play button.
- Rarity counts preview the checkboxes before applying them; cancelling keeps the previous filters.
- Visible keyboard focus, wrapping for long result names, and scrollable dialogs on short screens.

## Verification and limits

- `npm run verify`: 47 passing tests and successful static build. Nine new regression tests cover search cleanup, failed storage writes, cancelled audio requests, cross-tab history/statistics, empty saved filters, round reset, loading retry, and rarity previews.
- Existing tests cover all 417 roster forms, all 63 nonempty rarity combinations across four languages, related-form answer credit, the last-50 RNG rule, small pools, round completion, forfeiting, voice categories, and statistics.
- Chrome smoke check: local page loaded audio metadata, rarity dialog opened/closed, search put Istina first for `Ist`. At a 375×812 viewport, the page had no horizontal overflow and the operator list was visually checked.
- Real Firefox verification was blocked by the desktop automation tool's unsupported browser URL-policy enforcement. No Firefox pass is claimed.
- Physical iOS/Android devices and the full 80–200% browser-zoom matrix remain unverified. Simulated audio tests do not prove playback on every browser/device.

No account system or new game modes are introduced in this release. Existing versioned round results remain the extension point for those features.
