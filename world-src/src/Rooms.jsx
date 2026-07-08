import React, { useEffect, Suspense } from 'react';
import { ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from './store.js';
import { Frame, VideoScreen, Panel, Label, ContactStation } from './bits.jsx';

// Collect a flat list of photo filenames for a section (handles nested shapes).
export function collectPhotos(s) {
  const out = [...(s.photos || [])];
  if (s.portraits) out.push(...s.portraits);
  if (s.trips) s.trips.forEach((t) => { out.push(t.cover, ...(t.gallery || [])); });
  if (s.iron) out.push(...(s.iron.photos || []));
  if (s.golf) out.push(...(s.golf.photos || []));
  if (s.concerts) s.concerts.forEach((c) => out.push(c.img));
  if (s.replay) s.replay.forEach(([p]) => out.push(p));
  return [...new Set(out)];
}
function reelList(s) {
  if (!s.reels) return [];
  return s.reels.map((r) => (typeof r === 'string' ? r : r.v));
}

// A generic, always-functional room: a gallery lined with the section's real
// photos + reels + info panels. Specific rooms replace this with richer sets.
export function GenericRoom({ section: s }) {
  const photos = collectPhotos(s);
  const reels = reelList(s);
  const accent = s.accent;

  // side-wall columns of framed photos facing inward (readable from the camera)
  const half = Math.ceil(photos.length / 2);
  const left = photos.slice(0, Math.min(half, 8));
  const right = photos.slice(8, 16);

  return (
    <group>
      {/* shell: floor + back wall + two side walls */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[50, 50]} /><meshStandardMaterial color="#160f0a" roughness={0.96} /></mesh>
      <mesh receiveShadow position={[0, 5, -11]}><boxGeometry args={[26, 14, 0.4]} /><meshStandardMaterial color="#241a13" roughness={0.95} /></mesh>
      <mesh receiveShadow position={[-9, 5, -2]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[20, 14, 0.4]} /><meshStandardMaterial color="#20160f" roughness={0.95} /></mesh>
      <mesh receiveShadow position={[9, 5, -2]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[20, 14, 0.4]} /><meshStandardMaterial color="#20160f" roughness={0.95} /></mesh>

      {/* accent-lit title on the back wall */}
      <Label position={[0, 7, -10.7]} size={1.9} color={accent} font>{s.key}</Label>
      <Label position={[0, 5.7, -10.7]} size={0.26} color="#F4EFE6" mono opacity={0.7}>{(s.eyebrow || '').toUpperCase()}</Label>
      <pointLight position={[0, 6, -8]} intensity={0.8} distance={14} color={accent} />

      {/* info + stats panels flanking, angled toward the camera (no mirror) */}
      <Panel position={[-4.4, 2.5, -4]} rotation={[0, 0.55, 0]} width={260} accent={accent}>
        <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 15, opacity: 0.9, lineHeight: 1.4 }}>{s.blurb}</div>
      </Panel>
      {(s.stats || s.bandStats || s.facts) && (
        <Panel position={[4.4, 2.5, -4]} rotation={[0, -0.55, 0]} width={230} accent={accent}>
          {(s.stats || s.bandStats || s.facts).map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '5px 0', borderTop: i ? '1px solid rgba(244,239,230,.08)' : 'none' }}>
              <span style={{ opacity: 0.5, fontFamily: 'Geist Mono, monospace', fontSize: 9.5, textTransform: 'uppercase' }}>{k}</span><span style={{ textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </Panel>
      )}

      <Suspense fallback={null}>
        {/* left wall gallery */}
        {left.map((p, i) => (
          <Frame key={'l' + p + i} src={p} position={[-8.7, 3.6 - (i % 2) * 2.1, 1 - Math.floor(i / 2) * 2.4]} rotation={[0, Math.PI / 2, 0]} width={1.7} accent={accent} />
        ))}
        {/* right wall gallery */}
        {right.map((p, i) => (
          <Frame key={'r' + p + i} src={p} position={[8.7, 3.6 - (i % 2) * 2.1, 1 - Math.floor(i / 2) * 2.4]} rotation={[0, -Math.PI / 2, 0]} width={1.7} accent={accent} />
        ))}
        {/* reels on the back wall */}
        {reels.slice(0, 3).map((v, i) => (
          <VideoScreen key={v} src={v} position={[(i - (Math.min(reels.length, 3) - 1) / 2) * 3.4, 2, -10.6]} width={2.9} accent={accent} />
        ))}
      </Suspense>

      <ContactShadows position={[0, 0.02, -3]} scale={34} resolution={1024} blur={2.6} opacity={0.5} far={10} />
    </group>
  );
}

import MusicRoom from './MusicRoom.jsx';

// Registry — specific room components get added here as they're built.
const REGISTRY = { MUSIC: MusicRoom };
export function registerRoom(key, comp) { REGISTRY[key] = comp; }
export function ActiveRoom() {
  const section = useStore((s) => s.section);
  const shown = useStore((s) => s.shown);
  if (!section || shown === 'hub') return null;
  const Comp = REGISTRY[section.key] || GenericRoom;
  return (
    <>
      <Environment preset="night" environmentIntensity={0.4} />
      <ambientLight intensity={1.0} color="#4a3626" />
      <hemisphereLight intensity={0.7} color={section.accent} groundColor="#180f0a" />
      <pointLight position={[0, 5, -2]} intensity={3.0} distance={20} color="#ffd9a0" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-8, 4, -2]} intensity={2.0} distance={16} color={section.accent} />
      <pointLight position={[8, 4, -2]} intensity={2.0} distance={16} color="#ffce9a" />
      <pointLight position={[0, 4, -9]} intensity={1.6} distance={14} color="#ffb066" />
      <Comp section={section} />
    </>
  );
}

// Transition timing: schedule the scene swap + phase completion mid-overlay.
export function Timers() {
  const phase = useStore((s) => s.phase);
  const { swapToRoom, finishDrop, swapToHub, finishReturn } = useStore.getState();
  useEffect(() => {
    if (phase === 'dropping') {
      const t1 = setTimeout(() => useStore.getState().swapToRoom(), 700);
      const t2 = setTimeout(() => useStore.getState().finishDrop(), 1350);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (phase === 'returning') {
      const t1 = setTimeout(() => useStore.getState().swapToHub(), 650);
      const t2 = setTimeout(() => useStore.getState().finishReturn(), 1300);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [phase]);
  return null;
}
