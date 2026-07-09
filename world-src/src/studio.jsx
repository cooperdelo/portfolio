import React, { useMemo, useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Image, Text } from '@react-three/drei';
import { easing } from 'maath';
import * as THREE from 'three';
import { useStore } from './store.js';
import { P, thumb } from './data.js';
import { POSTERS } from './posters.js';

const BASE = import.meta.env.BASE_URL;
const posterSrc = (p) => (p.own ? P + p.img.replace('__own:', '') : BASE + 'posters/' + p.img);

// ---- procedural textures (self-contained, no external files) ----
function brickTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#2a1a14'; x.fillRect(0, 0, 512, 512);
  const bw = 96, bh = 40, mortar = 6;
  for (let row = 0; row * bh < 512; row++) {
    const off = (row % 2) * (bw / 2);
    for (let col = -1; col * bw < 512 + bw; col++) {
      const bx = col * bw + off, by = row * bh;
      const v = 20 + Math.random() * 30;
      x.fillStyle = `rgb(${v + 40},${v + 18},${v + 10})`;
      x.fillRect(bx + mortar / 2, by + mortar / 2, bw - mortar, bh - mortar);
      // speckle
      for (let s = 0; s < 30; s++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`; x.fillRect(bx + Math.random() * bw, by + Math.random() * bh, 1, 1); }
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function woodTexture(base = '#4a3018') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 220; i++) { x.strokeStyle = `rgba(30,18,8,${Math.random() * 0.3 + 0.05})`; x.lineWidth = Math.random() * 2.4 + 0.3; x.beginPath(); const gx = Math.random() * 512; x.moveTo(gx, 0); for (let yy = 0; yy <= 512; yy += 14) x.lineTo(gx + Math.sin(yy * 0.03 + i) * 7, yy); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function useStudioTextures() {
  return useMemo(() => ({ brick: brickTexture(), wood: woodTexture(), woodLight: woodTexture('#5c3f22') }), []);
}

// ---- a framed poster that lifts on hover and opens the lightbox ----
function FramedPoster({ src, position, rotation, w, h, accent = '#FF4D2E', onOpen, hoverLabel }) {
  const g = useRef(); const rim = useRef();
  const [hover, setHover] = useState(false);
  useFrame((_, dt) => {
    const s = hover ? 1.05 : 1;
    if (g.current) easing.damp3(g.current.scale, [s, s, s], 0.16, dt);
    if (rim.current) easing.damp(rim.current.material, 'opacity', hover ? 0.55 : 0, 0.16, dt);
  });
  return (
    <group ref={g} position={position} rotation={rotation}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.classList.add('hot'); }}
      onPointerOut={() => { setHover(false); document.body.classList.remove('hot'); }}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}>
      <mesh ref={rim} position={[0, 0, -0.03]}><planeGeometry args={[w + 0.4, h + 0.4]} /><meshBasicMaterial color={accent} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      <mesh castShadow><boxGeometry args={[w + 0.12, h + 0.12, 0.06]} /><meshStandardMaterial color="#0c0a08" roughness={0.55} metalness={0.15} /></mesh>
      <Image url={src} transparent position={[0, 0, 0.04]} scale={[w, h]} toneMapped={false} />
    </group>
  );
}

// Curated deep notes for a few hero albums; others get a clean template blurb.
const NOTES = {
  'The Dark Side of the Moon': 'The record every studio measures itself against. 42 minutes with no gaps — the reason this room exists.',
  'OK Computer': 'The album that rewired what a rock record could sound like. Study it for arrangement, not just songs.',
  Currents: 'One man, a bedroom, and a wall of synths. Proof you can build a whole world solo.',
  Punisher: 'Quiet songs that fill loud rooms. The blueprint for the Cooper Delo ballads.',
  'Flicker of Time': 'My own EP. Written, played, and mixed in Ableton — the loop that runs everything here.'
};

export function AlbumPoster({ poster, position, rotation, w = 1.35 }) {
  const open = useStore((s) => s.openLightbox);
  const src = posterSrc(poster);
  const meta = poster.meta || [['Artist', poster.artist], ['Released', poster.year]];
  const blurb = poster.blurb || NOTES[poster.album] || `${poster.album} — ${poster.artist} (${poster.year}).`;
  return (
    <FramedPoster src={src} position={position} rotation={rotation} w={w} h={w} accent="#FF4D2E"
      onOpen={() => open({ src, eyebrow: poster.own ? 'MY RELEASE' : 'ON THE WALL · ALBUM', title: poster.album, meta, blurb, accent: '#FF4D2E' })} />
  );
}

// Cooper's own photo as a framed poster (opens photo lightbox with a caption).
export function PhotoPoster({ src, position, rotation, w = 1.6, ratio = 0.7, title, blurb, accent = '#FF4D2E' }) {
  const open = useStore((s) => s.openLightbox);
  const url = P + src;
  return (
    <FramedPoster src={thumb(src)} position={position} rotation={rotation} w={w} h={w * ratio} accent={accent}
      onOpen={() => open({ src: url, eyebrow: 'FROM THE ARCHIVE', title: title || src, blurb, accent })} />
  );
}

// ---- a big window looking onto a night city (sells the 'real room' feel) ----
export function CityWindow({ position, rotation = [0, 0, 0], w = 6, h = 5, view = 'thailand_trip_bangkok_skyline.jpg' }) {
  return (
    <group position={position} rotation={rotation}>
      {/* the view, behind the glass, tinted to night + glowing */}
      <Image url={thumb(view)} scale={[w, h]} position={[0, 0, -0.3]} toneMapped={false} />
      <mesh position={[0, 0, -0.28]}><planeGeometry args={[w, h]} /><meshBasicMaterial color="#0a1430" transparent opacity={0.45} /></mesh>
      {/* frame + mullions */}
      <mesh position={[0, 0, 0]}><boxGeometry args={[w + 0.4, h + 0.4, 0.2]} /><meshStandardMaterial color="#12100e" roughness={0.7} /></mesh>
      <mesh position={[0, 0, 0.02]}><boxGeometry args={[w, h, 0.24]} /><meshStandardMaterial color="#0b0806" /></mesh>
      {[-w / 4, w / 4].map((mx) => (<mesh key={mx} position={[mx, 0, 0.06]}><boxGeometry args={[0.08, h, 0.06]} /><meshStandardMaterial color="#161310" /></mesh>))}
      <mesh position={[0, 0, 0.06]}><boxGeometry args={[w, 0.08, 0.06]} /><meshStandardMaterial color="#161310" /></mesh>
      {/* cool moonlight spilling in */}
      <pointLight position={[0, 0, 2]} intensity={1.2} distance={12} color="#9ab4ff" />
    </group>
  );
}

// ---- an LED-lit shelf niche holding small objects ----
export function ShelfUnit({ position, rotation = [0, 0, 0], wood }) {
  return (
    <group position={position} rotation={rotation}>
      {[0, 1.7, 3.4].map((sy) => (
        <group key={sy}>
          <mesh position={[0, sy, 0]} castShadow receiveShadow><boxGeometry args={[3, 0.12, 0.7]} /><meshStandardMaterial map={wood} color="#6a4d30" roughness={0.7} /></mesh>
          <mesh position={[0, sy + 0.06, 0.33]}><boxGeometry args={[2.8, 0.02, 0.02]} /><meshStandardMaterial color="#ffcaa0" emissive="#ff9b45" emissiveIntensity={1.6} /></mesh>
          <pointLight position={[0, sy + 0.5, 0.4]} intensity={0.3} distance={3.5} color="#ffb066" />
        </group>
      ))}
    </group>
  );
}

// A small award plaque object for shelves.
export function Plaque({ position, rotation = [0, 0, 0], label, sub, accent = '#FF4D2E' }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow><boxGeometry args={[0.9, 0.62, 0.05]} /><meshStandardMaterial color="#141010" roughness={0.4} metalness={0.3} /></mesh>
      <Text position={[0, 0.12, 0.03]} fontSize={0.2} color={accent} anchorX="center" outlineWidth={0.004} outlineColor="#000">{label}</Text>
      <Text position={[0, -0.13, 0.03]} fontSize={0.075} color="#F4EFE6" anchorX="center" maxWidth={0.8} textAlign="center">{sub}</Text>
    </group>
  );
}

// convenience: split posters into wall rows
export function usePosterRows() {
  return useMemo(() => POSTERS, []);
}
