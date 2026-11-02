# Arknights Voice Comms

A fan-made operator guessing game: five attempts, four voice languages, randomized voice lines and browser-local statistics.

**Play:** https://starpageidk.github.io/arknights-voice-comms/

## Development

Requires Node.js 22 or newer.

```sh
npm ci
npm run verify
npm run dev
```

The local server prints its URL (default port 8766). Edit `src/`; `npm run build` updates `dist/`. Audio and operator data are shipped in `dist/`, so no Python or FFmpeg is needed to build or play.

## Gameplay

- Attempt 1 always plays the operator's title line, Arknights.
- Attempts 2–4 are sampled without replacement and sorted by duration.
- Attempt 5 uses a random Trust Increase Talk 1, 2 or 3, where available.
- Earlier lines are shorter than the finale whenever the available pool permits.
- Clicking the next attempt skips; clicking the currently playing attempt pauses.
- Winning unlocks all five recordings. Selecting an operator submits immediately.
- Hints reveal rarity, class, then race and faction.
- Switching language abandons the unfinished game without recording a loss.
- Statistics, language, volume and recent operators persist locally. Custom backgrounds stay in IndexedDB and are not uploaded.
- Immediate repeats are excluded. With fresh operators available, only 0.1% of draws come from the previous 20; within that pool, older entries have greater weight.

## Roster and audio

The first release includes 70 Global operators with 267 available language packs (JP/EN/CN/KR). Not every operator has every language. Alternate forms are grouped into their base operator and are not separate answers.

`dist/game-data.json` contains metadata, avatar paths, voice paths and clip durations/categories. To change the candidate roster, edit `names` in `scripts/import-roster.py`. To rebuild assets, install Python 3.10+ and FFmpeg on PATH, then run:

```sh
python scripts/import-roster.py
npm run verify
```

The importer downloads missing source tables into ignored `.cache/`, caches integrated audio, and extracts selected clips. It uses the committed `voice-source.json` timestamps. Keep that file synchronized with its audio source when updating upstream versions. Clips 007/008/009 are trust talks; 037 is the mandatory title. This importer is intended for deliberate content updates, not every application build.

## Tests and deployment

`npm test` uses Node's test runner and jsdom. It covers selection probabilities, line uniqueness/order, assets, auto-submit, attempts, winning, language/stat isolation, seeking, saved settings and hint placement. Audio/UI tests emulate the browser audio API; final audible playback should also be checked in a real browser.

Pushes to `main` run checks and tests, produce a downloadable `arknights-voice-comms-build` artifact, and deploy `dist/` to GitHub Pages. Pull requests test and package without deploying. GitHub Pages must use **GitHub Actions** as its publishing source.

## Attribution

Arknights characters, audio and artwork © HYPERGRYPH / Yostar. This is an unofficial, non-commercial fan project and is not affiliated with them.

- Voice assets and timing index: https://github.com/isHarryh/Ark-Voice
- Global operator metadata: https://github.com/ArknightsAssets/ArknightsGamedata
- Avatars: https://github.com/ArknightsAssets/ArknightsAssets

No ownership of game assets is claimed. Third-party assets are not relicensed by this repository.
