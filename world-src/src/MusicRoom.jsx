import React, { Suspense } from 'react';
import { ContactShadows, Image } from '@react-three/drei';
import { Model } from './Model.jsx';
import { Frame, VideoScreen, Panel, Label, InfoTile, Embed } from './bits.jsx';
import { RoomShell } from './studio.jsx';
import { P } from './data.js';

const ACCENT = '#FF4D2E';

// A band member: mic on a stand with a name plate.
function BandMic({ position, role, name, you }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.75, 0]}><cylinderGeometry args={[0.02, 0.03, 1.5, 8]} /><meshStandardMaterial color="#1a1a1e" metalness={0.7} roughness={0.35} /></mesh>
      <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.28, 0.32, 0.04, 20]} /><meshStandardMaterial color="#141416" metalness={0.5} roughness={0.5} /></mesh>
      <Suspense fallback={null}><Model src="mic" fit={0.5} position={[0, 1.5, 0.02]} rotation={[0.5, 0, 0]} cast /></Suspense>
      {you && <pointLight position={[0, 1.9, 0.4]} intensity={0.7} distance={3} color={ACCENT} />}
      <Label position={[0, 0.42, 0.34]} size={0.11} color={you ? ACCENT : '#F4EFE6'} mono>{role.toUpperCase()}</Label>
      <Label position={[0, 0.24, 0.34]} size={0.16} color="#F4EFE6">{name}</Label>
    </group>
  );
}

export default function MusicRoom({ section: s }) {
  return (
    <group>
      {/* ---- real studio shell (wood floor, brick walls, LED cove) ---- */}
      <RoomShell halfW={11} backZ={-13} height={13} frontZ={9} accent={ACCENT} />

      {/* ---- stage + room lighting (point lights aim reliably in R3F) ---- */}
      <pointLight position={[0, 4, -8.4]} intensity={5.5} distance={18} color="#ffd9a0" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 2.3, -7.6]} intensity={3.4} distance={12} color="#ffe0b0" />
      <pointLight position={[-4.4, 3, -8.4]} intensity={2.4} distance={12} color={ACCENT} />
      <pointLight position={[4.4, 3, -8.4]} intensity={2.4} distance={12} color="#ff945a" />
      <pointLight position={[0, 3.5, -1]} intensity={1.4} distance={16} color="#ffb066" />
      {/* wall fills for rig + concert galleries */}
      <pointLight position={[-8, 4, -3]} intensity={2.2} distance={14} color="#ffce9a" />
      <pointLight position={[8, 4, -3]} intensity={2.2} distance={14} color="#ffce9a" />

      {/* ---- stage (back) ---- */}
      <mesh receiveShadow castShadow position={[0, 0.2, -9.5]}><boxGeometry args={[16, 0.4, 5]} /><meshStandardMaterial color="#0f0a07" roughness={0.8} /></mesh>
      <Label position={[0, 8.6, -12.6]} size={1.5} color={ACCENT} font max={26}>RUBBER BAND</Label>
      <Label position={[0, 7.2, -12.6]} size={0.3} color="#F4EFE6" mono opacity={0.75} max={26}>BASS · COOPER DELO · 5-PIECE</Label>
      {/* rust marquee bars */}
      <mesh position={[0, 5.9, -12.7]}><boxGeometry args={[16, 0.05, 0.05]} /><meshStandardMaterial color="#4a1a12" emissive={ACCENT} emissiveIntensity={1.4} /></mesh>

      {/* band mic stands in an arc */}
      {s.lineup.map((m, i) => {
        const n = s.lineup.length;
        const ang = (i - (n - 1) / 2) * 0.32;
        return <BandMic key={m[1]} position={[Math.sin(ang) * 5.4, 0.4, -9.5 + Math.cos(ang) * 1.4 - 1]} role={m[0]} name={m[1]} you={m[3]} />;
      })}

      {/* drum kit + amps on the stage */}
      <Suspense fallback={null}>
        <Model src="drums" fit={2.6} position={[3.6, 0.4, -10.6]} rotation={[0, -0.5, 0]} />
        <Model src="amp" fit={1.4} position={[-4.6, 0.4, -10.6]} rotation={[0, 0.5, 0]} />
        <Model src="bass" fit={1.9} position={[-2.2, 0.4, -8.4]} rotation={[0, 0.4, 0.05]} />
      </Suspense>

      {/* ---- EP + solo stats (stage-front pedestal) ---- */}
      <group position={[6.2, 0, -6]}>
        <mesh castShadow receiveShadow position={[0, 0.8, 0]}><boxGeometry args={[1.4, 1.6, 1.4]} /><meshStandardMaterial color="#1a1109" roughness={0.7} /></mesh>
        <Suspense fallback={null}>
          <mesh position={[0, 2.15, 0]} rotation={[0, -0.5, 0]} castShadow><boxGeometry args={[1.5, 1.5, 0.06]} /><meshStandardMaterial color="#140f0b" /></mesh>
          <Image url={P + s.cover} position={[0.024 * Math.cos(-0.5), 2.15, 0.024 * Math.sin(-0.5) + 0.03]} rotation={[0, -0.5, 0]} scale={[1.45, 1.45]} toneMapped={false} />
        </Suspense>
        <Label position={[0, 3.15, 0]} size={0.16} color={ACCENT} mono>FLICKER OF TIME · EP</Label>
      </group>
      <Panel position={[7.0, 3.9, -12.5]} width={210} accent={ACCENT}>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: ACCENT }}>Cooper Delo · solo</div>
        {s.soloStats.map(([k, v], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderTop: i ? '1px solid rgba(244,239,230,.08)' : 'none' }}>
            <span style={{ opacity: 0.5, fontFamily: 'Geist Mono, monospace', fontSize: 9.5, textTransform: 'uppercase' }}>{k}</span><span>{v}</span>
          </div>
        ))}
        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 8, lineHeight: 1.5 }}>Influences: {s.influences.join(' · ')}</div>
      </Panel>

      {/* ---- THE RIG pegboard (left wall) ---- */}
      <Label position={[-10.6, 7, -3]} rotation={[0, Math.PI / 2, 0]} size={0.6} color={ACCENT} font>THE RIG</Label>
      <mesh position={[-10.75, 3.4, -3]} rotation={[0, Math.PI / 2, 0]} receiveShadow><boxGeometry args={[13, 6.4, 0.2]} /><meshStandardMaterial color="#12100e" roughness={0.85} /></mesh>
      <Suspense fallback={null}>
        {s.rig.map((g, i) => {
          const col = i % 5, row = Math.floor(i / 5);
          const z = -8.2 + col * 2.6;
          const y = 4.6 - row * 2.5;
          return (
            <InfoTile key={g.name} src={g.img} position={[-10.6, y, z]} rotation={[0, Math.PI / 2, 0]} width={1.6} accent={ACCENT} cardSide={1}
              card={<>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8.5, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT }}>{g.badge}</div>
                <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 17, textTransform: 'uppercase', margin: '3px 0 6px' }}>{g.name}</div>
                {g.specs.map(([k, v], j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Geist Mono, monospace', fontSize: 8.5, textTransform: 'uppercase', opacity: 0.7, padding: '2px 0' }}><span>{k}</span><span>{v}</span></div>
                ))}
              </>} />
          );
        })}
      </Suspense>

      {/* ---- SHOWS I'VE CAUGHT concert wall (right wall) ---- */}
      <Label position={[10.6, 7, -3]} rotation={[0, -Math.PI / 2, 0]} size={0.52} color={ACCENT} font>SHOWS I&apos;VE CAUGHT</Label>
      <mesh position={[10.75, 3.4, -3]} rotation={[0, -Math.PI / 2, 0]} receiveShadow><boxGeometry args={[13, 6.8, 0.2]} /><meshStandardMaterial color="#12100e" roughness={0.85} /></mesh>
      <Suspense fallback={null}>
        {s.concerts.map((c, i) => {
          const col = i % 3, row = Math.floor(i / 3);
          const z = -6.2 + col * 2.6;
          const y = 5.0 - row * 2.4;
          return (
            <InfoTile key={c.artist} src={c.img} position={[10.6, y, z]} rotation={[0, -Math.PI / 2, 0]} width={1.7} accent={ACCENT} cardSide={-1}
              card={<>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', color: ACCENT }}>{c.tag}</div>
                <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 16, textTransform: 'uppercase', margin: '2px 0 3px' }}>{c.artist}</div>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8, textTransform: 'uppercase', opacity: 0.6 }}>{c.date} · {c.venue}</div>
                <div style={{ fontSize: 10, lineHeight: 1.45, opacity: 0.85, marginTop: 5 }}>{c.blurb}</div>
              </>} />
          );
        })}
      </Suspense>

      {/* ---- front-of-house: setlist off-center + photos in the front corners
           (peripheral — you see them when you turn, they never block the stage) ---- */}
      <Suspense fallback={null}>
        <Embed position={[5.2, 2.8, 1.2]} rotation={[0, -0.4, 0]} url={s.embeds[0].url} label={s.embeds[0].label} accent={ACCENT} w={310} h={460} df={2.5} />
        <Frame src="rubber_band_full_pic.jpeg" position={[-8.7, 2.5, 0.8]} rotation={[0, 0.72, 0]} width={3.0} accent={ACCENT} caption="Rubber Band — live" />
        <Frame src="cooper_laughing_with_bass.jpg" position={[8.7, 2.5, 3.6]} rotation={[0, -0.72, 0]} width={3.0} accent={ACCENT} caption="Cat's Cradle" />
      </Suspense>
      <Panel position={[-7.0, 3.9, -12.5]} width={230} accent={ACCENT}>
        <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 14, opacity: 0.9, lineHeight: 1.4 }}>{s.blurb}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
          {s.bandStats.map(([k, v]) => (
            <span key={k} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', padding: '.3rem .5rem', borderRadius: 999, border: '1px solid rgba(244,239,230,.16)', opacity: 0.85 }}>{k}: {v}</span>
          ))}
        </div>
      </Panel>

      <ContactShadows position={[0, 0.02, -4]} scale={40} resolution={1024} blur={2.6} opacity={0.5} far={12} />
    </group>
  );
}
