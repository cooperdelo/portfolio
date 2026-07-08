# WORLD BUILD BRIEF — cooperdelo.com/world (3D interactive portfolio)

> **You are a coding agent (Claude Code / Cursor / Cline) running locally in `F:\Github\Portfolio`.**
> Your job: build an **ultra-realistic, vintage, interactive 3D "studio" portfolio** at the route `/world`, using **React Three Fiber + Vite**, with **real downloadable 3D models** and **every real photo/artifact** already on Cooper's site. You have a real terminal (you can `curl`/`npm`/download GLB models) and — critically — **you must be able to SEE your render** (see §11). The previous agent (me) was blind and could not download models; that is why this handoff exists. Do not repeat that. Iterate against screenshots until it looks genuinely photoreal-vintage, not like "clay shapes."

---

## 0. READ THIS FIRST (mandatory context ingestion, in order)

Before writing code, read and internalize:

1. **The vault (Cooper's personal OS)** at `C:\Users\coope\Desktop\Claude`:
   - `C:\Users\coope\Desktop\Claude\CLAUDE.md` (root — system map)
   - `Context/user.md` (who Cooper is — identity, tone, facts)
   - `Projects/portfolio-website/CLAUDE.md` (site architecture, Supabase projects, admin)
   - `Projects/portfolio-website/3d-world-design-spec.md` (the evolving design spec — the source of design intent; READ FULLY)
   - `Advisors/health-advisor/context/*` and other advisor files only if you want deeper identity context.
2. **The current live site** in this repo (`F:\Github\Portfolio`). Read every public page to extract the exact sections, copy, photos, and videos (see §4). Do NOT guess — read the HTML:
   - `index.html` (Home), `plugverse.html`, `rubber-band.html` (Music), `athletic.html`, `lens.html`, `now.html`
   - `shell.css`, `shell.js` (shared styling + the existing custom cursor / page-transition system — match the brand)
3. **The current admin panel** at `admin/` (just redesigned to glassmorphic). Read `admin/_shell/admin-shell.css` and `admin/index.html` to match the visual language (rust `#FF4D2E`, cream `#F4EFE6`, deep black, Anton/Geist/Fraunces fonts, glassmorphism). The world must feel like the same brand.
4. **The current (weak) `/world`** = `world/index.html` — a vanilla-Three.js standalone I built while blind. It renders but is not good enough. **Treat it as reference for the concept + data mapping only.** You are replacing it with the R3F build.
5. **Enumerate every asset**: run `ls photos/` and `ls videos/` (and `ls photos/replay/`). There are ~100 photos and ~12 videos. The world must use as many as possible — Cooper spent enormous time on these and wants them ALL surfaced.

**Non-negotiable principle:** *Include every single picture, video, and artifact currently on the site. Nothing gets left behind.*

---

## 1. WHO COOPER IS (for tone + content accuracy)

Cooper Delo, 20, Chapel Hill NC. UNC Kenan-Flagler (Business + CS second major, 3.867 GPA, grad Spring 2028, studying abroad in Singapore Spring 2027). Solo founder + engineer of **Plugverse** (a two-sided marketplace for live-music booking; NC LLC; 1789 Venture Lab grant; pre-launch — his #1 priority). Bassist in the cover band **Rubber Band** (~$3k/semester) and solo artist **Cooper Delo** (34k+ Spotify streams; EP "Flicker of Time"). Photographer (Canon S100 + iPhone 17 Pro + DJI). Lifter (PPL 5x/week), golfer (a hole-in-one), snowboarder. Brand voice: confident, understated, "build it, ship it, run it back."

Palette: **rust `#FF4D2E`**, cream `#F4EFE6`, deep near-black `#0B0806`, warm walnut/amber. Fonts: **Anton** (display), **Geist** / **Geist Mono** (UI), **Fraunces** (occasional serif). Mood: **vintage recording studio at night** — warm, dim, filmic, tactile.

---

## 2. THE CONCEPT (what to build)

An explorable **3D vintage recording studio**. On the back wall, a warm walnut **shelf holds 6 vinyl records** — one per real portfolio section. Each record's **cover art = one of Cooper's real photos**. The studio is dressed with **real 3D models** (turntable, bass on a stand, drum kit, studio monitors, lamp, plant, rug) and **walls papered with Cooper's real photos as framed pieces**.

**The signature interaction — "dive into the record":**
Clicking a record must feel like *entering that world*, NOT opening a sidebar.
1. The record **slides out of its sleeve** (a real vinyl disc with concentric grooves + a colored label), **spinning**.
2. The camera **dollies toward it**; the record/label **fills the frame**; the camera flies **through the center hole** with a radial transition (fade-through-the-label or a mask wipe).
3. You arrive **inside that section's world**: an immersive gallery space where the section's **real photos hang as framed 3D planes** on curved walls / float around you, its **sub-modules render as 3D cards** (e.g., Lens's "The Kit" as floating gear cards with spec rows; trips as photo clusters; reels as looping `VideoTexture` planes), a cinematic **title**, and an **ultra-vintage glassmorphic HUD** with the achievement rows.
4. Look around (drag / scroll), **click a photo → it flies forward full-screen** (3D lightbox).
5. **"← back to the studio"** pulls the camera back out through the record into the room.

Everything **damped/eased** (use `maath/easing` or lerp), depth-of-field focus pulls, warm film grade, subtle dust motes in the light. **60fps target; mobile-friendly (reduced DPR/lights).**

---

## 3. THE 6 SECTIONS (real routes — match nav order)

From the site nav (all use `cleanUrls`, so links have no `.html`):
`Home (/)`, `Plugverse (/plugverse)`, `Music (/rubber-band)`, `Athletic (/athletic)`, `Lens (/lens)`, `Now (/now)`.

Each record → one section. Cover art + galleries below are a STARTING map — **verify/extend by reading each page's HTML** (§4) and pull in ALL of that page's images/videos.

| Section | Route | Cover photo | Accent | Notes |
|---|---|---|---|---|
| **Home** | `/` | `cooper_park_portrait.jpg` | cream | Identity / about. Big photo wall of portraits. |
| **Plugverse** | `/plugverse` | `Plugverse_picture.jpeg` | lavender `#C9BEE6` | The startup. Product shots + `plugverse_ui.mp4` / `hero_plugverse_product.mov` reels. |
| **Music** | `/rubber-band` | `flicker_of_time_ep_cover.jpg` | rust `#FF4D2E` | Gig galleries + `rubber_band_live_4.mov`, `cat_cradle_performance.mov`; embed Apple Music if desired. |
| **Athletic** | `/athletic` | `golf_swing_finish.jpg` | cyan `#B2E3E1` | Golf/lift/snowboard galleries + `golf_swing_iron.mov`, `golf_swing_driver.mov`, `driver_swing_golf_2.mov`, `iron_swing_2.mov`. |
| **Lens** | `/lens` | `cooper_tux_with_canon.jpg` | sand `#E7C9A0` | RICH: "The Kit" (4 gear cards), 6 travel trips w/ galleries, reels, Apple Music Replay archive. See §4a. |
| **Now** | `/now` | `cooper_suit_campus.jpg` | sage `#7A8A6E` | Current status: Plugverse launch, Truist internship, Singapore prep. |

### 3a. LENS is the template for "rich sub-modules" (read `lens.html` fully)
Lens contains, in order: **01 Manifesto** (copy over `landscape_house_view_1.jpg`), **02 Travel** (6 trip cards — Carmel, Thailand, Ireland, Cancún, London, Panama — each with a title, meta row [date/duration/coords], blurb, and a **gallery** of trip photos), **03 The Reel** (4 looping videos: `cat_cradle_performance.mov`, `coldplay_crowd.mov`, `golf_swing_iron.mov`, `studio_overview.mov`), **04 The Kit** (4 gear cards: **iPhone 17 Pro**, **Canon S100**, **Moment VND**, **DJI Mic** — each with a photo + 4 spec rows), **05 In Rotation** (Apple Music Replay embed + monthly replay cards `photos/replay/replay-2026-0X.jpg`). **Reproduce these sub-modules as 3D/immersive elements in the Lens "dive" world.** Every other section has analogous sub-modules in its page — read them and reproduce.

---

## 4. ASSET INVENTORY (use ALL of it)

- **Photos:** `photos/` (~100 files) → served at `/photos/<name>` (same-origin → textures load with no CORS issue). Includes: portraits (`cooper_*`), gig shots (`gig_rubber_*`, `concert_*`, `solo_cooper_bass.jpeg`, `cooper_*bass*`), Plugverse (`Plugverse_picture.jpeg`, `plugverse_*`, `luby_pic_with_check.jpg`), golf/athletic (`golf_*`, `iron_pic_*`, `hole_in_one_par_4.JPG`, `snowboard_athletics.jpg`), travel (`thailand_*`, `ireland_trip_1..6`, `london_trip_*`, `panama_trip_*`, `carmel_trip_*`, `cancun_trip_*`, `santa_cruz_coast.jpg`, `obx_*`, `vegas_trip_*`, `charleston_trip_1.jpg`, `landscape_*`), **gear** (`gear-rig-bass/amp/marshall/pedals/prs/takamine`, `gear-studio-mic/interface/headphones/midi`, `gear-camera-canon/iphone/vnd-filter/dji-mic`, `gear-golf-driver/iron/putter/bag`), EP art (`flicker_of_time_ep_cover.jpg`), studio (`recording_studio.jpg`, `studio_recording_session.jpg`), replay cards (`photos/replay/replay-2026-01/02/03.jpg`).
  - ⚠ **Case-sensitive on Vercel/Linux.** `Plugverse_picture.jpeg`, `solo_cooper_bass.jpeg`, `hole_in_one_par_4.JPG` — match exact case, or the texture 404s. Verify each filename with `ls`.
- **Videos:** `videos/` (~12 `.mov`/`.mp4`) → `/videos/<name>`. Use as `VideoTexture` on record covers and reel planes: `rubber_band_live_4.mov`, `cat_cradle_performance.mov`, `coldplay_crowd.mov`, `golf_swing_iron.mov`, `golf_swing_driver.mov`, `driver_swing_golf_2.mov`, `iron_swing_2.mov`, `studio_overview.mov`, `plugverse_ui.mp4`, `hero_plugverse_product.mov`, `landscape_ambient_loop.mov`, `clip_mvi_0652.mov`. (Autoplay muted+loop+playsinline.)
- **Cooper's résumé/gear specs** live in `lens.html` (The Kit) and vault `Context/user.md` — use for the metadata rows.

**Deliverable expectation:** the world should feel like walking through Cooper's entire archive — dozens of real photos on the studio walls + the full set surfaced inside each section's dive.

---

## 5. VISUAL / REALISM SPEC (this is where the last version failed)

- **Real materials, not flat colors.** Use `@react-three/drei` `<Environment preset="apartment"|"warehouse"|"night">` (or a custom HDRI in `/world/hdri/`) so metal (turntable, records) and glass reflect properly. This single change removes the "clay" look.
- **Records:** real vinyl — dark PBR disc with a **concentric-groove normal/roughness map** (generate one, or download a vinyl texture), a colored center label, subtle anisotropic sheen. Cover art = the section photo on the sleeve (front face only; the disc lives *inside/behind* the sleeve and peeks only slightly above the top edge — do NOT plaster the disc over the cover art).
- **Wood:** real walnut PBR (albedo + normal + roughness). Download a seamless wood texture set (or use `drei` `useTexture`).
- **Lighting:** one warm key (SpotLight, soft shadows, `shadow-mapSize 2048`), warm fill, a rust rim, low ambient. **ACES filmic tone mapping**, exposure ~1.05. Warm, dim, moody — a night studio.
- **Post-processing** (`@react-three/postprocessing`): `Bloom` (subtle), `DepthOfField` (focus pulls on dive), `Noise`/film grain, `Vignette`, `SMAA`. This is the "vintage filter." Add a mild color grade (`HueSaturation`/`BrightnessContrast` or a LUT) for the warm vintage look.
- **Glassmorphism** for all HUD/overlays: frosted `backdrop-filter: blur(26px) saturate(150%)`, thin cream border, top sheen line, deep shadow — match `admin-shell.css` v3.
- **Motion:** dust motes (points) drifting in the key light; records breathe; camera idle parallax; all transitions eased (cubic-bezier / `maath/easing.damp3`).

---

## 6. REAL 3D MODELS — download these (you CAN; I couldn't)

Source **CC0 / CC-BY** GLB models, drop into `world-src/public/models/`, optimize, and load with `useGLTF`. Good sources:
- **Poly Pizza** (`poly.pizza`) — CC0 low-poly, direct GLB downloads: search "turntable", "record player", "vinyl", "bass guitar", "electric guitar", "drum kit", "bookshelf", "studio monitor / speaker", "floor lamp", "potted plant", "rug".
- **Sketchfab** — filter Downloadable + CC. Great for a realistic **turntable** and **bass**. (Some need a free login to download.)
- **Quaternius** (`quaternius.com`) — CC0 instrument/furniture packs.
- **Khronos glTF-Sample-Assets** (GitHub) — reliable test models.
- Workflow: `npx gltfjsx public/models/turntable.glb --transform` → generates a `<Turntable/>` component + a Draco/meshopt-compressed `.glb`. Repeat per model. Keep total payload lean (compress textures to KTX2/WebP where possible).

Minimum model set: **turntable/record player, a bass guitar (on a stand), a drum kit, 2 studio monitors, a record shelf/crate, a floor lamp, a plant, a rug.** Replace ALL primitive stand-ins from `world/index.html`.

---

## 7. TECH STACK & PROJECT SETUP

- Create the app in **`F:\Github\Portfolio\world-src\`** (a starter `package.json` already exists there — extend it): React 18, `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `zustand` (state), `maath` (easing), `vite`, `@vitejs/plugin-react`.
- **Vite config:** `base: '/world/'`, `build.outDir: '../world'` (so `npm run build` overwrites `F:\Github\Portfolio\world\` — the deployed route). Put static assets (models, hdri) in `world-src/public/`.
- **Deploy model:** the main site is **static on Vercel** (`vercel.json`, `cleanUrls: true`). Do **NOT** add a root build step. **Build locally** (`npm run build`) and **commit the built `/world` output** — Vercel serves it statically. Keep `world-src/node_modules` out of git (repo `.gitignore` covers `node_modules`).
- Photos/videos are same-origin (`/photos`, `/videos`) → textures load without CORS. In `npm run dev` (localhost), reference the live absolute URLs `https://www.cooperdelo.com/photos/...` OR copy a subset into `world-src/public/photos/` for local dev.
- **Do not touch the existing static pages** (`index.html`, `lens.html`, etc.) except to add a link to `/world` if Cooper wants one.

---

## 8. INTERACTION SPEC (detailed)

- **Idle (studio):** bounded `OrbitControls` (or custom) — you're inside the room, can't clip through walls. Slow mouse parallax. Records hover-lift with accent glow + floating label.
- **Dive (on record click):** state machine `studio → ejecting → diving → section → returning`. Eject the disc (spinning), dolly the camera toward it, scale the cover/label to fill frame, radial mask/fade **through the hole**, arrive in section world. Use DOF to rack focus during the dive.
- **Section world:** real photos as framed planes on a curved wall / floating ring you rotate through; sub-modules as 3D cards (Kit/trips/reels); glass HUD with title + achievement rows; click a photo → 3D lightbox (flies forward, dims rest). `← back` returns through the record.
- **Sound (optional, muted by default):** ambient room hum + soft click/whoosh on dive (a mute toggle top-right).
- **Loader:** asset-progress bar → the room resolves (wireframe-reveal or fade-in).

---

## 9. PITFALLS I ALREADY HIT (avoid)

1. **`Object.assign(mesh, {position: new Vector3()})` silently broke the whole scene (black screen).** Never use `Object.assign` to set three.js object props — assign directly.
2. **Cross-origin textures throw in WebGL.** On the real domain, `/photos` is same-origin (fine). For localhost dev pulling from cooperdelo.com, either add a CORS header or copy assets into `public/`.
3. **Case-sensitive filenames** 404 in production — verify with `ls`.
4. **Don't cover the record art with the disc** (my bug). Disc lives inside the sleeve; only a sliver peeks above the top.
5. Keep an eye on **shadow/light intensity + tone mapping** — without ACES + reasonable intensities the scene blows out to solid color.

---

## 10. ACCEPTANCE / DEFINITION OF DONE

- [ ] `/world` renders a **real, vintage, warm 3D studio** with **real GLTF models** (no primitive shapes).
- [ ] Six records, **covers = real photos**, on a real shelf. Discs are inside sleeves.
- [ ] **"Dive into the record"** works for all 6 sections — cinematic transition into an immersive section world (not a flat sidebar).
- [ ] Each section world surfaces **that section's real sub-modules + ALL its photos/videos** (Lens = Kit + trips + reels + replay, etc.).
- [ ] Studio walls are **papered with Cooper's real photos** as framed 3D pieces; the full archive is reachable.
- [ ] **Reflections (env map), bloom, depth-of-field, film grain, vintage grade, glassmorphic HUD.** 60fps, mobile-OK.
- [ ] Matches brand (rust/cream/walnut, Anton/Geist). Deploys statically at `cooperdelo.com/world`.
- [ ] You verified it visually via screenshots (see §11) and iterated until it looks genuinely premium.

---

## 11. HOW TO SEE YOUR OWN WORK (do this — it's the whole point)

The last agent was blind. You must not be. Set up a **screenshot loop**:
1. `cd world-src && npm run dev` (Vite serves at `http://localhost:5173/world/`).
2. Attach a **Playwright / Puppeteer MCP** (or use the built-in browser tool if your client has one). Navigate to the localhost URL, **wait for the canvas, take a screenshot**, and **look at the screenshot with vision.**
3. Critique your own render against §5 and §10, fix, re-screenshot. Loop until it's genuinely photoreal-vintage.
4. Repeat for the dive transition and each section world (drive the interaction, screenshot mid-animation).
Also viewable by Cooper directly at `localhost:5173/world/` — ask him for feedback when he's around, but you should be able to self-verify.

---

## 12. DEPLOY

```
cd F:\Github\Portfolio\world-src
npm install
npm run build           # outputs to ../world  (base=/world/)
cd F:\Github\Portfolio
git add world world-src/src world-src/package.json world-src/vite.config.* world-src/index.html
git commit -m "world: real R3F build — models, dive interaction, real photos"
git push origin main    # Vercel auto-serves /world statically
```
(Confirm `world-src/node_modules` is gitignored. Do not add a root-level build step to Vercel.)

---

## 13. WHERE TO FIND CONTEXT (quick reference)
- Repo: `F:\Github\Portfolio` → cooperdelo.com (Vercel, static, cleanUrls).
- Vault: `C:\Users\coope\Desktop\Claude` (read `CLAUDE.md`, `Context/user.md`, `Projects/portfolio-website/3d-world-design-spec.md`).
- Photos: `F:\Github\Portfolio\photos` → `/photos`. Videos: `F:\Github\Portfolio\videos` → `/videos`.
- Current weak world (concept ref): `F:\Github\Portfolio\world\index.html`.
- Admin (brand ref, just glassmorphic-upgraded): `F:\Github\Portfolio\admin\`.
- Supabase (for live data later, not needed for v1): portfolio `eibtnkaoqsgwiqttiwjo`, plugverse app `yhemvsksnoojplnxirlv`.

**Build it like it's Cooper's flagship. Real artifacts, every photo, vintage and cinematic. Verify with your own eyes. Ship it.**
