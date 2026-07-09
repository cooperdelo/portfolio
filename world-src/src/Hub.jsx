import React, { Suspense } from 'react';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Model } from './Model.jsx';
import Records from './Records.jsx';
import { useStore } from './store.js';
import { sectionByKey } from './data.js';
import { POSTERS } from './posters.js';
import { useStudioTextures, AlbumPoster, PhotoPoster, CityWindow, ShelfUnit, Plaque } from './studio.jsx';

// Clicking the instruments jumps straight into the Music room.
function ClickTo({ sectionKey, children }) {
  const dive = useStore((s) => s.dive);
  const phase = useStore((s) => s.phase);
  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); if (phase === 'idle') document.body.classList.add('hot'); }}
      onPointerOut={() => document.body.classList.remove('hot')}
      onClick={(e) => { e.stopPropagation(); if (phase === 'idle') dive(sectionByKey(sectionKey)); }}
    >
      {children}
    </group>
  );
}

function Monitor({ position, rotation }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow><boxGeometry args={[0.5, 0.72, 0.44]} /><meshStandardMaterial color="#17130f" roughness={0.6} envMapIntensity={0.5} /></mesh>
      <mesh position={[0, -0.11, 0.23]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.05, 32]} /><meshStandardMaterial color="#0b0b0b" roughness={0.5} metalness={0.3} /></mesh>
      <mesh position={[0, -0.11, 0.255]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.11, 0.11, 0.02, 32]} /><meshStandardMaterial color="#050505" roughness={0.9} /></mesh>
      <mesh position={[0, 0.28, 0.225]}><planeGeometry args={[0.14, 0.03]} /><meshStandardMaterial color="#ff6a3a" emissive="#ff6a3a" emissiveIntensity={1.4} /></mesh>
    </group>
  );
}

// Distribute the 40 album posters across the three walls (avoiding the record
// shelf, the window, and the shelf unit).
const OWN = POSTERS.filter((p) => p.own);
const ALBUMS = POSTERS.filter((p) => !p.own);
const backAlbums = ALBUMS.slice(0, 12);   // back wall, above the records
const leftAlbums = ALBUMS.slice(12, 25);  // left wall (around the window)
const rightAlbums = ALBUMS.slice(25, 39); // right wall (around the shelf)

export default function Hub() {
  const tex = useStudioTextures();
  return (
    <group>
      {/* ---- room shell ---- */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[44, 44]} />
        <meshStandardMaterial color="#160f0a" roughness={0.96} metalness={0.04} envMapIntensity={0.3} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1]}>
        <planeGeometry args={[13, 9]} />
        <meshStandardMaterial map={tex.wood} color="#3a2616" roughness={0.85} />
      </mesh>
      {/* back wall — brick */}
      <mesh receiveShadow position={[0, 4.5, -7]}>
        <boxGeometry args={[24, 13, 0.4]} />
        <meshStandardMaterial map={tex.brick} roughnessMap={tex.brick} color="#8a6a54" roughness={0.95} envMapIntensity={0.35} />
      </mesh>
      {/* side walls — brick */}
      <mesh receiveShadow position={[-11, 4.5, -1]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 13, 0.4]} /><meshStandardMaterial map={tex.brick} color="#7c5f4b" roughness={0.95} envMapIntensity={0.3} />
      </mesh>
      <mesh receiveShadow position={[11, 4.5, -1]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 13, 0.4]} /><meshStandardMaterial map={tex.brick} color="#7c5f4b" roughness={0.95} envMapIntensity={0.3} />
      </mesh>
      {/* ceiling */}
      <mesh position={[0, 11, -1]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[24, 20]} /><meshStandardMaterial color="#0e0a07" roughness={1} /></mesh>

      <Suspense fallback={null}>
        {/* ---- ALBUM POSTER WALLS ---- */}
        {/* back wall: 6 cols x 2 rows above the records */}
        {backAlbums.map((p, i) => {
          const c = i % 6, r = Math.floor(i / 6);
          return <AlbumPoster key={p.img} poster={p} position={[(c - 2.5) * 2.6, 6.9 - r * 1.7, -6.78]} rotation={[0, 0, 0]} w={1.3} />;
        })}
        {/* Cooper's own EP — hero poster, centered in the top-row gap */}
        {OWN[0] && <AlbumPoster poster={OWN[0]} position={[0, 5.35, -6.78]} rotation={[0, 0, 0]} w={1.45} />}

        {/* left wall: posters around the window (skip the window's zone z -3.5..0.5) */}
        {leftAlbums.map((p, i) => {
          const col = i % 5, row = Math.floor(i / 5);
          const z = -6 + col * 2.3;
          const y = 7.3 - row * 1.7;
          if (row >= 2 && z > -3.6 && z < 0.8) return null; // leave room for window lower-center
          return <AlbumPoster key={p.img} poster={p} position={[-10.7, y, z]} rotation={[0, Math.PI / 2, 0]} w={1.25} />;
        })}
        <CityWindow position={[-10.68, 3.4, -1.5]} rotation={[0, Math.PI / 2, 0]} w={6.2} h={4.6} />

        {/* right wall: posters around the shelf unit */}
        {rightAlbums.map((p, i) => {
          const col = i % 5, row = Math.floor(i / 5);
          const z = -6 + col * 2.3;
          const y = 7.3 - row * 1.7;
          if (row >= 1 && z > -3.6 && z < 1.0) return null; // leave room for the shelf
          return <AlbumPoster key={p.img} poster={p} position={[10.7, y, z]} rotation={[0, -Math.PI / 2, 0]} w={1.25} />;
        })}

        {/* ---- LED shelf unit with objects (right wall) ---- */}
        <group position={[10.5, 0.4, -1.4]} rotation={[0, -Math.PI / 2, 0]}>
          <ShelfUnit position={[0, 0, 0]} wood={tex.woodLight} />
          <Plaque position={[-0.9, 1.95, 0.15]} label="$20K" sub="Luby Pitch · 2026" />
          <Plaque position={[0.9, 1.95, 0.15]} label="$1.85K" sub="1789 Venture Fund" accent="#C9BEE6" />
          <Model src="camera" fit={0.7} position={[0.7, 0.1, 0.1]} rotation={[0, -0.6, 0]} />
          <Model src="dumbbell" fit={0.55} position={[-0.8, 3.5, 0.1]} rotation={[0, 0.4, 0]} />
          <Model src="golfclub" fit={1.1} position={[0.9, 3.45, 0.1]} rotation={[0, 0, 0.5]} />
          <Model src="plant" fit={0.9} position={[-0.9, 0.1, 0.1]} />
        </group>

        {/* ---- the desk + turntable + monitors ---- */}
        <Model src="mixingdesk" fit={3.4} position={[0, 0, -4.2]} rotation={[0, 0, 0]} envIntensity={0.9} />
        <Model src="turntable" fit={1.15} position={[-1.0, 1.15, -4.0]} rotation={[0, 0.3, 0]} envIntensity={1.1} />
        <Monitor position={[2.3, 1.5, -4.2]} rotation={[0, -0.4, 0]} />
        <Monitor position={[-3.2, 1.5, -4.2]} rotation={[0, 0.4, 0]} />
        <Model src="chair" fit={1.15} position={[0, 0, -2.4]} rotation={[0, Math.PI, 0]} />
        <Model src="mic" fit={0.62} position={[1.35, 1.16, -3.7]} rotation={[0.5, -0.3, 0]} cast />

        {/* ---- guitars on stands (left) — clickable to Music ---- */}
        <ClickTo sectionKey="MUSIC">
          <group position={[-6.6, 0, -3]}>
            <Model src="bass" fit={1.7} position={[0, 0, 0]} rotation={[0, 0.5, 0.06]} />
            <Model src="electric" fit={1.5} position={[1.1, 0, 0.5]} rotation={[0, 0.9, -0.05]} />
            <Model src="acoustic" fit={1.6} position={[-1.0, 0, 0.4]} rotation={[0, 0.2, 0.05]} />
          </group>
          <Model src="amp" fit={1.1} position={[-8.4, 0, -1.6]} rotation={[0, 0.7, 0]} />
        </ClickTo>

        {/* ---- drums (right corner) — clickable to Music ---- */}
        <ClickTo sectionKey="MUSIC">
          <Model src="drums" fit={2.4} position={[6.4, 0, -3.6]} rotation={[0, -0.7, 0]} />
        </ClickTo>

        {/* ---- ambience ---- */}
        <Model src="lamp" fit={2.6} position={[-9.2, 0, 3.4]} rotation={[0, 0, 0]} envIntensity={1.2} />
        <Model src="plant" fit={1.7} position={[8.8, 0, 3.2]} />
        <pointLight position={[-9.2, 2.4, 3.4]} intensity={1.3} distance={9} color="#ffb066" />
      </Suspense>

      {/* the face-out record display on the back wall */}
      <Records y={2.75} z={-6.55} />

      {/* consistent soft contact shadows */}
      <ContactShadows position={[0, 0.02, -3]} scale={30} resolution={1024} blur={2.6} opacity={0.55} far={9} color="#000000" />
    </group>
  );
}
