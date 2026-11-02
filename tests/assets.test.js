import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { chooseLines } from "../src/core.js";
const data = JSON.parse(await readFile("dist/game-data.json", "utf8"));
const coverage = JSON.parse(
  await readFile("dist/coverage-report.json", "utf8"),
);
const sources = JSON.parse(await readFile("sources.lock.json", "utf8"));
test("full Global roster is included, with no hardcoded sample cap", () => {
  assert.ok(data.operators.length >= 380);
  assert.equal(data.operators.length, coverage.baseOperators);
  assert.equal(coverage.excluded.length, 0);
  for (const name of ["Kafka", "Closure", "Viy", "Crackborne"])
    assert.ok(
      data.operators.some((o) => o.name === name),
      name,
    );
});
test("all operators have valid avatars and five-line rounds in each listed language", async () => {
  const names = new Set();
  for (const op of data.operators) {
    assert.ok(!names.has(op.name));
    names.add(op.name);
    const avatar = await readFile("dist/" + op.avatar);
    assert.equal(avatar.subarray(1, 4).toString(), "PNG");
    for (const language of Object.keys(op.voices)) {
      const ids = chooseLines(op, language);
      assert.equal(ids.length, 5);
      assert.equal(new Set(ids).size, 5);
      assert.equal(ids[0], "037");
      for (const clip of op.clips[language]) {
        assert.ok(clip.duration > 0);
        const path = op.voices[language][clip.id];
        if (path.startsWith("https://")) {
          const source = sources.archives[language];
          assert.equal(
            path,
            `https://raw.githubusercontent.com/${source.repo}/${source.commit}/${op.id}/cn_${clip.id}.mp3`,
          );
          assert.match(source.commit, /^[a-f0-9]{40}$/);
        } else {
          assert.ok(path.startsWith("live-audio/"));
          assert.ok((await stat("dist/" + path)).size > 100);
        }
      }
    }
  }
});
test("coverage matches real per-language availability and fresh official resources", () => {
  assert.equal(data.resourceVersion, sources.live.version);
  for (const [lang, count] of Object.entries(coverage.languages))
    assert.equal(count, data.operators.filter((o) => o.voices[lang]).length);
  assert.ok(coverage.voiceSources.live > 0);
  const deer = data.operators.find((o) => o.name === "Nine-Colored Deer");
  assert.ok(deer.voices.CN);
  assert.equal(deer.voices.JP, undefined);
});
