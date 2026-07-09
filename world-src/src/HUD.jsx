import React, { useEffect, useRef, useState } from 'react';
import { useStore } from './store.js';
import { SECTIONS, sectionByKey } from './data.js';

// All the screen-space UI that lives over the canvas.
export default function HUD() {
  const { room, phase, section, lightbox, closeLightbox, returnToHub, soundOn, toggleSound, ready } = useStore();
  const active = phase === 'inroom' && section ? section : null;

  return (
    <>
      <Cursor />
      <Loader ready={ready} />

      {/* top chrome */}
      <div className="top">
        <div>
          <div className="brand">COOPER<span className="d">.</span>DELO</div>
          <div className="np" style={{ color: active ? active.accent : undefined }}>
            {active ? `▶ ${active.key.toLowerCase()}` : 'the studio'}
          </div>
        </div>
      </div>

      {/* back to studio */}
      {phase === 'inroom' && (
        <button className="back" data-c onClick={returnToHub}>← back to the studio</button>
      )}

      {/* POV wall navigation — in rooms AND in the hub */}
      {phase === 'inroom' && active && <PovNav sectionKey={active.key} accent={active.accent} />}
      {phase === 'idle' && <PovNav sectionKey="HUB" accent="#FF4D2E" />}

      {/* tools */}
      <div className="tools">
        <button className={'tbtn' + (soundOn ? ' on' : '')} data-c onClick={toggleSound}>Sound {soundOn ? '●' : '○'}</button>
        <button className="tbtn" data-c onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>Fullscreen</button>
      </div>

      {/* record crate — jump between rooms anytime */}
      <Crate />

      {/* hint */}
      {phase === 'idle' && <div className="hint">drag to look · scroll to move · hover a record · click to drop the needle</div>}
      {phase === 'inroom' && <div className="hint">drag to look around · click a photo to enlarge · walk up to any artifact</div>}

      {/* needle-drop transition overlay */}
      <Transition />

      {/* lightbox — artifact on the left, info panel on the right */}
      <Lightbox lightbox={lightbox} close={closeLightbox} />
    </>
  );
}

const prettyName = (s) => (s || '').replace(/^.*\//, '').replace('replay/', '').replace(/\.(jpg|jpeg|png|JPG)$/i, '').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function Lightbox({ lightbox, close }) {
  const artRef = useRef();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [close]);
  // 3D preview: the artifact tilts in perspective, tracking the cursor
  const onArtMove = (e) => {
    const img = artRef.current; if (!img) return;
    const r = img.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
    img.style.transform = `rotateY(${11 + dx * 16}deg) rotateX(${2 - dy * 12}deg) scale(1.02)`;
  };
  const onArtLeave = () => { if (artRef.current) artRef.current.style.transform = ''; };
  const lb = lightbox || {};
  const title = lb.title || prettyName(lb.caption || lb.src);
  const accent = lb.accent || '#FF4D2E';
  const meta = lb.meta || [];
  return (
    <div className={'lightbox' + (lightbox ? ' show' : '')} onClick={(e) => e.target.classList.contains('lightbox') && close()}>
      <div className="lb-art" onMouseMove={onArtMove} onMouseLeave={onArtLeave}>{lightbox && <img ref={artRef} src={lb.src} alt="" />}</div>
      <div className="lb-info">
        <button className="lx" data-c onClick={close}>Close [ESC]</button>
        {lightbox && (
          <>
            {lb.eyebrow && <div className="lb-eyebrow" style={{ color: accent }}>{lb.eyebrow}</div>}
            <h2 className="lb-title">{title}</h2>
            {meta.length > 0 && (
              <div className="lb-meta">
                {meta.map(([k, v], i) => (
                  <div key={i} className="lb-row"><span>{k}</span><span>{v}</span></div>
                ))}
              </div>
            )}
            {lb.blurb && <p className="lb-blurb">{lb.blurb}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// Per-room wall labels for the [left · front · right] POV switch.
const WALLS = {
  HUB: ['Window Wall', 'The Records', 'Shelf Wall'],
  MUSIC: ['The Rig', 'Stage', 'Shows'],
  PLUGVERSE: ['The Story', 'Center', 'The Wins'],
  ATHLETIC: ['Iron', 'Center', 'Golf'],
  LENS: ['Left', 'The Wall', 'Right'],
  NOW: ['Left', 'The Desk', 'The Board']
};
function PovNav({ sectionKey, accent }) {
  const roomView = useStore((s) => s.roomView);
  const setRoomView = useStore((s) => s.setRoomView);
  const [L, C, R] = WALLS[sectionKey] || ['Left', 'Center', 'Right'];
  const btn = (view, label, arrowL, arrowR) => (
    <button className={'pov-btn' + (roomView === view ? ' on' : '')} style={{ '--a': accent }} data-c onClick={() => setRoomView(view)}>
      {arrowL && <span className="pov-arw">◀</span>}{label}{arrowR && <span className="pov-arw">▶</span>}
    </button>
  );
  return (
    <div className="povnav">
      {btn('left', L, true, false)}
      {btn('front', C, false, false)}
      {btn('right', R, false, true)}
    </div>
  );
}

function Crate() {
  const { room, phase, dive, returnToHub } = useStore();
  if (phase === 'dropping' || phase === 'returning') return null;
  return (
    <div className="crate">
      {SECTIONS.map((s) => (
        <button
          key={s.key}
          className={'crate-rec' + (room === s.key ? ' on' : '')}
          style={{ '--a': s.accent }}
          data-c
          onClick={() => {
            if (room === s.key) return;
            if (phase === 'inroom') { returnToHub(); setTimeout(() => dive(s), 700); }
            else dive(s);
          }}
        >
          <span className="dot" style={{ background: s.accent }} />{s.key}
        </button>
      ))}
    </div>
  );
}

function Transition() {
  const phase = useStore((s) => s.phase);
  const shown = useStore((s) => s.shown);
  const section = useStore((s) => s.section);
  const active = phase === 'dropping' || phase === 'returning';
  // The overlay is opaque ONLY during the actual scene swap ('void'), so the
  // 3D record flying to the turntable + camera dive stay fully visible.
  const covering = active && shown === 'void';
  const accent = section ? section.accent : '#FF4D2E';
  return (
    <div className={'drop' + (covering ? ' cover' : '') + (active ? ' active' : '')} style={{ '--a': accent }}>
      {covering && section && <div className="drop-label" style={{ color: accent }}>{phase === 'returning' ? 'back to the studio' : `▶ ${section.key.toLowerCase()}`}</div>}
    </div>
  );
}

function Cursor() {
  const ref = useRef();
  const label = useRef();
  const hovered = useStore((s) => s.hovered);
  useEffect(() => {
    const move = (e) => {
      if (ref.current) ref.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };
    const over = (e) => {
      const el = e.target.closest('[data-c]');
      document.body.classList.toggle('hot', !!el);
      if (label.current) label.current.textContent = el ? (el.getAttribute('data-c') || '') : '';
    };
    addEventListener('pointermove', move);
    addEventListener('pointerover', over);
    return () => { removeEventListener('pointermove', move); removeEventListener('pointerover', over); };
  }, []);
  return (
    <div id="cursor" ref={ref}>
      <div className="ring" /><div className="dot" /><div className="clabel" ref={label} />
    </div>
  );
}

function Loader({ ready }) {
  const [gone, setGone] = useState(false);
  useEffect(() => { if (ready) { const t = setTimeout(() => setGone(true), 900); return () => clearTimeout(t); } }, [ready]);
  if (gone) return null;
  return (
    <div className={'loader' + (ready ? ' hide' : '')}>
      <div className="lname">The<br /><span className="d">studio.</span></div>
      <div className="lbar"><i /></div>
      <div className="lsub">warming up the room</div>
    </div>
  );
}
