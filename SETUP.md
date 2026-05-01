# Push to GitHub + Vercel

The static site files are in this folder. To finish the setup and deploy:

## 1. Clean and init git (PowerShell)

Open PowerShell in `F:\Github\Portfolio` and run:

```powershell
# Wipe the half-created .git folder my sandbox left behind
Remove-Item -Recurse -Force .git -ErrorAction SilentlyContinue

# Init fresh
git init -b main
git add .
git commit -m "Initial commit: cooperdelo.com static portfolio"
```

## 2. Create the GitHub repo and push

If you do not have one yet, create it on GitHub. You can use the `gh` CLI:

```powershell
gh repo create cooperdelo/portfolio --public --source=. --remote=origin --push
```

Or manually: create the repo on github.com, then:

```powershell
git remote add origin https://github.com/cooperdelo/portfolio.git
git push -u origin main
```

## 3. Hook up Vercel

Two ways:

**Through the Vercel dashboard (recommended):**
1. Go to https://vercel.com/new
2. Import the `cooperdelo/portfolio` GitHub repo
3. Vercel auto-detects it as a static project, no build command needed
4. Click Deploy
5. Add `cooperdelo.com` and `www.cooperdelo.com` under Settings, Domains
6. Set DNS at your registrar:
   - A record `@` to `76.76.21.21`
   - CNAME `www` to `cname.vercel-dns.com`

**Through the Vercel CLI:**

```powershell
npm i -g vercel
vercel        # first run links the project
vercel --prod # ships to production
```

## 4. Verify

After deploy:
- https://cooperdelo.com loads the home page
- https://cooperdelo.com/plugverse, /rubber-band, /builder, /now route correctly (clean URLs are configured in `vercel.json`)
- Photos and videos load from the `/photos` and `/videos` paths
- Page transitions work (the rust slab) when navigating between pages

If anything fails, the most likely culprit is the .mov file format on iOS or older browsers. The `whole band rubber vid.MOV` is QuickTime container, browsers play it if the codec is H.264. If it shows black, run:

```powershell
ffmpeg -i "videos\whole band rubber vid.MOV" -c:v libx264 -c:a aac "videos\rubber-band-full.mp4"
```

Then in `rubber-band.html` change the `<source src="videos/whole%20band%20rubber%20vid.MOV"...>` to `<source src="videos/rubber-band-full.mp4" type="video/mp4">`.
