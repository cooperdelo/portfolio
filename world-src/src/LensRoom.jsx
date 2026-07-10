import React, { Suspense } from 'react';
import { ContactShadows } from '@react-three/drei';
import { Model } from './Model.jsx';
import { Frame, VideoScreen, Panel, Label, InfoTile, Embed } from './bits.jsx';
import { RoomShell } from './studio.jsx';

const ACCENT = '#E7C9A0';

// A travel station: big cover + placard + a couple gallery tiles, on a wall.
function TripStation({ trip, x, z, side }) {
  const rot = side < 0 ? Math.PI / 2 : -Math.PI / 2; // face inward
  const g = trip.gallery.slice(0, 3);
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Frame src={trip.cover} position={[0, 4.2, 0]} width={2.6} accent={ACCENT} caption={`${trip.name} · ${trip.place}`} />
      <Panel position={[0, 5.9, 0]} width={230} accent={ACCENT}>
        <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 20, textTransform: 'uppercase' }}>{trip.name}</div>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8.5, letterSpacing: '.1em', textTransform: 'uppercase', color: ACCENT, margin: '2px 0 5px' }}>{trip.meta}</div>
        <div style={{ fontSize: 10.5, lineHeight: 1.45, opacity: 0.85 }}>{trip.blurb}</div>
      </Panel>
      {g.map((p, i) => (
        <Frame key={p} src={p} position={[(i - (g.length - 1) / 2) * 1.55, 2.2, 0]} width={1.35} accent={ACCENT} />
      ))}
    </group>
  );
}

export default function LensRoom({ section: s }) {
  const left = s.trips.slice(0, 3);
  const right = s.trips.slice(3, 6);
  return (
    <group>
      {/* real studio shell (darkroom edition — warm brick, red safelights) */}
      <RoomShell halfW={13} backZ={-14} height={13} frontZ={9} accent={ACCENT} />

      {/* warm lighting + red safelight accents */}
      <pointLight position={[0, 5, -4]} intensity={3.0} distance={22} color="#ffdca0" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-9, 4, -3]} intensity={2.4} distance={16} color={ACCENT} />
      <pointLight position={[9, 4, -3]} intensity={2.4} distance={16} color={ACCENT} />
      <pointLight position={[0, 3, 4]} intensity={1.4} distance={16} color="#ff5a3a" />

      {/* title */}
      <Label position={[0, 8.6, -13.6]} size={1.7} color={ACCENT} font max={26}>LENS</Label>
      <Label position={[0, 7.2, -13.6]} size={0.26} color="#F4EFE6" mono opacity={0.7} max={26}>THROUGH THE FRAME</Label>
      <Panel position={[0, 5.4, -13.4]} width={360} accent={ACCENT}>
        <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 14, textAlign: 'center', opacity: 0.9, lineHeight: 1.4 }}>{s.manifesto}</div>
      </Panel>

      {/* travel stations pulled inward along the side walls */}
      <Suspense fallback={null}>
        {left.map((t, i) => <TripStation key={t.name} trip={t} x={-9} z={1 - i * 4.4} side={-1} />)}
        {right.map((t, i) => <TripStation key={t.name} trip={t} x={9} z={1 - i * 4.4} side={1} />)}

        {/* the kit — 4 camera gear on a back shelf */}
        <mesh position={[-6, 2.2, -13.6]} receiveShadow><boxGeometry args={[7, 0.16, 0.7]} /><meshStandardMaterial color="#2a1c12" roughness={0.7} /></mesh>
        <Model src="camera" fit={1.1} position={[-8.4, 2.3, -13.3]} rotation={[0, 0.4, 0]} />
        {s.kit.map((k, i) => (
          <InfoTile key={k.name} src={k.img} position={[-7.3 + i * 1.6, 3.4, -13.5]} width={1.4} accent={ACCENT} cardSide={i < 2 ? 1 : -1}
            info={{ eyebrow: `THE KIT · ${k.badge}`, title: k.name, meta: k.specs }}
            card={<>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8.5, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT }}>{k.badge}</div>
              <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 16, textTransform: 'uppercase', margin: '3px 0 6px' }}>{k.name}</div>
              {k.specs.map(([a, b], j) => <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Geist Mono, monospace', fontSize: 8.5, textTransform: 'uppercase', opacity: 0.7, padding: '2px 0' }}><span>{a}</span><span>{b}</span></div>)}
            </>} />
        ))}
        <Label position={[-6, 4.4, -13.5]} size={0.3} color={ACCENT} font>THE KIT</Label>

        {/* the reel — 4 vertical phone screens */}
        <Label position={[6.5, 5, -13.5]} size={0.3} color={ACCENT} font>THE REEL</Label>
        {s.reels.map((r, i) => (
          <VideoScreen key={r.v} src={r.v} poster={r.poster} label={r.label} position={[4 + i * 1.9, 3, -13.5]} width={1.5} aspect={9 / 16} accent={ACCENT} />
        ))}

        {/* in rotation — on the right wall past the trips (nothing floats mid-room) */}
        <Label position={[12.55, 6.2, 6.2]} rotation={[0, -Math.PI / 2, 0]} size={0.34} color={ACCENT} font>IN ROTATION</Label>
        <Embed position={[12.55, 3.2, 6.2]} rotation={[0, -Math.PI / 2, 0]} url={s.embeds[0].url} kind="apple" label={s.embeds[0].label} accent={ACCENT} w={300} h={330} />
        {s.replay.map(([p, m], i) => (
          <Frame key={p} src={p} position={[12.55, 5.4 - i * 1.65, 8.4]} rotation={[0, -Math.PI / 2, 0]} width={1.4} accent={ACCENT} caption={m} />
        ))}
      </Suspense>

      <ContactShadows position={[0, 0.02, -4]} scale={44} resolution={1024} blur={2.6} opacity={0.45} far={13} />
    </group>
  );
}
