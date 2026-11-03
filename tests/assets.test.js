import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { chooseLines, eligibleOperators, searchOperators, matchesName } from "../src/core.js";
const data = JSON.parse(await readFile("dist/game-data.json", "utf8"));
const coverage = JSON.parse(
  await readFile("dist/coverage-report.json", "utf8"),
);
const sources = JSON.parse(await readFile("sources.lock.json", "utf8"));
test("full Global roster is included, with no hardcoded sample cap", () => {
  assert.ok(data.operators.length >= 417);
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

test("roster has verified labels, actor lists and local role icons", async () => {
  for (const op of data.operators) {
    assert.ok(op.archetype);
    for (const path of [op.classIcon, op.archetypeIcon]) {
      const bytes = await readFile("dist/" + path);
      assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    }
    for (const lang of Object.keys(op.voices)) {
      assert.ok(Array.isArray(op.voiceActors[lang]) && op.voiceActors[lang].length > 0);
      for (const clip of op.clips[lang])
        assert.ok(clip.label && !clip.label.startsWith("Voice "));
      const ids = chooseLines(op, lang);
      assert.ok(["025", "026", "027", "028"].includes(ids[1]));
      assert.ok(["023", "024"].includes(ids[2]));
    }
  }
});


test("every obtainable form retains its own source identity and filter metadata", () => {
  assert.equal(coverage.mergedAlternateForms, 0);
  assert.deepEqual(data.operators.map(o=>o.id).sort(), coverage.expectedOperators.map(o=>o.id).sort());
  for (const expected of coverage.expectedOperators) {
    const actual = data.operators.find(o=>o.id===expected.id);
    for (const key of ['name','rarity','class','archetype']) assert.equal(actual[key],expected[key],expected.id+' '+key);
    assert.equal(actual.avatar, `avatars/${actual.id}.png`);
    for (const [lang, voices] of Object.entries(actual.voices)) {
      for (const path of Object.values(voices)) assert.ok(path.includes('/'+actual.id+'/'), actual.id+' '+lang);
    }
  }
});
test("all 63 rarity combinations and four languages retain every eligible form", () => {
  for (const lang of ['JP','EN','CN','KR']) for (let mask=1;mask<64;mask++) {
    const stars=[1,2,3,4,5,6].filter(n=>mask & (1<<(n-1)));
    const actual=eligibleOperators(data.operators,lang,stars);
    const expected=coverage.expectedOperators.filter(o=>stars.includes(o.rarity) && data.operators.find(p=>p.id===o.id).voices[lang]);
    assert.deepEqual(actual.map(o=>o.id).sort(),expected.map(o=>o.id).sort());
  }
});
test("Lappland alter and other alters are separate answers, not base-form aliases", () => {
  const six=eligibleOperators(data.operators,'JP',[6]);
  const lappland=searchOperators(six,'lappland alter');
  assert.equal(lappland[0].id,'char_1038_whitw2');
  assert.equal(lappland[0].class,'Caster');
  assert.ok(!six.some(o=>o.name==='Lappland'));
  const base=data.operators.find(o=>o.name==='Lappland');
  assert.equal(base.rarity,5); assert.equal(base.class,'Guard');
  const wisadel=searchOperators(six,'wisadel')[0];
  assert.equal(wisadel.id,'char_1035_wisdel');
  assert.equal(matchesName(data.operators.find(o=>o.name==='W'),'wisadel'),false);
  for (const op of data.operators.filter(o=>o.baseOperatorId!==o.id)) {
    const base=data.operators.find(o=>o.id===op.baseOperatorId);
    assert.ok(base); assert.ok(!base.aliases.includes(op.name));
    assert.ok(searchOperators(eligibleOperators(data.operators,'JP',[op.rarity]),op.name).some(o=>o.id===op.id) || !op.voices.JP);
  }
});


test("Amiya class changes from the patch table remain separate five-star entries", () => {
  const forms=data.operators.filter(o=>o.baseOperatorId==='char_002_amiya');
  assert.equal(forms.length,3);
  assert.deepEqual(forms.map(o=>o.class).sort(),['Caster','Guard','Medic']);
  assert.ok(forms.every(o=>o.rarity===5));
  assert.equal(new Set(forms.map(o=>o.name)).size,3);
});
