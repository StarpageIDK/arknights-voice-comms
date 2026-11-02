import { readFile } from "node:fs/promises";
const data = JSON.parse(await readFile("dist/game-data.json", "utf8"));
let checked = 0;
for (const lang of ["JP", "EN", "CN", "KR"]) {
  const operators = data.operators.filter((o) =>
    o.voices[lang]?.["037"]?.startsWith("https://"),
  );
  for (const operator of [
    operators[0],
    operators[Math.floor(operators.length / 2)],
    operators.at(-1),
    data.operators.find((o) => o.name === "Kafka"),
  ]) {
    const url = operator.voices[lang]["037"];
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok)
      throw Error(`${lang} ${operator.name}: ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (
      bytes.length < 100 ||
      !(
        bytes[0] === 0xff ||
        (bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51)
      )
    )
      throw Error(`Invalid MP3: ${url}`);
    if (response.headers.get("access-control-allow-origin") !== "*")
      throw Error("Audio is not accessible cross-origin");
    checked++;
  }
}
console.log(
  `Verified ${checked} real MP3 downloads and browser CORS across all languages`,
);
