import { chooseOperator, chooseLines, operatorFamily } from "./core.js";

export const classicMode = Object.freeze({
  id: "classic",
  rulesVersion: 3,
  attempts: 5,
  hints: 3,
  chooseOperator,
  chooseLines,
});
export const modes = Object.freeze({ classic: classicMode });

export function createRound(operators, language, recent, options = {}) {
  const mode = options.mode || classicMode;
  const operator = mode.chooseOperator(
    operators,
    language,
    recent,
    options.random,
  );
  return {
    roundId: options.id || crypto.randomUUID(),
    modeId: mode.id,
    rulesVersion: mode.rulesVersion,
    contentVersion: options.contentVersion || "unknown",
    startedAt: new Date().toISOString(),
    language,
    rarities: options.rarities || [1, 2, 3, 4, 5, 6],
    operator,
    lines: mode.chooseLines(operator, language, options.random),
    limit: mode.attempts,
    maxHints: mode.hints,
    attempt: 0,
    hintCount: 0,
    results: [],
    ended: false,
    won: false,
  };
}

export function transitionRound(round, action) {
  if (round.ended) return round;
  const next = { ...round, results: [...round.results] };
  if (action.type === "hint") {
    next.hintCount = Math.min(next.maxHints, next.hintCount + 1);
    return next;
  }
  if (!["guess", "skip", "giveup"].includes(action.type)) return round;
  const won =
    action.type === "guess" &&
    operatorFamily(action.operator) === operatorFamily(round.operator);
  const label =
    action.type === "guess"
      ? `${action.operator.name} · ${won ? "Correct" : "Incorrect"}`
      : action.type === "skip"
        ? "Skipped"
        : "Gave up";
  next.results[next.attempt] = { label, kind: won ? "success" : "failure" };
  next.ended =
    won || action.type === "giveup" || next.attempt === next.limit - 1;
  next.won = won;
  if (next.ended) next.completedAt = new Date().toISOString();
  else next.attempt++;
  return next;
}

export function roundResult(round) {
  if (!round.ended) throw Error("Round is not complete");
  const {
    roundId,
    modeId,
    rulesVersion,
    contentVersion,
    language,
    startedAt,
    completedAt,
    won,
    attempt,
    hintCount,
    rarities,
  } = round;
  return {
    schemaVersion: 1,
    roundId,
    modeId,
    rulesVersion,
    contentVersion,
    language,
    startedAt,
    completedAt,
    won,
    attempt,
    hintCount,
    rarities,
    verified: false,
  };
}
