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

      {/* lightbox */}
      <div className={'lightbox' + (lightbox ? ' show' : '')} onClick={(e) => e.target.className.includes('lightbox') && closeLightbox()}>
        <button className="lx" data-c onClick={closeLightbox}>Close [esc]</button>
        {lightbox && <img src={lightbox.src} alt="" />}
        {lightbox && <div className="lcap">{lightbox.caption}</div>}
      </div>
    </>
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
  const section = useStore((s) => s.section);
  const active = phase === 'dropping' || phase === 'returning';
  const accent = section ? section.accent : '#FF4D2E';
  return (
    <div className={'drop' + (active ? ' on' : '')} style={{ '--a': accent }}>
      <div className="drop-vinyl" style={{ borderColor: accent }}>
        <div className="drop-hole" style={{ background: accent }} />
      </div>
      {section && <div className="drop-label" style={{ color: accent }}>{phase === 'returning' ? 'back to the studio' : `▶ ${section.key.toLowerCase()}`}</div>}
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
