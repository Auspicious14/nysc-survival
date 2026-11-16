// Copies the games into public/:
//  - game3d-src/  (the 3D game) → public/game3d/, wrapping index.html in a full HTML document
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
  // no inline scripts in the wrapper (the Content-Security-Policy only allows hashed ones): the service worker is registered from boot.js
  fs.writeFileSync("public/game3d/boot.js", `if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));\n`);
  fs.writeFileSync("public/game3d/index.html", `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<script src="/game/config.js"></script>\n<script src="/game3d/boot.js"></script>\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
  // supabase-js, self-hosted: copied from the exact version pinned in package.json (no CDN at runtime)
  const lib = "node_modules/@supabase/supabase-js/dist/umd/supabase.js";
  fs.mkdirSync("public/game3d/vendor", { recursive: true });
  if (fs.existsSync(lib)) fs.copyFileSync(lib, "public/game3d/vendor/supabase.js");
  else if (process.env.VERCEL || process.env.CI) throw new Error(`${lib} is missing: run npm install`);
  else console.warn(`warning: ${lib} not found (run npm install); online play on your own site needs it`);
  console.log("3D game synced → public/game3d/");
}
// The old single-file game (game-src/) is retired and no longer published; /classic and /game redirect to /play.
fs.rmSync("public/game", { recursive: true, force: true });
