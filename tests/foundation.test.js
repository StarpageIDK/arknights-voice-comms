import test from "node:test";
import assert from "node:assert/strict";
import { createAudioPlayer } from "../src/audio.js";
import { createStorage } from "../src/storage.js";
import {
  createRound,
  transitionRound,
  roundResult,
  classicMode,
} from "../src/game.js";

function audioFixture(fetchAudio) {
  const audio = {
    paused: true,
    duration: 10,
    pause() {
      this.paused = true;
    },
    load() {
      queueMicrotask(() => this.onloadedmetadata?.());
    },
    async play() {
      this.paused = false;
    },
  };
  const player = createAudioPlayer(audio, {
    fetchAudio,
    urls: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  });
  return { audio, player };
}
const response = { ok: true, blob: async () => ({}) };
test("failed audio requests are retried", async () => {
  let calls = 0;
  const { player } = audioFixture(async () => {
    if (++calls === 1) throw Error("offline");
    return response;
  });
  assert.equal(await player.play("clip"), false);
  assert.equal(await player.play("clip"), true);
  assert.equal(calls, 2);
  player.clear();
});
test("stop cancels playback waiting for network", async () => {
  let release;
  const { audio, player } = audioFixture(
    () => new Promise((r) => (release = r)),
  );
  const playing = player.play("clip");
  player.stop();
  release(response);
  assert.equal(await playing, false);
  assert.equal(audio.paused, true);
  player.clear();
});
test("decode errors settle and permit retry", async () => {
  const { audio, player } = audioFixture(async () => response);
  audio.load = () => queueMicrotask(() => audio.onerror?.());
  assert.equal(await player.play("clip"), false);
  audio.load = () => queueMicrotask(() => audio.onloadedmetadata?.());
  assert.equal(await player.play("clip"), true);
  player.clear();
});
function localStorageMock() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i],
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
}
const entry = (id) => ({
  schemaVersion: 1,
  roundId: id,
  modeId: "classic",
  language: "JP",
  won: true,
  attempt: 0,
  completedAt: "2026-11-03T00:00:00Z",
});
test("two tabs preserve results and duplicate saves are idempotent", () => {
  const shared = localStorageMock(),
    a = createStorage(() => shared),
    b = createStorage(() => shared);
  a.append(entry("a"));
  b.append(entry("b"));
  a.append(entry("a"));
  assert.equal(a.statistics().JP.played, 2);
  assert.equal(b.statistics().JP.won, 2);
});
test("invalid saves recover; legacy statistics remain a baseline", () => {
  const shared = localStorageMock(),
    store = createStorage(() => shared);
  shared.setItem("voiceprint-recent", "{}");
  shared.setItem(
    "voiceprint-language-stats",
    JSON.stringify({
      JP: {
        played: 2,
        won: 1,
        streak: 0,
        best: 1,
        distribution: [1, 0, 0, 0, 0],
      },
      EN: { played: "<bad>" },
    }),
  );
  assert.deepEqual(store.recent(), []);
  store.append(entry("a"));
  assert.equal(store.statistics().JP.played, 3);
  assert.equal(store.statistics().EN.played, 0);
});
test("quota failure preserves session results", () => {
  const shared = localStorageMock();
  shared.setItem = () => {
    throw Error("quota");
  };
  const store = createStorage(() => shared);
  assert.equal(store.append(entry("a")), false);
  assert.equal(store.statistics().JP.played, 1);
});
test("round actions enforce completion and support alternate rule sets", () => {
  const op = { id: "a", name: "A" };
  const mode = {
    ...classicMode,
    id: "test",
    attempts: 2,
    hints: 1,
    chooseOperator: () => op,
    chooseLines: () => ["a", "b"],
  };
  let round = createRound([], "JP", [], {
    mode,
    id: "round",
    contentVersion: "version",
  });
  round = transitionRound(round, { type: "hint" });
  round = transitionRound(round, { type: "hint" });
  assert.equal(round.hintCount, 1);
  round = transitionRound(round, { type: "skip" });
  assert.equal(round.ended, false);
  round = transitionRound(round, { type: "guess", operator: op });
  assert.equal(round.won, true);
  assert.equal(roundResult(round).modeId, "test");
  assert.equal(roundResult(round).verified, false);
  assert.equal(transitionRound(round, { type: "giveup" }), round);
});
