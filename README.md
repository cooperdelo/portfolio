# cooperdelo.com

Personal portfolio for Cooper Delo. Built as a static site, deployed on Vercel.

## Stack
Plain HTML, CSS, and JavaScript. Three.js loaded from CDN for the ambient morphing scene. No build step.

## Pages
- `/` home, kinetic hero with photo background, manifesto, Plugverse, drag-able work gallery, music, builder, now teaser
- `/plugverse` founder story plus Wins section
- `/rubber-band` Rubber Band cover band plus Cooper Delo solo project, video header
- `/builder` builder log with persistent photo backdrop
- `/now` live now-page (agent updates)

## Local preview
Just open `index.html` in any modern browser. No build.

For a real local server (better for video and clipboard APIs):
```
npx serve .
```

## Deploy
Vercel auto-detects this as a static project. Push to GitHub, import in Vercel, point cooperdelo.com at it.

`vercel.json` enables clean URLs (so `/plugverse` instead of `/plugverse.html`) and long cache for photos and videos.

## File map
```
index.html              home
plugverse.html          founder story
rubber-band.html        music
builder.html            builder log
now.html                live now-page
shell.css               shared styles (palette, type, motion, glass, photo frames)
shell.js                shared JS (cursor, scene, transitions, modal, drag gallery)
photos/                 portrait, band, plugverse brand, luby check, etc.
videos/                 plugverse_ui.mp4 plus rubber band live clips
vercel.json             clean URLs and cache headers
```

## Design rules
- No em dashes anywhere in copy
- No icons
- Anton for poster type, Fraunces for italic editorial moments, Geist Sans for body, Geist Mono for metadata
- Dark cinematic palette with section-specific color worlds (rust for Plugverse, crimson and stage purple for Rubber Band, dream-pop pastels for Cooper Delo, cream insert moment for Builder when not photo-backed)
