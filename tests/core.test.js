import test from "node:test";
import assert from "node:assert/strict";
import { chooseOperator, chooseLines, recordResult } from "../src/core.js";
const roster = Array.from({ length: 30 }, (_, i) => ({
  id: String(i),
  voices: { JP: {} },
}));
test("never repeats the last operator, even on rare-repeat draws", () => {
  for (let i = 0; i < 1000; i++)
    assert.notEqual(chooseOperator(roster, "JP", ["0", "1", "2"]).id, "2");
});
test("normal draws exclude the last twenty operators", () => {
  const recent = roster.slice(0, 20).map((o) => o.id);
  for (let i = 0; i < 100; i++)
    assert.ok(
      !recent.includes(chooseOperator(roster, "JP", recent, () => 0.5).id),
    );
});
test("rare draw can select an older recent operator but not the last", () =>
  assert.equal(chooseOperator(roster, "JP", ["0", "1", "2"], () => 0).id, "0"));
test("language availability is enforced", () =>
  assert.throws(() => chooseOperator(roster, "KR")));
const operator = {
  clips: {
    JP: [
      { id: "037", duration: 1, kind: "title" },
      ...Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        duration: i + 2,
        kind: i > 7 ? "trust" : "battle",
      })),
    ],
  },
};
test("five unique clips, title first, trust last, middle clips increase in duration", () => {
  for (let i = 0; i < 100; i++) {
    const ids = chooseLines(operator, "JP");
    assert.equal(ids[0], "037");
    assert.equal(new Set(ids).size, 5);
    assert.ok(["8", "9"].includes(ids[4]));
    const lengths = ids
      .slice(1)
      .map((id) => operator.clips.JP.find((c) => c.id === id).duration);
    assert.deepEqual(
      lengths,
      [...lengths].sort((a, b) => a - b),
    );
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
