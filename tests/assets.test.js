import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { chooseLines } from "../src/core.js";
const data = JSON.parse(await readFile("dist/game-data.json", "utf8"));
test("all shipped operators have avatars and playable five-line rounds in each listed language", async () => {
  assert.ok(data.operators.length >= 50);
  const names = new Set();
  for (const op of data.operators) {
    assert.ok(!names.has(op.name));
    names.add(op.name);
    assert.ok((await stat("dist/" + op.avatar)).size > 100);
    for (const language of Object.keys(op.voices)) {
      const ids = chooseLines(op, language);
      assert.equal(ids.length, 5);
      assert.equal(ids[0], "037");
      for (const clip of op.clips[language]) {
        assert.ok(clip.duration > 0);
        const buffer = await readFile("dist/" + op.voices[language][clip.id]);
        assert.equal(buffer.subarray(0, 4).toString(), "OggS");
      }
    }
  }
});
