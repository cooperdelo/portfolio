import React, { useMemo, useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Image, Text, useTexture } from '@react-three/drei';
import { easing } from 'maath';
import * as THREE from 'three';
import { useStore } from './store.js';
import { P, thumb } from './data.js';
import { POSTERS } from './posters.js';

const BASE = import.meta.env.BASE_URL;

// =============================================================================
// PBR materials — photoscanned Poly Haven maps (CC0, 1k JPG in public/tex).
// This is what takes surfaces from "flat game texture" to "real room":
// diffuse + normal + roughness on every large surface.
// Available sets: 'brick', 'floor' (wood deck), 'wood' (oak veneer),
// 'plaster', 'fabric' (normal+rough only — tint via material color).
// =============================================================================
const HAS_DIFF = { brick: true, floor: true, wood: true, plaster: true, fabric: false };
export function usePBR(name, repeat = [1, 1]) {
  const urls = { normalMap: `${BASE}tex/${name}_nor.jpg`, roughnessMap: `${BASE}tex/${name}_rough.jpg` };
  if (HAS_DIFF[name]) urls.map = `${BASE}tex/${name}_diff.jpg`;
  const tex = useTexture(urls);
  return useMemo(() => {
    const out = {};
    for (const [k, t] of Object.entries(tex)) {
      const c = t.clone(); c.needsUpdate = true;
      c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(repeat[0], repeat[1]); c.anisotropy = 8;
      if (k === 'map') c.colorSpace = THREE.SRGBColorSpace;
      out[k] = c;
    }
    return out;
  }, [tex, repeat[0], repeat[1]]);
}
['brick', 'floor', 'wood', 'plaster', 'fabric'].forEach((n) => {
  if (HAS_DIFF[n]) useTexture.preload(`${BASE}tex/${n}_diff.jpg`);
  useTexture.preload(`${BASE}tex/${n}_nor.jpg`); useTexture.preload(`${BASE}tex/${n}_rough.jpg`);
});

// =============================================================================
// RoomShell — the shared "real studio room" every section room sits inside:
// wood floor, brick walls, ceiling, baseboards, warm LED strips. Rooms add
// their own accent lighting + content; nothing here should ever read as void.
// =============================================================================
export function RoomShell({ halfW = 11, backZ = -13, height = 12, frontZ = 11, accent = '#FF4D2E' }) {
  const depth = frontZ - backZ;
  const midZ = (backZ + frontZ) / 2;
  const floor = usePBR('floor', [9, 9]);
  const brickBack = usePBR('brick', [Math.max(4, Math.round(halfW * 0.62)), Math.max(3, Math.round(height * 0.4))]);
  const brickSide = usePBR('brick', [Math.max(4, Math.round(depth * 0.31)), Math.max(3, Math.round(height * 0.4))]);
  const wood = usePBR('wood', [6, 0.4]);
  const strip = (w, pos, rot = [0, 0, 0]) => (
    <group position={pos} rotation={rot}>
      <mesh><boxGeometry args={[w, 0.045, 0.045]} /><meshStandardMaterial color="#3a2a1a" emissive="#ff9b45" emissiveIntensity={1.8} /></mesh>
    </group>
  );
  return (
    <group>
      {/* wood floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]}>
        <planeGeometry args={[halfW * 2 + 30, depth + 30]} />
        <meshStandardMaterial {...floor} color="#6f6357" roughness={0.92} envMapIntensity={0.3} />
      </mesh>
      {/* back + side brick walls */}
      <mesh receiveShadow position={[0, height / 2 - 1, backZ]}>
        <boxGeometry args={[halfW * 2 + 2, height + 2, 0.4]} />
        <meshStandardMaterial {...brickBack} color="#a08574" roughness={0.95} envMapIntensity={0.3} />
      </mesh>
      <mesh receiveShadow position={[-halfW, height / 2 - 1, midZ]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[depth + 2, height + 2, 0.4]} />
        <meshStandardMaterial {...brickSide} color="#967d6c" roughness={0.95} envMapIntensity={0.28} />
      </mesh>
      <mesh receiveShadow position={[halfW, height / 2 - 1, midZ]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[depth + 2, height + 2, 0.4]} />
        <meshStandardMaterial {...brickSide} color="#967d6c" roughness={0.95} envMapIntensity={0.28} />
      </mesh>
      {/* ceiling */}
      <mesh position={[0, height - 1, midZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[halfW * 2 + 4, depth + 6]} /><meshStandardMaterial color="#14100c" roughness={1} />
      </mesh>
      {/* wood baseboards */}
      <mesh position={[0, 0.14, backZ + 0.28]}><boxGeometry args={[halfW * 2, 0.28, 0.08]} /><meshStandardMaterial {...wood} color="#5a4128" roughness={0.7} /></mesh>
      <mesh position={[-halfW + 0.28, 0.14, midZ]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[depth, 0.28, 0.08]} /><meshStandardMaterial {...wood} color="#5a4128" roughness={0.7} /></mesh>
      <mesh position={[halfW - 0.28, 0.14, midZ]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[depth, 0.28, 0.08]} /><meshStandardMaterial {...wood} color="#5a4128" roughness={0.7} /></mesh>
      {/* warm LED strips: cove line along the top of each wall + accent under back wall */}
      {strip(halfW * 2 - 1, [0, height - 1.6, backZ + 0.32])}
      {strip(depth - 1, [-halfW + 0.32, height - 1.6, midZ], [0, Math.PI / 2, 0])}
      {strip(depth - 1, [halfW - 0.32, height - 1.6, midZ], [0, Math.PI / 2, 0])}
      {strip(halfW * 2 - 2, [0, 0.34, backZ + 0.34])}
      {/* soft cove bounce so the strips read as real light */}
      <pointLight position={[0, height - 2, backZ + 2]} intensity={1.1} distance={halfW * 1.6} color="#ffb877" />
      <pointLight position={[0, 2.5, frontZ - 3]} intensity={0.9} distance={halfW * 1.8} color="#ffd9b0" />
    </group>
  );
}
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
// The view plane sits IN FRONT of the wall face (the group mounts slightly
// proud of the wall) — frame is four slats, never an opaque filler box.
export function CityWindow({ position, rotation = [0, 0, 0], w = 5.4, h = 3.8, view = 'thailand_trip_bangkok_skyline.jpg' }) {
  const slat = (sw, sh, x, y) => (
    <mesh position={[x, y, 0.05]} castShadow key={`${x},${y}`}>
      <boxGeometry args={[sw, sh, 0.16]} /><meshStandardMaterial color="#141110" roughness={0.6} />
    </mesh>
  );
  return (
    <group position={position} rotation={rotation}>
      {/* the night city, tinted cool, glowing through the glass */}
      <Image url={thumb(view)} scale={[w, h]} position={[0, 0, -0.06]} toneMapped={false} />
      <mesh position={[0, 0, -0.02]}><planeGeometry args={[w, h]} /><meshBasicMaterial color="#0a1430" transparent opacity={0.38} /></mesh>
      {/* frame slats + mullions */}
      {slat(w + 0.44, 0.22, 0, h / 2 + 0.11)}
      {slat(w + 0.44, 0.22, 0, -h / 2 - 0.11)}
      {slat(0.22, h + 0.44, -w / 2 - 0.11, 0)}
      {slat(0.22, h + 0.44, w / 2 + 0.11, 0)}
      <mesh position={[-w / 6, 0, 0.03]}><boxGeometry args={[0.07, h, 0.08]} /><meshStandardMaterial color="#161310" /></mesh>
      <mesh position={[w / 6, 0, 0.03]}><boxGeometry args={[0.07, h, 0.08]} /><meshStandardMaterial color="#161310" /></mesh>
      <mesh position={[0, 0, 0.03]}><boxGeometry args={[w, 0.07, 0.08]} /><meshStandardMaterial color="#161310" /></mesh>
      {/* sill */}
      <mesh position={[0, -h / 2 - 0.28, 0.16]} castShadow><boxGeometry args={[w + 0.6, 0.12, 0.34]} /><meshStandardMaterial color="#1a1512" roughness={0.6} /></mesh>
      {/* cool moonlight spilling in */}
      <pointLight position={[0, 0, 1.6]} intensity={1.4} distance={11} color="#9ab4ff" />
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
