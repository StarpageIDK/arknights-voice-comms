import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseOperator,
  chooseLines,
  recordResult,
  matchesName,
  streakTier,
  eligibleOperators,
} from "../src/core.js";
const roster = Array.from({ length: 80 }, (_, i) => ({
  id: String(i),
  voices: { JP: {} },
}));
test("never repeats the last operator, even on draws", () => {
  for (let i = 0; i < 1000; i++)
    assert.notEqual(chooseOperator(roster, "JP", ["0", "1", "2"]).id, "2");
});
test("normal draws exclude the last fifty operators", () => {
  const recent = roster.slice(0, 50).map((o) => o.id);
  for (let i = 0; i < 100; i++)
    assert.ok(
      !recent.includes(chooseOperator(roster, "JP", recent, () => 0.5).id),
    );
});
test("small pools rotate the least recently seen and one-member pools still work", () => {
  assert.equal(
    chooseOperator(roster.slice(0, 3), "JP", ["0", "1", "2"], () => 0).id,
    "0",
  );
  assert.equal(chooseOperator(roster.slice(0, 1), "JP", ["0"]).id, "0");
  assert.equal(chooseOperator(roster, "JP", ["0", "1", "2"], () => 0).id, "3");
});

test("language availability is enforced", () =>
  assert.throws(() => chooseOperator(roster, "KR")));
const operator = {
  clips: {
    JP: [
      { id: "037", duration: 1, kind: "title" },
      ...["025", "026", "027", "028"].map((id) => ({
        id,
        duration: 2,
        kind: "battle",
      })),
      ...["023", "024"].map((id) => ({ id, duration: 3, kind: "deployment" })),
      ...["002", "003", "004"].map((id) => ({ id, duration: 6, kind: "talk" })),
      ...["007", "008", "009"].map((id) => ({
        id,
        duration: 8,
        kind: "trust",
      })),
    ],
  },
};
test("five unique clips follow title, battle, deployment, talk, trust order", () => {
  for (let i = 0; i < 100; i++) {
    const ids = chooseLines(operator, "JP");
    assert.equal(ids[0], "037");
    assert.equal(new Set(ids).size, 5);
    assert.ok(["025", "026", "027", "028"].includes(ids[1]));
    assert.ok(["023", "024"].includes(ids[2]));
    assert.ok(["002", "003", "004"].includes(ids[3]));
    assert.ok(["007", "008", "009"].includes(ids[4]));
  }
});
test("repeat operator can receive different combinations", () => {
  const combinations = new Set(
    Array.from({ length: 100 }, () => chooseLines(operator, "JP").join(",")),
  );
  assert.ok(combinations.size > 10);
});
test("stats track win, failure and distribution without mutating previous record", () => {
  const blank = {
    played: 0,
    won: 0,
    streak: 0,
    best: 0,
    distribution: [0, 0, 0, 0, 0],
  };
  const won = recordResult(blank, true, 3);
  assert.equal(won.distribution[3], 1);
  assert.equal(won.streak, 1);
  const lost = recordResult(won, false, 4);
  assert.equal(lost.played, 2);
  assert.equal(lost.won, 1);
  assert.equal(lost.streak, 0);
  assert.equal(lost.best, 1);
  assert.equal(blank.played, 0);
});

test("ASCII search supports diacritics, punctuation and alternative-form aliases", () => {
  assert.ok(matchesName({ name: "Młynar" }, "mlynar", true));
  for (const query of ["wisadel", "wis'adel", "wiš’adel"])
    assert.ok(matchesName({ name: "W", aliases: ["Wiš'adel"] }, query, true));
  assert.ok(matchesName({ name: "Pozëmka" }, "pozemka", true));
  assert.equal(matchesName({ name: "W" }, "'"), false);
});
test("rarity selection supports combinations and tier thresholds", () => {
  const roster = [1, 3, 6].map((rarity) => ({ rarity, voices: { JP: {} } }));
  assert.deepEqual(
    eligibleOperators(roster, "JP", [3, 6]).map((o) => o.rarity),
    [3, 6],
  );
  assert.deepEqual([2, 3, 5, 10, 25].map(streakTier), [
    "",
    "warm",
    "hot",
    "blazing",
    "legend",
  ]);
});
