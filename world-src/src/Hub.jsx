import React, { Suspense, useRef } from 'react';
import { ContactShadows, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Model } from './Model.jsx';
import Records from './Records.jsx';
import { useStore } from './store.js';
import { sectionByKey, SECTIONS, thumb } from './data.js';
import { POSTERS } from './posters.js';
import { usePBR, useStudioTextures, AlbumPoster, PhotoPoster, CityWindow, ShelfUnit, Plaque, RecordShelf, Cable, ConsoleDesk, DESK } from './studio.jsx';

// The record physically ejects from the shelf, arcs to the turntable and spins
// flat onto the platter during the needle-drop (the overlay covers only the swap).
function FlyingRecord({ section }) {
  const ref = useRef(); const inner = useRef(); const t = useRef(0);
  const tex = useTexture(thumb(section.cover));
  const idx = Math.max(0, SECTIONS.findIndex((s) => s.key === section.key));
  useFrame((_, dt) => {
    if (!ref.current) return;
    t.current += dt;
    const k = Math.min(t.current / 0.72, 1);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const sx = (idx - (SECTIONS.length - 1) / 2) * 1.5, sy = 2.85, sz = -6.2;
    const ex = -1.0, ey = 1.5, ez = -3.95;
    ref.current.position.set(sx + (ex - sx) * e, sy + (ey - sy) * e + Math.sin(k * Math.PI) * 1.0, sz + (ez - sz) * e);
    ref.current.rotation.x = (Math.PI / 2) * (1 - e);
    if (inner.current) inner.current.rotation.y += dt * (10 + 20 * k);
  });
  return (
    <group ref={ref}>
      <group ref={inner}>
        <mesh><cylinderGeometry args={[0.74, 0.74, 0.02, 48]} /><meshStandardMaterial color="#0a0a0c" roughness={0.35} metalness={0.5} /></mesh>
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.44, 48]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
        <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.05, 0.06, 32]} /><meshBasicMaterial color="#000" /></mesh>
      </group>
      <pointLight position={[0, 0.6, 0]} intensity={1.2} distance={4} color={section.accent} />
    </group>
  );
}

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

// Hanging pendant lamp — warm bulb + cone shade, over the desk (basement vibe).
function Pendant({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 9.15, 0]}><cylinderGeometry args={[0.015, 0.015, 3.7, 6]} /><meshStandardMaterial color="#1a1512" /></mesh>
      <mesh position={[0, 7.25, 0]}><coneGeometry args={[0.42, 0.52, 24, 1, true]} /><meshStandardMaterial color="#15100c" roughness={0.55} metalness={0.35} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 7.1, 0]}><sphereGeometry args={[0.09, 12, 12]} /><meshStandardMaterial color="#ffd9a0" emissive="#ffb066" emissiveIntensity={2.2} /></mesh>
      <pointLight position={[0, 6.85, 0]} intensity={0.8} distance={8} color="#ffb877" />
    </group>
  );
}

// The black record spinning on the turntable platter (always readable as a
// record player — and the FlyingRecord lands right here during the dive).
function SpinningVinyl({ position }) {
  const ref = useRef();
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 2.2; });
  return (
    <group ref={ref} position={position}>
      <mesh castShadow><cylinderGeometry args={[0.52, 0.52, 0.016, 48]} /><meshStandardMaterial color="#0a0a0c" roughness={0.32} metalness={0.4} /></mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.16, 0.5, 48]} /><meshStandardMaterial color="#111116" roughness={0.25} metalness={0.5} /></mesh>
      <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.15, 32]} /><meshStandardMaterial color="#FF4D2E" roughness={0.5} /></mesh>
    </group>
  );
}

// Album poster wall layouts — explicit slots that stay CLEAR of the window
// (left wall) and the shelf unit (right wall). No more covered vinyls.
const POSTER_Z = -6.7; // back-wall poster plane (wall face at -6.8 → no z-fight)
const OWN = POSTERS.filter((p) => p.own);
const ALBUMS = POSTERS.filter((p) => !p.own);
const backAlbums = ALBUMS.slice(0, 12);
const leftAlbums = ALBUMS.slice(12, 25);   // 13
const rightAlbums = ALBUMS.slice(25, 39);  // 14
// Side-wall slots. IMPORTANT: the back wall sits at z=-7, so side-wall slots
// must stay z ≥ -6.0 or the posters end up behind/inside the back wall.
// left wall: window occupies z -4.2..1.3 up to y ~5.1 → flank + top band
const L_SLOTS = [
  [-6.0, 6.3], [-6.0, 4.5], [-6.0, 2.7],
  [-4.4, 6.3], [-2.5, 6.3], [-0.6, 6.3], [1.3, 6.3],
  [3.3, 6.3], [3.3, 4.5], [3.3, 2.7],
  [5.2, 6.3], [5.2, 4.5], [5.2, 2.7],
];
// right wall: shelf occupies z -3.0..0.2 up to y ~5 → flank + top band
const R_SLOTS = [
  [-6.0, 6.3], [-6.0, 4.5], [-6.0, 2.7],
  [-4.4, 6.3], [-4.4, 4.5],
  [-2.6, 6.3], [-0.7, 6.3], [1.2, 6.3],
  [3.1, 6.3], [3.1, 4.5],
  [5.0, 6.3], [5.0, 4.5],
  [6.9, 6.3], [6.9, 4.5],
];

export default function Hub() {
  const tex = useStudioTextures();
  const floor = usePBR('floor', [10, 10]);
  const brickBack = usePBR('brick', [9, 5]);
  const brickSide = usePBR('brick', [8, 5]);
  const rugFab = usePBR('fabric', [3, 2.2]);
  const phase = useStore((s) => s.phase);
  const section = useStore((s) => s.section);
  return (
    <group>
      {phase === 'dropping' && section && <Suspense fallback={null}><FlyingRecord section={section} /></Suspense>}

      {/* ---- room shell: real wood floor + brick walls + ceiling ---- */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[46, 46]} />
        <meshStandardMaterial {...floor} color="#6f6357" roughness={0.92} envMapIntensity={0.3} />
      </mesh>
      <mesh receiveShadow position={[0, 4.5, -7]}>
        <boxGeometry args={[24, 13, 0.4]} />
        <meshStandardMaterial {...brickBack} color="#a08574" roughness={0.95} envMapIntensity={0.32} />
      </mesh>
      <mesh receiveShadow position={[-11, 4.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[22.4, 13, 0.4]} /><meshStandardMaterial {...brickSide} color="#967d6c" roughness={0.95} envMapIntensity={0.28} />
      </mesh>
      <mesh receiveShadow position={[11, 4.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[22.4, 13, 0.4]} /><meshStandardMaterial {...brickSide} color="#967d6c" roughness={0.95} envMapIntensity={0.28} />
      </mesh>
      <mesh position={[0, 11, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[24, 24]} /><meshStandardMaterial color="#120e0a" roughness={1} /></mesh>
      {/* front wall — closes the room (no more void when viewing side walls) */}
      <mesh receiveShadow position={[0, 4.5, 11]}>
        <boxGeometry args={[24, 13, 0.4]} /><meshStandardMaterial {...brickSide} color="#8d7663" roughness={0.95} envMapIntensity={0.25} />
      </mesh>
      {/* baseboards */}
      <mesh position={[0, 0.14, -6.76]}><boxGeometry args={[24, 0.28, 0.08]} /><meshStandardMaterial map={tex.wood} color="#5a4128" roughness={0.7} /></mesh>
      {/* cove LED strip along the back wall top */}
      <mesh position={[0, 9.6, -6.72]}><boxGeometry args={[22, 0.045, 0.045]} /><meshStandardMaterial color="#3a2a1a" emissive="#ff9b45" emissiveIntensity={1.8} /></mesh>
      <pointLight position={[0, 9.2, -5]} intensity={1.2} distance={16} color="#ffb877" />

      <Suspense fallback={null}>
        {/* ---- ALBUM POSTER WALLS ---- */}
        {backAlbums.map((p, i) => {
          const c = i % 6, r = Math.floor(i / 6);
          return <AlbumPoster key={p.img} poster={p} position={[(c - 2.5) * 2.6, 6.9 - r * 1.7, POSTER_Z]} rotation={[0, 0, 0]} w={1.3} />;
        })}
        {leftAlbums.map((p, i) => {
          const s = L_SLOTS[i]; if (!s) return null;
          return <AlbumPoster key={p.img} poster={p} position={[-10.7, s[1], s[0]]} rotation={[0, Math.PI / 2, 0]} w={1.25} />;
        })}
        {rightAlbums.map((p, i) => {
          const s = R_SLOTS[i]; if (!s) return null;
          return <AlbumPoster key={p.img} poster={p} position={[10.7, s[1], s[0]]} rotation={[0, -Math.PI / 2, 0]} w={1.25} />;
        })}

        {/* window sits lower + smaller so it never covers a poster row */}
        <CityWindow position={[-10.68, 2.9, -1.5]} rotation={[0, Math.PI / 2, 0]} w={5.4} h={3.8} />

        {/* ---- LED shelf unit with objects (right wall), evenly dressed ---- */}
        <group position={[10.5, 0.4, -1.4]} rotation={[0, -Math.PI / 2, 0]}>
          <ShelfUnit position={[0, 0, 0]} wood={tex.woodLight} />
          <Plaque position={[-0.85, 1.98, 0.15]} label="$20K" sub="Luby Pitch · 2026" />
          <Plaque position={[0.85, 1.98, 0.15]} label="$1.85K" sub="1789 Venture Fund" accent="#FF8A3D" />
          <Model src="camera" fit={0.62} position={[-0.75, 0.08, 0.12]} rotation={[0, -0.5, 0]} />
          <Model src="dumbbell" fit={0.5} position={[0.75, 0.1, 0.12]} rotation={[0, 0.4, 0]} />
          <Model src="golfclub" fit={1.0} position={[0.95, 3.42, 0.1]} rotation={[0, 0, 0.5]} />
          <Model src="plant" fit={0.85} position={[-0.85, 3.44, 0.1]} />
        </group>

        {/* ---- big fabric rug grounding the desk zone ---- */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -2.2]}>
          <planeGeometry args={[13, 8]} />
          <meshStandardMaterial {...rugFab} color="#31201a" roughness={0.98} />
        </mesh>

        {/* ---- the console desk: everything SITS on a real surface (DESK.top) ---- */}
        <ConsoleDesk position={[0, 0, -4.1]} />
        {/* turntable + spinning vinyl (the dive lands here) */}
        <Model src="turntable" fit={1.25} position={[-1.15, DESK.top, -4.1]} rotation={[0, 0.22, 0]} envIntensity={0.8} dim={0.85} />
        <SpinningVinyl position={[-1.15, DESK.top + 0.3, -4.1]} />
        {/* the mixer as a piece of gear on the desk */}
        <Model src="mixingdesk" fit={1.7} position={[0.7, DESK.top, -4.25]} rotation={[0, -0.06, 0]} envIntensity={0.55} dim={0.6} />
        {/* near-field monitors at the desk's back corners */}
        <Monitor position={[-2.6, DESK.top + 0.37, -4.45]} rotation={[0, 0.35, 0]} />
        <Monitor position={[2.6, DESK.top + 0.37, -4.45]} rotation={[0, -0.35, 0]} />
        <Model src="chair" fit={1.15} position={[0, 0, -2.5]} rotation={[0, Math.PI, 0]} dim={0.75} />
        <Model src="mic" fit={0.6} position={[1.95, DESK.top, -3.85]} rotation={[0.45, -0.3, 0]} cast />
        {/* EP on a desk stand — NOW PLAYING */}
        {OWN[0] && (
          <group position={[-2.45, DESK.top, -3.9]} rotation={[-0.08, 0.3, 0]}>
            <AlbumPoster poster={OWN[0]} position={[0, 0.5, 0]} w={0.9} />
            <mesh position={[0, 0.16, -0.14]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.5, 0.5, 0.04]} /><meshStandardMaterial color="#241a10" roughness={0.7} /></mesh>
          </group>
        )}
        {/* pendant lamps hanging over the desk */}
        <Pendant x={-2.2} z={-3.1} />
        <Pendant x={2.2} z={-3.1} />

        {/* ---- CABLES — the room is wired like a real studio ---- */}
        {/* guitars → amp */}
        <Cable from={[-6.4, 0.5, -2.9]} to={[-8.1, 0.55, -1.7]} sag={0.45} />
        <Cable from={[-5.5, 0.45, -2.6]} to={[-8.0, 0.5, -1.5]} sag={0.42} color="#2a1414" />
        {/* amp → desk */}
        <Cable from={[-8.2, 0.35, -1.9]} to={[-3.0, DESK.top - 0.2, -4.0]} mid={[-5.8, 0.03, -3.1]} />
        {/* mic → mixer */}
        <Cable from={[1.95, DESK.top + 0.05, -3.85]} to={[1.1, DESK.top - 0.06, -4.2]} sag={0.12} color="#20140f" radius={0.011} />
        {/* desk → right speaker cab */}
        <Cable from={[3.0, DESK.top - 0.25, -4.2]} to={[6.2, 0.4, -3.4]} mid={[4.6, 0.03, -3.6]} />

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

        {/* ---- lounge: sofa + coffee table + rug — visible left corner,
             facing the desk (basement corner you can actually see) ---- */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-6.6, 0.014, 3.2]}>
          <planeGeometry args={[6.6, 4.8]} />
          <meshStandardMaterial {...rugFab} color="#2e1a16" roughness={0.98} />
        </mesh>
        <Model src="sofa" fit={3.1} position={[-7.2, 0, 4.0]} rotation={[0, 0.85, 0]} dim={0.85} />
        <Model src="coffeetable" fit={1.4} position={[-5.2, 0, 2.2]} rotation={[0, 0.2, 0]} dim={0.85} />
        <Model src="plant" fit={1.7} position={[-9.4, 0, 6.2]} />

        {/* ---- record bookshelf on the right wall (front section) ---- */}
        <RecordShelf position={[10.55, 0, 3.4]} rotation={[0, -Math.PI / 2, 0]} cols={4} rows={2} />
        <Model src="plant" fit={1.5} position={[9.3, 0, 8.4]} />

        {/* ---- ambience ---- */}
        <Model src="lamp" fit={2.6} position={[-9.6, 0, 1.2]} rotation={[0, 0, 0]} envIntensity={1.2} />
        <pointLight position={[-9.6, 2.4, 1.2]} intensity={1.3} distance={9} color="#ffb066" />
      </Suspense>

      {/* the face-out record display on the back wall */}
      <Records y={2.75} z={-6.55} />

      {/* consistent soft contact shadows */}
      <ContactShadows position={[0, 0.02, -3]} scale={30} resolution={1024} blur={2.6} opacity={0.55} far={9} color="#000000" />
    </group>
  );
}
