# Extension boundaries

The site remains a static guest game. Registration and server-side persistence are
not implemented by this refactor.

- `game.js`: pure round transitions, mode registry and versioned result contract.
  Add a mode definition with its own selection functions, attempts and hint limit.
  The current UI still renders the classic voice-game layout; other presentations
  should supply their own renderer rather than adding mode branches everywhere.
- `audio.js`: loading, retries, cancellation of pending playback, decode errors,
  timeout and object URL lifecycle. It has no DOM dependencies.
- `storage.js`: validates legacy data, retains old statistics as a baseline and
  stores one result per unique round ID. Different tabs cannot overwrite each
  other's completed rounds. Failed writes remain in memory for this session.
- `app.js`: browser UI, settings and orchestration of those modules.
- Build stamps the roster with a deterministic content hash. Results record that
  hash alongside the mode, rule version, language, hints and timestamps.

## Accounts and personal dashboard

Introduce a backend with authenticated user identity before storing private data.
Suggested records: profiles, preferences, game results (unique user + round ID).
Authorize every read/write by the authenticated session, never by a client-supplied
user ID alone. Keep provider credentials and session secrets out of static assets.
Use a maintained authentication service/library rather than implementing password
storage in this frontend.

Expose a result repository with append/list operations and a separate profile API.
Retries must be idempotent on round ID. Import guest results explicitly at sign-in;
legacy aggregate statistics have no individual rounds and must remain a separate
baseline. Never count that baseline again on each login. Decide account switching,
sign-out cleanup, deletion and guest-history ownership before adding sync.

Client results are unverified. Ranked modes require server-issued rounds and
server-side answer/scoring validation. Do not trust the client's `verified` field.
Keep casual guest games available independently of authentication.

## Next increments

1. Add a second mode and renderer, with its own statistics partition and tests.
2. Extend result aggregation for variable attempt counts and rule versions before
   exposing modes with a different distribution shape (classic currently uses 5).
3. Introduce account API and dashboard, then explicit guest import and sync tests.
4. Move growing history to IndexedDB/server pagination; localStorage is a small
   transitional repository, not unlimited long-term storage.
5. Split the large roster/audio manifest for lazy loading when adding new content.

No server, account provider or paid infrastructure is provisioned here.
