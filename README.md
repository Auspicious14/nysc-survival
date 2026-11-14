# NYSC Survival

A Nigerian NYSC life game in the browser: orientation camp, the Lagos street, monthly clearance, your PPA school and CDS week.
Fictional people and places. Not an official NYSC product.

- **/play** – the 3D game (source in `game3d-src/`, served from `public/game3d/`)
- **/classic** – the earlier single-file game (`game-src/nysc-survival-v2.html`)
- **/** – landing page

## Run it

    npm install
    cp .env.example .env.local   # optional: Supabase URL + anon key for the classic game
    npm run dev                  # http://localhost:3000/play

`npm run dev` and `npm run build` first run `scripts/sync-game.mjs`, which copies `game3d-src/` into `public/game3d/`
(wrapping `index.html` in a full HTML document) and skips build-only folders (`bake/`, `tools/`).

Deploy: import the repo in Vercel. No build settings needed. Add the two Supabase env vars only if you use the classic game.

## The 3D game (`game3d-src/`)

| Path | What it is |
|---|---|
| `index.html` | HUD, phone, dialogue panels, loader (no `<html>`/`<head>` – the sync script adds them) |
| `js/game.js` | the whole game: world, characters, story chapters, phone, sound |
| `models/*.gltf.json` + `*.b64.txt` | characters and vehicles (glTF JSON + base64 buffer) |
| `models/tex/*.jpg`, `models/clips.json` | pre-baked outfits and retargeted animations |
| `audio/afrobeat*.mp3` | stage / street music (Pixabay, credited in `models/credits.txt`) |
| `voice/*.mp3` + `voice/manifest.json` | recorded Nigerian-English lines (YarnGPT) |
| `bake/` | source rigs used only by the bake tool |
| `js/naija.js` | 37 states, 774 LGAs, camps, zones (regenerate with `python3 tools/mknaija.py ng.states.json js/naija.js`) |
| `js/phonegames.js` | phone games: Whot!, Danfo Dash |
| `js/osmworld.js` + `osm/*.json` | real towns from OpenStreetMap (© OpenStreetMap contributors, ODbL); rebuild with `tools/NYSC_OSM_Extract.ipynb` then `python3 tools/osm_prep.py <folder> osm/` |
| `js/net.js` | online corpers: the claude.ai artifact `room` capability, or BroadcastChannel between tabs of one browser. Camp room per state, street room per LGA, PPA colleagues tagged. A hosted realtime server is needed for the Vercel site |
| `tools/simplify.js` | decimates a character mesh: `node tools/simplify.js models/lewis 0.3` (originals kept in `bake/orig/`) |
| `tools/bake.js` | re-bakes outfits + clips: `node tools/bake.js game3d-src http://localhost:8765/index.html` (serve `game3d-src/` first) |
| `tools/extract_lines.py`, `tools/NYSC_Voices_YarnGPT.ipynb` | voice pipeline: extract lines → generate on Colab → drop the zip into `voice/` |

Controls: WASD/arrows, Shift to run, drag to look, E to interact, P for phone. On phones: touch the left half to walk, drag the right half to look.

Never put the Supabase service_role key anywhere in this project.
