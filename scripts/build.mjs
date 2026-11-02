import { mkdir, copyFile, readFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
for (const name of ["index.html", "style.css", "app.js", "core.js"])
  await copyFile(`src/${name}`, `dist/${name}`);
const data = JSON.parse(await readFile("dist/game-data.json", "utf8"));
console.log(`Built static site: ${data.operators.length} operators`);
