export function chooseOperator(
  operators,
  language,
  recent = [],
  random = Math.random,
) {
  const eligible = operators.filter((o) => o.voices[language]);
  const pool = eligible.filter((o) => o.id !== recent.at(-1));
  if (!pool.length)
    throw new Error("At least two operators are required per language");
  const fresh = pool.filter((o) => !recent.includes(o.id));
  const repeated = pool.filter((o) => recent.includes(o.id));
  if (fresh.length && (!repeated.length || random() >= 0.001))
    return fresh[Math.floor(random() * fresh.length)];
  const weighted = (fresh.length ? repeated : pool).map((o) => ({
    o,
    weight: (recent.length - recent.lastIndexOf(o.id)) ** 4,
  }));
  let roll = random() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
  return (
    weighted.find((entry) => (roll -= entry.weight) < 0) || weighted.at(-1)
  ).o;
}

export function chooseLines(operator, language, random = Math.random) {
  const available = operator.clips[language];
  const title = available.find((c) => c.id === "037");
  const other = available.filter((c) => c.id !== "037");
  if (!title || other.length < 4) throw new Error("Insufficient voice lines");
  const pick = (list) => list[Math.floor(random() * list.length)];
  const trust = other.filter((c) => c.kind === "trust");
  const finale = pick(
    trust.length
      ? trust
      : [...other].sort((a, b) => b.duration - a.duration).slice(0, 3),
  );
  let pool = other.filter((c) => c.id !== finale.id);
  const shorter = pool.filter((c) => c.duration <= finale.duration);
  if (shorter.length >= 3) pool = shorter;
  const selected = [];
  // Sample without replacement, then order by duration. The trust line stays last.
  while (selected.length < 3)
    selected.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  selected.sort((a, b) => a.duration - b.duration);
  return [title.id, ...selected.map((c) => c.id), finale.id];
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
