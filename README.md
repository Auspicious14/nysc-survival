# Kopa Life (formerly NYSC Survival)

A Nigerian NYSC life game in the browser: orientation camp, the Lagos street, monthly clearance, your PPA school and CDS week.
Fictional people and places. Not an official NYSC product.

- **/play** – the 3D game (source in `game3d-src/`, served from `public/game3d/`)
- **/classic** – the earlier single-file game (`game-src/nysc-survival-v2.html`)
- **/** – landing page: a static, dependency-free scroll story at `public/landing/index.html` (served at `/` by a rewrite in `next.config.mjs`); screenshots in `public/landing/img/` are real gameplay captures

## Run it

    npm install
    cp .env.example .env.local   # Supabase URL + anon key: online corpers in the 3D game, chat in the classic game
    npm run dev                  # http://localhost:3000/play

`npm run dev` and `npm run build` first run `scripts/sync-game.mjs`, which copies `game3d-src/` into `public/game3d/`
(wrapping `index.html` in a full HTML document) and skips build-only folders (`bake/`, `tools/`).

Deploy: import the repo in Vercel. No build settings needed.

### Online corpers (Supabase Realtime)
The 3D game meets other players through Supabase Realtime **broadcast channels** – no tables, no sign-in.
`/game/config.js` hands the game your project URL and anon (publishable) key from Vercel env vars:
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the Vercel Supabase integration's `SUPABASE_URL` / `SUPABASE_ANON_KEY` also work). Never the service-role key.
In Supabase → Realtime → Settings, public channels must be allowed (the default). Channels: `nysc3d:lobby`, `nysc3d:camp-<state>`, `nysc3d:town-<state>-<lga>`.
Each player sends ~5 updates a second while moving and one every 2 s when still; the free plan's Realtime message quota is plenty for testing with friends.
Without config the game falls back to the claude.ai room (as an artifact) or to tabs of the same browser.

Chat: group chat per place, private messages, swipe-to-reply, emojis and original Naija stickers, all carried in each player's lobby presence (nothing stored). "Private" means only the recipient's game shows it; it is not end-to-end encrypted.

### Performance, data and installing
- **Graphics: Auto / Lite / High** (Phone → Settings). Auto measures the first seconds of play and switches slow phones to Lite (lower resolution, no shadows, shorter draw distance).
- Big textures are WebP; voice clips load only when spoken; music streams. First visit ≈ 11–12 MB over the wire (Vercel compresses the model text files), later visits mostly come from the cache.
- Installable as an app: `public/manifest.webmanifest` + `public/sw.js` (pages network-first, game files cached and refreshed in the background).

### Sharing
- Share cards (1080×1920, made for WhatsApp Status/TikTok) from the chapter results and from My NYSC; WhatsApp button, native share on phones, save image, copy link.
- Invite links: `/play?state=NR&lga=Lafia` open the game in your friend's state and post them to the same LGA.

### Player stats (admin) and live counts
Run the **PLAYER STATS** part of `supabase/supabase_schema.sql`, then set your admin key with the commented `insert into public.app_secrets …` line (12+ characters).
- `/admin` – your dashboard: online now, total players, today/week/new, hours played, players and online per state, top LGAs, new players per day. Asks for the admin key.
- Players see a glimpse: Corper Connect shows how many are playing now and how many in their state; the landing page shows a live "playing now" pill.
- The game pings once a minute with a random per-device id, state, LGA and area. No names or personal data are stored.

### Keeping the free Supabase project awake
Supabase pauses free projects after 7 days without activity. `vercel.json` schedules a daily Vercel Cron call to `/api/keepalive`, which reads the one-row `keepalive` table (run the bottom of `supabase/supabase_schema.sql` once). Optional: set `CRON_SECRET` in Vercel to lock the route. Backup: `.github/workflows/supabase-keepalive.yml` pings every 3 days if you add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as GitHub Actions secrets.

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
| `js/net.js` | online corpers: the claude.ai artifact `room` capability, or BroadcastChannel between tabs of one browser. Camp room per state, street room per LGA, PPA colleagues tagged. On the website it uses Supabase Realtime (see below) |
| `tools/simplify.js` | decimates a character mesh: `node tools/simplify.js models/lewis 0.3` (originals kept in `bake/orig/`) |
| `tools/bake.js` | re-bakes outfits + clips: `node tools/bake.js game3d-src http://localhost:8765/index.html` (serve `game3d-src/` first) |
| `tools/extract_lines.py`, `tools/NYSC_Voices_YarnGPT.ipynb` | voice pipeline: extract lines → generate on Colab → drop the zip into `voice/` |

Controls: WASD/arrows, Shift to run, drag to look, E to interact, P for phone. On phones: touch the left half to walk, drag the right half to look.

Never put the Supabase service_role key anywhere in this project.

## Search pages (SEO)

`python3 scripts/build-seo.py --shots <dir>` regenerates the static search pages from the game's own state data:
`/states`, `/states/<state>` (36 states + FCT), `/nysc-slang`, `/nysc-camp-guide`, plus `public/sitemap.xml` and `public/robots.txt`.
They live in `public/seo/` and are served at clean URLs by the rewrites in `next.config.mjs`.
`--shots` takes a folder of in-game screenshots named `<STATE_ID>_street.jpg`.

## Moving players to the main domain

Saves live in each address's own browser storage. To send players from a `*.vercel.app` address to the main domain
without losing progress, set `MOVE_TO_DOMAIN=https://kopalife.com.ng` in Vercel (Production) and redeploy.
`/game/config.js` then forwards visitors of the vercel.app address to the same page on the main domain and carries
their game data (`nysc*` keys only) in the link; the main domain keeps whichever save has more progress.
Do not use Vercel's own domain redirect for the vercel.app address, because a server redirect cannot carry saves.

## Security

- **Supabase**: run `supabase/security_2026_11.sql` once on an existing project (fresh projects: `supabase_schema.sql` already includes it).
  Anonymous sign-ins and email sign-ups stay **off**; the game uses no accounts. The website reaches data only through functions,
  which check input and rate-limit per network. The admin key is stored bcrypt-hashed; 8 wrong keys lock a network out for 15 minutes.
  Set or change it with:
  `insert into public.app_secrets (name, value) values ('admin_key', extensions.crypt('A-LONG-RANDOM-KEY', extensions.gen_salt('bf', 10))) on conflict (name) do update set value = excluded.value;`
- **Headers**: `next.config.mjs` sends a Content-Security-Policy per page type (inline scripts allowed only by SHA-256 hash,
  computed at build), plus nosniff, Referrer-Policy, Permissions-Policy and frame protection.
- **No CDN code**: supabase-js is pinned in package.json and copied into `public/game3d/vendor/` at build.
- **Online chat**: messages to everyone are public; private messages are end-to-end encrypted (ECDH P-256 + AES-GCM),
  and a player's id is the hash of their public key. Phone numbers and links are hidden. Reports go to the admin page.
- **Saves** are treated as untrusted input; the save move from vercel.app only accepts data when the visitor arrives from our own old address.
- Report vulnerabilities through GitHub private vulnerability reporting (see `/.well-known/security.txt`).
