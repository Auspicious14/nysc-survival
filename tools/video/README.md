# Trailer tooling

Renders the vertical ad and gameplay video from the real game, frame by frame (Playwright + a frozen page clock).

1. Serve the game: `cd game3d-src && python3 -m http.server 8765` (with `__test.html` generated from `index.html`).
2. `node scenes.js <scene>` for each scene (gate register kit social parade posting street phone ppa clearance result) → `clips/<scene>.mp4` + a log of the voice lines it played. `node scenes.js <scene> preview 40,120` saves just those frames.
3. `node mkov.js` → caption overlays and the end card (`captions.json`, `endcard.html`).
4. `python3 compose.py ad gameplay` → `out/kopalife_ad.mp4` (24 s) and `out/kopalife_gameplay.mp4` (84 s): cuts, captions, game voices, the game's Afrobeat track ducked under the voices.
