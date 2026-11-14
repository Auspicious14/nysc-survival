// Copies the games into public/:
//  - game3d-src/  (the 3D game) → public/game3d/, wrapping index.html in a full HTML document
//  - game-src/nysc-survival-v2.html (the earlier single-file game) → public/game/index.html (+ Supabase config script)
import fs from "node:fs";
import path from "node:path";
const SKIP = new Set(["bake", "tools", "__test.html"]); // build-time only, not served
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
if (fs.existsSync("game3d-src")) {
  copyDir("game3d-src", "public/game3d");
  const body = fs.readFileSync("game3d-src/index.html", "utf8");
  fs.writeFileSync("public/game3d/index.html", `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<script src="/game/config.js"></script>\n<script>if (\"serviceWorker\" in navigator) addEventListener(\"load\", () => navigator.serviceWorker.register(\"/sw.js\").catch(() => {}));</script>\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
  console.log("3D game synced → public/game3d/");
}
if (fs.existsSync("game-src/nysc-survival-v2.html")) {
  const src = fs.readFileSync("game-src/nysc-survival-v2.html", "utf8");
  const tag = '<script src="/game/config.js"></script>';
  const out = src.includes(tag) ? src : src.replace(/<head[^>]*>/i, (m) => m + "\n" + tag);
  fs.mkdirSync("public/game", { recursive: true });
  fs.writeFileSync("public/game/index.html", out);
  console.log("classic game synced → public/game/");
}
