import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image, Text, Html, useVideoTexture, RoundedBox } from '@react-three/drei';
import { easing } from 'maath';
import * as THREE from 'three';
import { useStore } from './store.js';
import { P, V } from './data.js';

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
      <Image url={P + src} transparent position={[0, 0, 0.031]} scale={[width, h]} toneMapped={false} />
    </group>
  );
}

// A looping video plane (reels / product UI). Muted, autoplay.
export function VideoScreen({ src, position, rotation = [0, 0, 0], width = 2.4, aspect = 16 / 9, frame = true, accent = '#F4EFE6' }) {
  return (
    <group position={position} rotation={rotation}>
      {frame && (
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[width + 0.14, width / aspect + 0.14, 0.06]} />
          <meshStandardMaterial color="#0a0a0c" roughness={0.4} metalness={0.5} />
        </mesh>
      )}
      <VideoInner src={src} width={width} aspect={aspect} />
      <pointLight position={[0, 0, 0.6]} intensity={0.4} distance={3} color={accent} />
    </group>
  );
}
function VideoInner({ src, width, aspect }) {
  const tex = useVideoTexture(V + src, { muted: true, loop: true, start: true, crossOrigin: 'anonymous', playsInline: true });
  return (
    <mesh>
      <planeGeometry args={[width, width / aspect]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
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

// A live third-party embed (Spotify / Apple Music) rendered on an in-world screen.
export function Embed({ position, rotation = [0, 0, 0], url, kind = 'spotify', label, accent = '#F4EFE6', w = 320, h = 380 }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[w / 130 + 0.2, h / 130 + 0.5, 0.08]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.4} metalness={0.4} />
      </mesh>
      <Label position={[0, h / 260 + 0.13, 0.06]} size={0.11} color={accent} mono>{(label || '').toUpperCase()}</Label>
      <Html position={[0, 0, 0.02]} transform occlude distanceFactor={1.7}>
        <iframe title={label} src={url} width={w} height={h} style={{ border: 0, borderRadius: 12, background: '#111' }}
          allow="autoplay *; encrypted-media *; clipboard-write" loading="lazy" />
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
