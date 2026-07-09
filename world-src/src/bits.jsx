import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image, Text, Html, useVideoTexture, RoundedBox } from '@react-three/drei';
import { easing } from 'maath';
import * as THREE from 'three';
import { useStore } from './store.js';
import { P, V, thumb } from './data.js';

const MONO = 'https://fonts.gstatic.com/s/geistmono/v1/or3yQ6H-1_WfwkMZI_qYFrkdwUS9.woff'; // fallback handled by drei
const prettyCaption = (name) => name.replace('replay/', '').replace(/\.(jpg|jpeg|png|JPG)$/i, '').replace(/_/g, ' ');

// A framed photo on a wall. Hover lifts + accent rim; click opens the lightbox.
export function Frame({ src, position, rotation = [0, 0, 0], width = 1.6, accent = '#F4EFE6', caption, onClick }) {
  const g = useRef();
  const rim = useRef();
  const [hover, setHover] = useState(false);
  const openLightbox = useStore((s) => s.openLightbox);
  const h = width * 0.7;
  useFrame((_, dt) => {
    const s = hover ? 1.06 : 1;
    easing.damp3(g.current.scale, [s, s, s], 0.15, dt);
    easing.damp(rim.current.material, 'opacity', hover ? 0.5 : 0, 0.15, dt);
  });
  return (
    <group
      ref={g}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => { e.stopPropagation(); onClick ? onClick() : openLightbox(P + src, caption || prettyCaption(src)); }}
    >
      <mesh ref={rim} position={[0, 0, -0.03]}>
        <planeGeometry args={[width + 0.5, h + 0.5]} />
        <meshBasicMaterial color={accent} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={[width + 0.1, h + 0.1, 0.05]} />
        <meshStandardMaterial color="#0e0b09" roughness={0.5} metalness={0.2} />
      </mesh>
      <Image url={thumb(src)} transparent position={[0, 0, 0.031]} scale={[width, h]} toneMapped={false} />
    </group>
  );
}

// A framed photo that reveals an info card on hover (gear specs, concert notes).
// Click still opens the lightbox of the photo.
export function InfoTile({ src, position, rotation = [0, 0, 0], width = 1.4, accent = '#F4EFE6', card, cardSide = 1, caption }) {
  const g = useRef();
  const rim = useRef();
  const [hover, setHover] = useState(false);
  const openLightbox = useStore((s) => s.openLightbox);
  const h = width * 0.72;
  useFrame((_, dt) => {
    const s = hover ? 1.08 : 1;
    easing.damp3(g.current.scale, [s, s, s], 0.15, dt);
    easing.damp(rim.current.material, 'opacity', hover ? 0.55 : 0, 0.15, dt);
  });
  return (
    <group ref={g} position={position} rotation={rotation}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.classList.add('hot'); }}
      onPointerOut={() => { setHover(false); document.body.classList.remove('hot'); }}
      onClick={(e) => { e.stopPropagation(); openLightbox(P + src, caption || prettyCaption(src)); }}>
      <mesh ref={rim} position={[0, 0, -0.03]}><planeGeometry args={[width + 0.4, h + 0.4]} /><meshBasicMaterial color={accent} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      <mesh castShadow><boxGeometry args={[width + 0.09, h + 0.09, 0.05]} /><meshStandardMaterial color="#0e0b09" roughness={0.5} metalness={0.2} /></mesh>
      <Image url={thumb(src)} transparent position={[0, 0, 0.031]} scale={[width, h]} toneMapped={false} />
      {hover && card && (
        <Html position={[cardSide * (width / 2 + 0.15), 0.05, 0.12]} transform occlude distanceFactor={2.4} style={{ pointerEvents: 'none' }}>
          <div style={{
            width: 200, padding: '12px 14px', borderRadius: 11,
            background: 'linear-gradient(180deg, rgba(14,10,8,.92), rgba(14,10,8,.97))',
            backdropFilter: 'blur(16px)', border: '1px solid rgba(244,239,230,.16)', color: '#F4EFE6',
            fontFamily: 'Geist, sans-serif', borderTop: `2px solid ${accent}`, boxShadow: '0 22px 55px -28px #000',
            transform: cardSide < 0 ? 'translateX(-100%)' : 'none'
          }}>{card}</div>
        </Html>
      )}
    </group>
  );
}

// A looping video plane (reels / product UI). Muted, autoplay.
// A "clip" panel: renders the poster image via the same drei <Image> that Frame
// uses (the earlier custom-material path crashed the WebGL context). A triangle
// marks it as a clip; clicking opens the full image in the lightbox.
export function VideoScreen({ src, poster, position, rotation = [0, 0, 0], width = 2.4, aspect = 16 / 9, frame = true, accent = '#F4EFE6', label }) {
  const open = useStore((s) => s.openLightbox);
  const [hover, setHover] = useState(false);
  const g = useRef();
  const h = width / aspect;
  const isImg = (n) => n && /\.(jpe?g|png|JPG)$/i.test(n);
  const img = poster && isImg(poster) ? poster : (isImg(src) ? src : null);
  useFrame((_, dt) => { if (g.current) { const s = hover ? 1.03 : 1; easing.damp3(g.current.scale, [s, s, s], 0.16, dt); } });
  return (
    <group ref={g} position={position} rotation={rotation}
      onPointerOver={(e) => { if (img) { e.stopPropagation(); setHover(true); document.body.classList.add('hot'); } }}
      onPointerOut={() => { setHover(false); document.body.classList.remove('hot'); }}
      onClick={(e) => { if (img) { e.stopPropagation(); open(P + img, (label || img).replace(/\.(jpg|jpeg|png|JPG)$/i, '').replace(/[_-]/g, ' ')); } }}>
      {frame && (
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[width + 0.14, h + 0.14, 0.06]} />
          <meshStandardMaterial color="#0a0a0c" roughness={0.4} metalness={0.5} />
        </mesh>
      )}
      {img
        ? <Image url={thumb(img)} position={[0, 0, 0.02]} scale={[width, h]} toneMapped={false} />
        : <mesh position={[0, 0, 0.02]}><planeGeometry args={[width, h]} /><meshBasicMaterial color="#0e0b09" toneMapped={false} /></mesh>}
      <mesh position={[0, 0, 0.04]} rotation={[0, 0, -Math.PI / 2]}>
        <circleGeometry args={[Math.min(width, h) * 0.11, 3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>
      <pointLight position={[0, 0, 0.6]} intensity={0.3} distance={3} color={accent} />
    </group>
  );
}

// A glassmorphic HTML panel anchored in 3D (specs, blurbs, stats). Occludable.
export function Panel({ position, rotation = [0, 0, 0], width = 260, children, distanceFactor = 2.4, accent = '#F4EFE6' }) {
  return (
    <Html position={position} rotation={rotation} transform occlude distanceFactor={distanceFactor} style={{ pointerEvents: 'none' }}>
      <div style={{
        width, padding: '16px 18px', borderRadius: 14,
        background: 'linear-gradient(180deg, rgba(14,10,8,.82), rgba(14,10,8,.92))',
        backdropFilter: 'blur(20px) saturate(150%)', border: '1px solid rgba(244,239,230,.16)',
        color: '#F4EFE6', fontFamily: 'Geist, sans-serif', boxShadow: '0 30px 70px -30px #000',
        borderTop: `2px solid ${accent}`
      }}>{children}</div>
    </Html>
  );
}

// Spec card used for gear (rig, kit, bag): name + badge + 3-4 spec rows.
export function SpecCard({ position, rotation, accent, badge, name, specs, width = 220 }) {
  return (
    <Panel position={position} rotation={rotation} width={width} accent={accent}>
      <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: accent, opacity: 0.9 }}>{badge}</div>
      <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 18, textTransform: 'uppercase', margin: '4px 0 8px' }}>{name}</div>
      {specs.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Geist Mono, monospace', fontSize: 9.5, textTransform: 'uppercase', opacity: 0.7, padding: '2px 0', borderTop: i ? '1px solid rgba(244,239,230,.08)' : 'none' }}>
          <span>{k}</span><span style={{ opacity: 0.85 }}>{v}</span>
        </div>
      ))}
    </Panel>
  );
}

// Crisp 3D text label (troika via drei Text).
export function Label({ children, position, rotation, size = 0.16, color = '#F4EFE6', anchorX = 'center', font, max = 6, mono = false, opacity = 1 }) {
  return (
    <Text position={position} rotation={rotation} fontSize={size} color={color} anchorX={anchorX} anchorY="middle"
      maxWidth={max} lineHeight={1.15} letterSpacing={mono ? 0.06 : 0} outlineWidth={0.003} outlineColor="#000" fillOpacity={opacity}>
      {children}
    </Text>
  );
}

// A live third-party embed (Spotify / Apple Music) on an in-world screen. The
// styled wrapper IS the panel (no mismatched 3D box behind it). df scales size.
export function Embed({ position, rotation = [0, 0, 0], url, kind = 'spotify', label, accent = '#F4EFE6', w = 340, h = 460, df = 2.3 }) {
  return (
    <group position={position} rotation={rotation}>
      <Html transform occlude distanceFactor={df} style={{ pointerEvents: 'auto' }}>
        <div style={{ width: w + 20, background: 'linear-gradient(180deg,#100b08,#0b0806)', border: `1px solid ${accent}66`, borderRadius: 18, padding: '12px 10px 10px', boxShadow: `0 40px 90px -20px #000, 0 0 60px -20px ${accent}` }}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, letterSpacing: '.24em', textTransform: 'uppercase', color: accent, textAlign: 'center', marginBottom: 8 }}>{label}</div>
          <iframe title={label} src={url} width={w} height={h} style={{ border: 0, borderRadius: 12, background: '#111', display: 'block' }}
            allow="autoplay *; encrypted-media *; clipboard-write" loading="lazy" />
        </div>
      </Html>
    </group>
  );
}

// In-world contact station: email + copy + social buttons, no pop-out modal.
export function ContactStation({ position, rotation = [0, 0, 0], accent = '#F4EFE6' }) {
  return (
    <Html position={position} rotation={rotation} transform occlude distanceFactor={2.2}>
      <div style={{
        width: 280, padding: '18px 20px', borderRadius: 16,
        background: 'linear-gradient(180deg, rgba(14,10,8,.86), rgba(14,10,8,.94))',
        backdropFilter: 'blur(22px)', border: '1px solid rgba(244,239,230,.16)', color: '#F4EFE6',
        fontFamily: 'Geist, sans-serif', borderTop: `2px solid ${accent}`, boxShadow: '0 30px 70px -30px #000'
      }}>
        <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 22, textTransform: 'uppercase' }}>Get in touch.</div>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, margin: '10px 0', userSelect: 'all' }}>cooperdelo6@gmail.com</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['Gmail', 'https://mail.google.com/mail/?view=cm&fs=1&to=cooperdelo6@gmail.com'], ['LinkedIn', 'https://www.linkedin.com/in/cooperdelo/'], ['Instagram', 'https://instagram.com/cooperdelo']].map(([t, u]) => (
            <a key={t} href={u} target="_blank" rel="noreferrer" style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: accent, textDecoration: 'none', border: `1px solid ${accent}55`, borderRadius: 999, padding: '.4rem .7rem' }}>{t}</a>
          ))}
        </div>
      </div>
    </Html>
  );
}
