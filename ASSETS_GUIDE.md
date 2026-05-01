# Cooper Delo Portfolio — Asset Drop Guide

Every slot in the codebase is wired and graceful — if a file is missing, it falls back silently or to a placeholder. Drop the files at the listed paths and they activate automatically.

Order matters: do them in priority order. Highest impact on top.

---

## TIER 1 — DO THESE FIRST (highest visual impact, lowest effort)

### 1. Hero ambient video — `videos/hero-ambient.mp4`
**Where it appears:** Behind the "Cooper Delo." title on index.html. The page already loads `photos/hero.jpeg` as the still backdrop — adding the video makes it cinematic. The video fades over the photo automatically once it loads.

**Specs:**
- Format: MP4 (H.264)
- Length: 6–10 seconds, looping
- Resolution: 1920×1080 minimum, 4K ideal
- File size: under 8MB (compress with HandBrake at CRF 26)
- No audio (it's muted anyway)

**AI prompts (Runway / Pika / Kling — minimal-motion mode):**
- "Slow drift across an empty stadium at dusk, single spotlight on stage, cinematic, 35mm film grain, no people, soft golden tungsten glow, subtle haze, anamorphic"
- "Aerial slow pan over Chapel Hill at dusk, soft purple sky, distant lit windows, no movement, dreamlike, 16mm film texture"
- "Close-up of vinyl record spinning very slowly on a turntable, warm room lighting, dust particles drifting, shallow depth of field"

**Real footage alternatives (skip AI entirely):**
- Pexels search: `"empty stage golden hour"`, `"city dusk aerial"`, `"vinyl spinning slow"`
- Mixkit: same searches, all royalty-free

---

### 2. Plugverse app mockup poster — `photos/plugverse_ui_poster.jpg`
**Where it appears:** The browser-mockup card in the Plugverse section (index.html + plugverse.html). Already uses `videos/plugverse_ui.mp4` — this is the still frame shown before the video loads (saves a flash of black).

**Specs:**
- Format: JPG, 1200×750 (16:10)
- File size: under 200KB
- Should match the first frame of `plugverse_ui.mp4` exactly

**How to make:** Open `videos/plugverse_ui.mp4` in any video editor or VLC, screenshot the first frame, save as JPG. Done.

---

### 3. Gym portrait — `photos/gym_portrait.jpg`
**Where it appears:** The "Iron." section on athletic.html (5-column right side, portrait-tall photo frame). This page currently has zero images — this is the most important.

**Specs:**
- Format: JPG, 3:4 portrait (e.g. 900×1200)
- Mood: dark, gritty, single-light-source
- File size: under 400KB

**Real photo (preferred):** Take a phone photo at your gym — barbell on the floor mid-set, hand on the bar, your shadow on the rack. Doesn't need to be of you. Gritty and contextual beats posed.

**AI prompt (if no photo available):**
- "Dark gym corner, single overhead light, weight plates stacked against a wall, dust visible in the beam, moody, kodak portra 400 film texture, 3:4 portrait, no people"
- "Black power rack with chalked grip, deadlift bar loaded with plates, dim warehouse gym, single tungsten bulb, photo-realistic, vertical 3:4"

---

### 4. Golf portrait — `photos/golf_portrait.jpg`
**Where it appears:** The "Golf." section on athletic.html (4-column left side).

**Specs:** JPG, 3:4 portrait, 900×1200, under 400KB.

**Real photo (preferred):** Phone photo from your last round — your hand on a tee box, a flag in the distance, an empty fairway at golden hour. Post-swing angles are great.

**AI prompt:**
- "Golf tee box at golden hour, single golf ball on tee, fairway disappearing into mist, dew on grass, soft warm light, photo-realistic, 3:4 portrait, no people, kodak portra"

---

### 5. Gym parallax divider — `photos/gym_floor.jpg`
**Where it appears:** Full-bleed parallax divider between the Iron and Why-It-Matters sections on athletic.html. Heavily darkened (CSS handles the filter).

**Specs:**
- Format: JPG, 16:9 landscape (e.g. 2400×1350)
- Subject: wide shot of gym floor, equipment, warehouse atmosphere
- File size: under 600KB

**AI prompt (still landscape — easy to generate):**
- "Wide angle warehouse gym floor, polished concrete, scattered weight plates, racks lining the walls, late afternoon light through high windows, photo-realistic, no people, cinematic"
- "Empty hardcore gym at 5am, dim overhead lights, wide angle, gritty, film grain, 16:9 landscape"

---

### 6. Golf parallax divider — `photos/golf_course.jpg`
**Where it appears:** Full-bleed parallax divider between Why-It-Matters and Golf sections. Heavily darkened.

**Specs:** JPG, 16:9, 2400×1350, under 600KB.

**AI prompt:**
- "Aerial top-down golf course at sunset, fairway curving through trees, sand traps catching golden light, wide cinematic 16:9, photo-realistic, no people, drone perspective"
- "Empty fairway at golden hour, long shadows, mist in the distance, mountains on horizon, photo-realistic landscape, 16:9"

---

## TIER 2 — STRONG ADDITIONS

### 7. Workspace photo for Now page — `photos/workspace.jpg`
**Where it appears:** Heavily darkened (CSS reduces brightness to 22%) behind the Now page header. Adds physical presence.

**Specs:** JPG, 16:9 landscape, 2000×1200, under 500KB.

**Real photo (best):** Snap a top-down or 45° angle of your actual desk — laptop open, coffee mug, notebook, pen. Mess is fine, character is the point.

**AI prompt:**
- "Top-down view of a coding workspace, dark wooden desk, MacBook open showing Next.js code on a dark theme, mechanical keyboard, coffee mug, notebook with pen, single warm desk lamp, no people, photo-realistic, late night"

---

### 8. Drag gallery video clips — already wired
The gallery has 2 video card slots (cards 3 and 7) using your existing rubber band MOV and plugverse UI mp4. They work as-is. To add more video cards: change any `<div class="drag-card">` to `<div class="drag-card is-video">` and add a `<video>` element before the `<img>`.

---

## TIER 3 — OPTIONAL POLISH

### 9. Plugverse app screenshot — `photos/plugverse_app_mockup.jpg`
The mockup card on index.html currently uses your video. If you want a still screenshot variant, drop a clean dashboard screenshot here. Otherwise leave it on video — it's more compelling.

### 10. Real Sketchfab GLTF models — `/models/*.glb`
The Three.js scene currently uses procedural geometry (wireframe bass guitar, vinyl, dumbbell, etc.). To upgrade to real models:

1. Download `.glb` files from [sketchfab.com](https://sketchfab.com) (filter: Downloadable + Free + CC license)
2. Specific searches that work well:
   - "vinyl record" → for the Cooper Delo section
   - "bass guitar low poly" → for Rubber Band
   - "dumbbell" → for Athletic
   - "macbook laptop" → for Builder
   - "synthesizer korg" → for Plugverse
3. Place each in `/models/` (e.g. `models/vinyl-record.glb`)
4. Add the GLTFLoader script tag to your HTML head:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js" defer></script>
   ```
5. Tell me when you've added the GLB files and I'll wire the loader into shell.js to swap procedural geometry for real models.

---

## AI VIDEO GENERATION TIPS (your stated preference: minimal motion)

**Best tools for "real-looking still landscapes with subtle motion":**
- **Runway Gen-3 Alpha** — best for cinematic, low-motion clips. Use motion strength 1–2 of 10.
- **Kling 1.6** — best for photo-realistic outdoor/nature with subtle wind motion.
- **Pika 2.0** — best for cinemagraphs (one element moving, rest static).
- **Luma Dream Machine** — best for slow camera pans and aerial perspectives.

**Universal prompt formula that works:**
> `[subject], [time of day], [light source], [film stock], cinematic, slow drift, no people, photorealistic, 16:9`

**What kills the realism:**
- Telling it "a person walks" — AI people still look uncanny
- Fast camera moves — they reveal the model's lack of consistency
- Crowded scenes — too many things to keep coherent
- Bright daylight — exposes texture flaws

**What helps:**
- Golden hour or blue hour lighting
- Static or near-static subjects
- Film grain mentioned in prompt
- 35mm or 16mm film references
- "anamorphic," "shallow depth of field," "bokeh"
- Always end with: `no people, photorealistic, cinematic`

---

## COMPRESSION CHECKLIST (do this before pushing)

**Images:**
- Use [squoosh.app](https://squoosh.app) — drag, set MozJPEG quality 78, download
- Target: under 400KB for portraits, under 600KB for landscapes
- Strip EXIF data (squoosh does this automatically)

**Videos:**
- Use HandBrake (free)
- Preset: "Web → Vimeo Young 1080p30"
- Adjust CRF to 26 if file is too large
- Strip audio track (saves ~10%)
- Target: under 8MB for hero, under 4MB for gallery clips

---

## CURRENT FALLBACK BEHAVIOR (you don't have to ship everything at once)

| Missing file | What happens |
|---|---|
| `videos/hero-ambient.mp4` | Hero shows the existing `hero.jpeg` still — looks identical to before |
| `photos/gym_portrait.jpg` | Photo frame shows "photos/gym_portrait.jpg (see AI guide)" placeholder text |
| `photos/golf_portrait.jpg` | Same fallback message in the photo frame |
| `photos/gym_floor.jpg` | Parallax divider falls back to existing `front-page-hero.jpg` |
| `photos/golf_course.jpg` | Same fallback to existing image |
| `photos/workspace.jpg` | Now-page header has no backdrop image; gradient still applies |
| `photos/plugverse_ui_poster.jpg` | Browser flashes black for ~50ms before video loads — minor |

So you can ship Tier 1 in pieces. The site never breaks.

---

## WHEN YOU'RE DONE

After dropping each batch of assets, ping me with:
1. Which files you added
2. Where you want refinement (color grading, additional placement, parallax intensity)

I'll fine-tune the CSS filters per asset so they fit the dark/cinematic grade.
