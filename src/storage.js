import { recordResult } from "./core.js";

export const languages = ["JP", "EN", "CN", "KR"];
export const blankStats = () => ({
  played: 0,
  won: 0,
  streak: 0,
  best: 0,
  distribution: [0, 0, 0, 0, 0],
});
const count = (n) => Number.isSafeInteger(n) && n >= 0;
export function validStats(s) {
  return (
    s &&
    ["played", "won", "streak", "best"].every((k) => count(s[k])) &&
    s.won <= s.played &&
    s.streak <= s.best &&
    s.best <= s.won &&
    Array.isArray(s.distribution) &&
    s.distribution.length === 5 &&
    s.distribution.every(count) &&
    s.distribution.reduce((a, b) => a + b, 0) === s.won
  );
}
export function createStorage(getStorage = () => localStorage) {
  const memory = new Map();
  function read(key, fallback) {
    try {
      return (
        JSON.parse(getStorage().getItem(key)) ?? memory.get(key) ?? fallback
      );
    } catch {
      return memory.get(key) ?? fallback;
    }
  }
  function save(key, value) {
    memory.set(key, value);
    try {
      getStorage().setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  function recent() {
    const value = read("voiceprint-recent", []);
    return Array.isArray(value)
      ? value.filter((v) => typeof v === "string").slice(-20)
      : [];
  }
  function history() {
    const keys = new Set(memory.keys());
    try {
      const s = getStorage();
      for (let i = 0; i < s.length; i++) keys.add(s.key(i));
    } catch {}
    return [...keys]
      .filter((k) => k?.startsWith("voiceprint-result-v1:"))
      .map((k) => read(k, null))
      .filter(
        (r) =>
          r &&
          r.schemaVersion === 1 &&
          typeof r.roundId === "string" &&
          typeof r.modeId === "string" &&
          languages.includes(r.language) &&
          typeof r.won === "boolean" &&
          count(r.attempt) &&
          r.attempt < 5 &&
          typeof r.completedAt === "string" &&
          Number.isFinite(Date.parse(r.completedAt)),
      )
      .sort(
        (a, b) =>
          a.completedAt.localeCompare(b.completedAt) ||
          a.roundId.localeCompare(b.roundId),
      );
  }
  function statistics(modeId = "classic") {
    const legacy = read("voiceprint-language-stats", {});
    const result = Object.fromEntries(
      languages.map((lang) => [
        lang,
        modeId === "classic" && validStats(legacy?.[lang])
          ? structuredClone(legacy[lang])
          : blankStats(),
      ]),
    );
    for (const entry of history().filter((r) => r.modeId === modeId))
      result[entry.language] = recordResult(
        result[entry.language],
        entry.won,
        entry.attempt,
      );
    return result;
  }
  // One immutable key per round avoids read/modify/write conflicts between tabs.
  function append(result) {
    return save(`voiceprint-result-v1:${result.roundId}`, result);
  }
  return { read, save, recent, history, statistics, append };
}
