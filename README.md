# Arknights Voice Comms

[Play the game](https://starpageidk.github.io/arknights-voice-comms/)

A fan-made operator guessing game: five attempts, four voice languages, randomized voice lines and browser-local statistics.

## Current coverage

All **380 base operators** in the pinned Global character table are included; alternate forms are merged using the game's own character groups. There is no handpicked name allowlist.

| Voice language | Playable operators |
| --- | ---: |
| Japanese | 379 |
| English | 363 |
| Mandarin | 362 |
| Korean | 359 |

27,655 candidate clips. Differences between language counts reflect actual voice availability; a missing language is never silently substituted. See [the coverage report](dist/coverage-report.json) for counts and provenance.

## Sources and freshness

- Global metadata: `ArknightsAssets/ArknightsGamedata`, character-table update **2026-11-01**.
- Voice archives: `ThiagoVsky/arknights-voice-jp`, `-en`, `-cn`, `-kr`, extracted from the Global client.
- Every archive bundle hash is compared with the **live Global resource manifest**. Unchanged recordings use URLs pinned to a specific Git commit, not a mutable branch.
- The 56 changed/new base-language bundles were downloaded directly from the official Global asset CDN and extracted with UnityPy. Their selected MP3s are shipped in `dist/live-audio/`.
- Official resource version: `26-10-26-10-03-17_824ce7`.
- Exact revisions and official CDN base are recorded in `sources.lock.json`.

Archive clip duration is estimated from the source's constant 96 kbps encoding for ordering only; the player reads the real audio duration. Extracted clip durations are measured with FFprobe. This is an online game: archived audio requires access to raw.githubusercontent.com; builds do not bundle all upstream audio.

## Development

Requires Node.js 22+.

```sh
npm ci
npm run verify
npm run dev
```

The server defaults to port 8766. Edit `src/`; `npm run build` updates `dist/`. No Python or FFmpeg is needed for ordinary UI builds.

## Refreshing content

Python 3.10+, FFmpeg/FFprobe on PATH and the dependencies in `requirements-content.txt` are required only for content updates.

```sh
python -m pip install -r requirements-content.txt
npm run refresh:content
npm run verify
npm run test:remote
```

1. `refresh-sources.py` fetches current Global tables, archive commit/tree/state indexes and the live official resource manifest. It writes `sources.lock.json` and an ignored `.cache/`.
2. `sync-live-audio.py` extracts changed/new base-operator bundles, preserving each language.
3. `import-roster.py` includes every obtainable base operator in the Global table, verifies hashes against the live manifest, builds clip pools and downloads missing avatars. Missing source coverage is an explicit report entry; stale changed bundles fail the import.

Review `dist/coverage-report.json` before committing. Updating is explicit, not a silent scheduled job. Never reuse a stale timing file: the old Ark-Voice index and prototype audio have been retired.

## Gameplay

- Attempt 1 is always the operator's title line, Arknights.
- Attempts 2–4 are sampled without replacement, sorted by duration; attempt 5 prefers Trust Increase Talk 1, 2 or 3.
- Clicking the next attempt skips; clicking the currently playing attempt pauses. Winning unlocks all five recordings.
- Selecting an operator submits immediately. Hints reveal rarity, class, race and faction.
- Language changes abandon the unfinished game without recording a loss.
- Statistics, language, volume and recent operators persist locally; custom backgrounds remain in IndexedDB and are not uploaded.
- No consecutive operator repeats. When fresh choices exist, only 0.1% of draws come from the last 20 operators; older recent entries receive greater weight.

## Tests and deployment

`npm test` covers the complete roster, pinned source URLs, local media, random selection, five-line rounds, search, auto-submit, audio controls, settings, hints and per-language statistics. Browser audio is emulated in unit tests; `npm run test:remote` additionally downloads representative real MP3 files from every language and verifies browser CORS access. A real-browser smoke test is still recommended after content refreshes.

Pushes to `main` run checks/tests, save a downloadable `arknights-voice-comms-build` artifact and deploy to GitHub Pages. Pull requests test/package without deployment. Pages uses GitHub Actions as its publishing source.

## Attribution

Arknights characters, audio and artwork © HYPERGRYPH / Yostar. Unofficial, non-commercial fan project; no affiliation or ownership of game assets is claimed. Game assets are not relicensed by this repository.

- Global game data: https://github.com/ArknightsAssets/ArknightsGamedata
- Archive voice source: https://github.com/ThiagoVsky/arknights-voice-jp (and corresponding en/cn/kr repositories)
- Fresh voices: official Global Arknights CDN; retrieval and decompression use https://github.com/thesadru/ArkPRTS and https://github.com/K0lb3/UnityPy
- Avatars: https://github.com/yuanyan3060/ArknightsGameResource and https://github.com/ArknightsAssets/ArknightsAssets
