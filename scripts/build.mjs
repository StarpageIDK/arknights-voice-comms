import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
for (const name of [
  "index.html",
  "favicon.png",
  "style.css",
  "app.js",
  "core.js",
  "game.js",
  "storage.js",
  "audio.js",
])
  await copyFile(`src/${name}`, `dist/${name}`);
const data = JSON.parse(await readFile("dist/game-data.json", "utf8"));
console.log(`Built static site: ${data.operators.length} operators`);

// A content hash identifies the exact roster used by a completed round.
const { createHash } = await import("node:crypto");
delete data.contentVersion;
data.contentVersion = createHash("sha256")
  .update(JSON.stringify(data))
  .digest("hex");
await writeFile("dist/game-data.json", JSON.stringify(data, null, 2) + "\n");
