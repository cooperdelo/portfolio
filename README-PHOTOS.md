# Changing a photo on the site

Every photo on the generated pages (home, /work/*, /plugverse, /resume, footers) is listed once in `content/photos.json`.

1. Open `content/photos.json` and find the slot, e.g. `home-collage-3`. The `page` field says where it shows.
2. Change its `src` to the new photo. A full path on this PC works (pasting from Explorer's "Copy as path" is fine, drop the quotes), or a path inside the repo like `photos/v2/bar-gig.jpg`.
3. Optional in the same slot: `caption` (text under the photo where the layout has one), `alt`, `focus` (which part stays in frame when cropped, e.g. `"50% 30%"`), `crop` (`[left, top, right, bottom]` as fractions, e.g. `[0.1, 0, 0.9, 1]`).
4. Run `python scripts/build-work-pages.py` from the repo root. It re-encodes only the changed photo into `/img/` (AVIF, WebP, JPEG at 640/1280/1920) and rewrites every page that uses the slot.
5. Commit and push: `git add -A`, then `git commit -m "Swap home-collage-3"`, then `git push`. Vercel deploys it.

Each slot swaps on its own. The same file can sit in several slots (Might As Well is on home, resume and Rubber Band); change only the slots you want.

Slots marked `"kind": "video-poster"` are the frames shown before a video plays. Swap those together with the video, or the poster and the first frame won't match.

Not covered: the older hand-written pages (athletic, lens, now, builder, cover, and the /rubber-band band page) still point at `photos/` directly.
