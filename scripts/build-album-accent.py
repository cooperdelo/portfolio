"""Recover approved cover textures; build a small, static dimensional collection."""
from pathlib import Path
import subprocess, io, html
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ALBUMS = [
 ('the-smashing-pumpkins-siamese-dream', 'Siamese Dream', 'The Smashing Pumpkins'),
 ('pearl-jam-vs', 'Vs.', 'Pearl Jam'),
 ('pink-floyd-the-dark-side-of-the-moon', 'The Dark Side of the Moon', 'Pink Floyd'),
 ('masayoshi-takanaka-all-of-me', 'All of Me', 'Masayoshi Takanaka'),
 ('daft-punk-random-access-memories', 'Random Access Memories', 'Daft Punk'),
 ('tame-impala-innerspeaker', 'Innerspeaker', 'Tame Impala'),
 ('radiohead-in-rainbows', 'In Rainbows', 'Radiohead'),
 ('eagles-hotel-california', 'Hotel California', 'Eagles'),
 ('the-jimi-hendrix-experience-electric-ladyland', 'Electric Ladyland', 'The Jimi Hendrix Experience'),
 ('alice-in-chains-dirt', 'Dirt', 'Alice in Chains'),
 ('led-zeppelin-houses-of-the-holy', 'Houses of the Holy', 'Led Zeppelin'),
]

def markup():
    covers = ''.join(f'<figure class="album-sleeve"><img src="/img/albums/{slug}.webp" width="320" height="320" loading="lazy" decoding="async" alt="{html.escape(title)} — {html.escape(artist)}"><figcaption>{html.escape(title)}<small>{html.escape(artist)}</small></figcaption></figure>' for slug,title,artist in ALBUMS)
    return '<aside class="record-collection" aria-label="Favorite albums"><div class="record-heading"><p class="label">On repeat</p><p>A few records I come back to.</p></div><div class="record-shelves">'+covers+'</div></aside>'

if __name__ == '__main__':
    dest=ROOT/'img/albums'; dest.mkdir(exist_ok=True)
    for slug,_,_ in ALBUMS:
        data=subprocess.check_output(['git','show',f'stanley-redesign:world-src/public/posters/{slug}.jpg'],cwd=ROOT)
        image=Image.open(io.BytesIO(data)).convert('RGB'); image.thumbnail((320,320))
        image.save(dest/f'{slug}.webp',quality=82,method=6)
    print(f'Recovered {len(ALBUMS)} covers; {sum(p.stat().st_size for p in dest.glob("*.webp")):,} bytes')
