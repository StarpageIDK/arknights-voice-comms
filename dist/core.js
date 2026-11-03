export function chooseOperator(
  operators,
  language,
  recent = [],
  random = Math.random,
) {
  const eligible = operators.filter((o) => o.voices[language]);
  if (!eligible.length) throw new Error("No operators match these filters");
  // Prefer anything outside the last 50. Small pools fall back to the least
  // recently seen operator, so every eligible choice remains playable.
  const history = recent.slice(-50);
  let pool = eligible.filter((o) => !history.includes(o.id));
  if (!pool.length) {
    const oldest = Math.min(...eligible.map((o) => history.lastIndexOf(o.id)));
    pool = eligible.filter((o) => history.lastIndexOf(o.id) === oldest);
  }
  return pool[Math.floor(random() * pool.length)];
}

export function normalizeName(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
export function matchesName(operator, query, exact = false) {
  const normalized = normalizeName(query);
  if (!normalized) return false;
  return [operator.name, ...(operator.aliases || [])].some((name) =>
    exact
      ? normalizeName(name) === normalized
      : normalizeName(name).includes(normalized),
  );
}
export function eligibleOperators(operators, language, rarities) {
  return operators.filter(
    (o) => o.voices[language] && rarities.includes(o.rarity),
  );
}
export function streakTier(streak) {
  return streak >= 25
    ? "legend"
    : streak >= 10
      ? "blazing"
      : streak >= 5
        ? "hot"
        : streak >= 3
          ? "warm"
          : "";
}
export function chooseLines(operator, language, random = Math.random) {
  const available = operator.clips[language];
  const pick = (list) => list[Math.floor(random() * list.length)];
  const title = available.find((c) => c.id === "037");
  const battle = pick(
    available.filter((c) => ["025", "026", "027", "028"].includes(c.id)),
  );
  const deployment = pick(
    available.filter((c) => ["023", "024"].includes(c.id)),
  );
  if (!title || !battle || !deployment)
    throw Error("Missing required voice categories");
  const remaining = available.filter(
    (c) => ![title.id, battle.id, deployment.id].includes(c.id),
  );
  const trust = remaining.filter((c) => c.kind === "trust");
  const finale = pick(trust.length ? trust : remaining);
  const talks = remaining.filter(
    (c) => c.id !== finale?.id && c.kind === "talk",
  );
  const fourth = pick(
    talks.length ? talks : remaining.filter((c) => c.id !== finale?.id),
  );
  if (!finale || !fourth) throw Error("Insufficient voice lines");
  return [title.id, battle.id, deployment.id, fourth.id, finale.id];
}

export function recordResult(previous, won, attempt) {
  const stats = structuredClone(previous);
  stats.played++;
  if (won) {
    stats.won++;
    stats.streak++;
    stats.best = Math.max(stats.best, stats.streak);
    stats.distribution[attempt]++;
  } else stats.streak = 0;
  return stats;
}
