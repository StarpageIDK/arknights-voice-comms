import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import * as core from "../src/core.js";
import * as game from "../src/game.js";
import * as storage from "../src/storage.js";
import * as player from "../src/audio.js";
const html = await readFile("src/index.html", "utf8");
const source = (await readFile("src/app.js", "utf8")).replace(
  /import [\s\S]*?;\s*/g,
  "",
);
const operators = ["Amiya", "Texas", "Exusiai"].map((name, i) => ({
  id: String(i),
  name,
  rarity: 5,
  class: "Guard",
  race: "Test race",
  faction: "Rhodes Island",
  avatar: "avatar.png",
  voices: Object.fromEntries(
    ["JP", "EN", "CN", "KR"].map((l) => [
      l,
      Object.fromEntries(
        ["037", "021", "002", "003", "009"].map((id) => [
          id,
          `${i}/${l}/${id}.ogg`,
        ]),
      ),
    ]),
  ),
  clips: Object.fromEntries(
    ["JP", "EN", "CN", "KR"].map((l) => [
      l,
      [
        { id: "037", duration: 1, kind: "title" },
        { id: "021", duration: 2, kind: "battle" },
        { id: "002", duration: 8, kind: "talk" },
        { id: "003", duration: 12, kind: "talk" },
        { id: "009", duration: 30, kind: "trust" },
      ],
    ]),
  ),
}));
const flush = () => new Promise((r) => setTimeout(r, 25));
async function setup(saved = {}) {
  const dom = new JSDOM(html, {
      url: "https://game.test/",
      runScripts: "outside-only",
    }),
    w = dom.window;
  Object.assign(w, core, game, storage, player);
  w.createStorage = () => storage.createStorage(() => w.localStorage);
  w.createAudioPlayer = (audio, options) =>
    player.createAudioPlayer(audio, {
      ...options,
      fetchAudio: (...args) => w.fetch(...args),
      urls: w.URL,
    });
  w.createRound = (operators, language, recent, options) =>
    game.createRound(operators, language, recent, {
      ...options,
      random: () => 0.6,
    });
  w.chooseOperator = (operators, language, recent) =>
    core.chooseOperator(operators, language, recent, () => 0.6);
  w.chooseLines = (operator, language) =>
    core.chooseLines(operator, language, () => 0.6);
  w.structuredClone = structuredClone;
  w.Math.random = () => 0.6;
  w.URL.createObjectURL = () => "blob:audio";
  w.URL.revokeObjectURL = () => {};
  w.indexedDB = { open: () => ({}) };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLElement.prototype.setPointerCapture = () => {};
  let audio;
  w.Audio = class {
    constructor() {
      audio = this;
      this.paused = true;
      this.duration = 40;
      this.currentTime = 0;
      this.playCount = 0;
    }
    load() {
      this.currentTime = 0;
      queueMicrotask(() => this.onloadedmetadata?.());
    }
    pause() {
      this.paused = true;
    }
    async play() {
      this.paused = false;
      this.playCount++;
    }
  };
  w.fetch = async (url) =>
    String(url).endsWith("game-data.json")
      ? { ok: true, json: async () => ({ operators }) }
      : { ok: true, blob: async () => new w.Blob(["audio"]) };
  for (const [key, value] of Object.entries(saved))
    w.localStorage.setItem(key, JSON.stringify(value));
  w.eval(source);
  await flush();
  return {
    dom,
    w,
    audio,
    $: (id) => w.document.getElementById(id),
    click: (selector) => w.document.querySelector(selector).click(),
  };
}
test("empty search stays closed; picking a result submits immediately", async () => {
  const x = await setup();
  x.$("guess").focus();
  assert.equal(x.$("suggestions").hidden, true);
  x.$("guess").value = "Ami";
  x.$("guess").dispatchEvent(new x.w.Event("input"));
  assert.equal(x.$("suggestions").hidden, false);
  x.click(".suggestion");
  await flush();
  assert.match(x.$("steps").textContent, /Amiya.*Incorrect/);
  assert.match(x.$("counter").textContent, /2 \/ 5/);
  assert.equal(x.audio.paused, false);
  x.dom.window.close();
});
test("next card skips, later cards remain locked and current card toggles pause", async () => {
  const x = await setup();
  const cards = () => x.$("steps").querySelectorAll("button");
  assert.equal(cards()[1].disabled, false);
  assert.equal(cards()[2].disabled, true);
  cards()[1].click();
  await flush();
  assert.equal(x.audio.paused, false);
  cards()[1].click();
  assert.equal(x.audio.paused, true);
  assert.equal(cards()[1].classList.contains("available"), true);
  x.dom.window.close();
});
test("winning reveals all audio; result sits below next button in the player", async () => {
  const x = await setup();
  x.$("guess").value = "Texas";
  x.$("guessForm").dispatchEvent(new x.w.Event("submit", { cancelable: true }));
  await flush();
  assert.equal(x.$("next").hidden, false);
  assert.equal(x.$("message").querySelector("img").alt, "Texas");
  assert.ok(
    [...x.$("steps").querySelectorAll("button")].every((b) => !b.disabled),
  );
  assert.equal(x.$("message").previousElementSibling.id, "next");
  x.dom.window.close();
});
test("language changes abandon rounds without losses, persist selection, and isolate stats", async () => {
  const x = await setup();
  x.$("skip").click();
  x.click('[data-lang="EN"]');
  await flush();
  assert.match(x.$("stats").textContent, /EN · 0 PLAYED/);
  assert.equal(
    JSON.parse(x.w.localStorage.getItem("voiceprint-language")),
    "EN",
  );
  assert.equal(x.w.localStorage.getItem("voiceprint-language-stats"), null);
  x.$("giveup").click();
  const stats = storage.createStorage(() => x.w.localStorage).statistics();
  assert.equal(stats.EN.played, 1);
  assert.equal(stats.JP.played, 0);
  x.$("showStats").click();
  assert.equal(x.$("statistics").open, true);
  assert.equal(x.$("statsLanguages").children.length, 4);
  x.dom.window.close();
});
test("dragging seek pauses and does not play repeatedly until release", async () => {
  const x = await setup();
  x.$("play").click();
  await flush();
  const n = x.audio.playCount;
  x.$("progress").dispatchEvent(new x.w.Event("pointerdown"));
  for (const value of [100, 300, 700]) {
    x.$("progress").value = value;
    x.$("progress").dispatchEvent(new x.w.Event("input"));
  }
  assert.equal(x.audio.paused, true);
  assert.equal(x.audio.playCount, n);
  x.$("progress").dispatchEvent(new x.w.Event("pointerup"));
  await flush();
  assert.equal(x.audio.currentTime, 28);
  assert.equal(x.audio.paused, false);
  assert.equal(x.audio.playCount, n + 1);
  x.dom.window.close();
});
test("settings restore zero volume and language; all hints stay in the sixth tile", async () => {
  const x = await setup({
    "voiceprint-volume": 0,
    "voiceprint-language": "KR",
  });
  assert.equal(x.audio.volume, 0);
  assert.match(x.$("stats").textContent, /KR/);
  for (let i = 0; i < 3; i++) x.$("hint").click();
  assert.equal(x.$("hints").closest(".hints-card") !== null, true);
  assert.equal(x.$("hints").querySelectorAll(".hint-segment").length, 4);
  x.dom.window.close();
});
