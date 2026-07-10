import React, { Suspense } from 'react';
import { ContactShadows, Html } from '@react-three/drei';
import { Model } from './Model.jsx';
import { Frame, VideoScreen, Panel, Label, InfoTile } from './bits.jsx';
import { RoomShell } from './studio.jsx';

const ACCENT = '#FF8A3D';

// A giant novelty check mounted on the wall — the $20K Luby Pitch win.
function GiantCheck({ position, rotation }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow><boxGeometry args={[5.4, 2.5, 0.08]} /><meshStandardMaterial color="#f2ede2" roughness={0.55} /></mesh>
      <mesh position={[0, 0, -0.02]}><boxGeometry args={[5.62, 2.72, 0.06]} /><meshStandardMaterial color="#1a1210" roughness={0.6} metalness={0.2} /></mesh>
      <Html position={[0, 0, 0.06]} transform occlude zIndexRange={[25, 0]} distanceFactor={3.6} style={{ pointerEvents: 'none' }}>
        <div style={{ width: 420, height: 190, padding: '16px 22px', color: '#141210', fontFamily: 'Geist, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 20, letterSpacing: '.02em' }}>LUBY PITCH COMPETITION</div>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12 }}>APRIL 2026</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: '2px solid #141210', paddingBottom: 6 }}>
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, textTransform: 'uppercase', opacity: 0.7 }}>Pay to the order of</span>
            <span style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 24, fontWeight: 600 }}>Plugverse LLC — Cooper Delo</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 44, color: '#b3541e' }}>$20,000<span style={{ fontSize: 22 }}>.00</span></div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 16 }}>Innovate Carolina</div>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, textTransform: 'uppercase', opacity: 0.6 }}>zero equity taken</div>
            </div>
          </div>
        </div>
      </Html>
      <pointLight position={[0, 0.5, 1.4]} intensity={1.6} distance={7} color="#ffe2c0" />
    </group>
  );
}

export default function PlugverseRoom({ section: s }) {
  return (
    <group>
      {/* real studio shell */}
      <RoomShell halfW={11} backZ={-13} height={13} frontZ={9} accent={ACCENT} />

      {/* lighting */}
      <pointLight position={[0, 5, -3]} intensity={3.4} distance={20} color="#ffd9b0" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-6, 4, -6]} intensity={2.4} distance={16} color={ACCENT} />
      <pointLight position={[6, 4, -2]} intensity={1.8} distance={16} color="#ffb066" />
      <pointLight position={[0, 3.5, -3]} intensity={2.2} distance={14} color={ACCENT} />

      {/* title + neon PLUG IN sign */}
      <Label position={[0, 8.4, -12.6]} size={1.5} color={ACCENT} font max={26}>PLUGVERSE</Label>
      <Label position={[0, 7.1, -12.6]} size={0.3} color="#F4EFE6" mono opacity={0.75} max={26}>{s.tagline.toUpperCase()}</Label>
      <group position={[0, 5.4, -12.5]}>
        <Label size={0.8} color="#ff8a4a" font>PLUG IN.</Label>
        <pointLight position={[0, 0, 1]} intensity={2} distance={8} color="#ff8a4a" />
      </group>

      {/* product desk with two live screens */}
      <Suspense fallback={null}>
        <Model src="mixingdesk" fit={3.6} position={[0, 0, -9.4]} />
        <Model src="chair" fit={1.2} position={[0, 0, -7.6]} rotation={[0, Math.PI, 0]} />
        <VideoScreen src="plugverse_ui.mp4" poster="Plugverse_picture.jpeg" label="Plugverse — booking flow" position={[-2.9, 3.2, -12.5]} width={3.4} aspect={1.1} accent={ACCENT} />
        <VideoScreen src="hero_plugverse_product.mov" poster="plugverse_profile.jpg" label="Artist profile" position={[2.9, 3.2, -12.5]} width={3.2} aspect={1.1} accent={ACCENT} />
      </Suspense>

      {/* founder-story timeline — horizontal strip along the left wall
          (was a vertical stack whose last two panels sat below the floor) */}
      <Label position={[-10.6, 6.6, -1.6]} rotation={[0, Math.PI / 2, 0]} size={0.5} color={ACCENT} font max={20}>THE STORY</Label>
      <mesh position={[-10.7, 3.7, -1.6]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[15.4, 0.03, 0.03]} /><meshStandardMaterial color="#3a3348" emissive={ACCENT} emissiveIntensity={0.9} /></mesh>
      {s.story.map((b, i) => (
        <Panel key={i} position={[-10.55, i % 2 ? 2.4 : 5.0, -8 + i * 3.2]} rotation={[0, Math.PI / 2, 0]} width={280} distanceFactor={3.6} accent={ACCENT}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT }}>{`0${i + 1} · ${b.h}`}</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.5, opacity: 0.9, marginTop: 7 }}>{b.t}</div>
        </Panel>
      ))}

      {/* three-sided marketplace kiosks — proper product-booth cards */}
      {s.kiosks.map((k, i) => (
        <group key={k.role} position={[(i - 1) * 3.6, 0, -3.6]} rotation={[0, (1 - i) * 0.14, 0]}>
          <mesh castShadow receiveShadow position={[0, 1.25, -0.02]}><boxGeometry args={[2.5, 2.5, 0.18]} /><meshStandardMaterial color="#181210" roughness={0.55} metalness={0.15} /></mesh>
          <mesh position={[0, 2.46, 0.08]}><boxGeometry args={[2.5, 0.08, 0.2]} /><meshStandardMaterial color="#4a2c14" emissive={ACCENT} emissiveIntensity={1.6} /></mesh>
          <mesh castShadow position={[0, 0.06, 0.3]}><boxGeometry args={[1.6, 0.12, 0.9]} /><meshStandardMaterial color="#241a12" roughness={0.7} /></mesh>
          <Html position={[0, 1.32, 0.09]} transform occlude zIndexRange={[25, 0]} distanceFactor={3.4} style={{ pointerEvents: 'none' }}>
            <div style={{ width: 190, height: 190, padding: '18px 16px', boxSizing: 'border-box', textAlign: 'center', color: '#F4EFE6', fontFamily: 'Geist, sans-serif', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: ACCENT }}>{`0${i + 1}`}</div>
              <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 26, textTransform: 'uppercase', letterSpacing: '.02em' }}>{k.role}</div>
              <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 14, color: ACCENT }}>{k.h}</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.5, opacity: 0.85 }}>{k.t}</div>
            </div>
          </Html>
          <pointLight position={[0, 2.8, 0.8]} intensity={0.8} distance={4.5} color={ACCENT} />
        </group>
      ))}

      {/* THE WINS (right wall): giant novelty check + the real photo + win plaques */}
      <Label position={[10.6, 7.2, -3]} rotation={[0, -Math.PI / 2, 0]} size={0.5} color={ACCENT} font max={20}>THE WINS</Label>
      <GiantCheck position={[10.6, 4.4, -5.2]} rotation={[0, -Math.PI / 2, 0]} />
      <Suspense fallback={null}>
        <Frame src="luby_pic_with_check.jpg" position={[10.55, 1.55, -6.0]} rotation={[0, -Math.PI / 2, 0]} width={2.6} accent={ACCENT} caption="$20K · Luby Pitch · Apr 2026" />
      </Suspense>
      {s.wins.map((w, i) => (
        <Panel key={i} position={[10.55, 4.9 - i * 1.75, -0.4]} rotation={[0, -Math.PI / 2, 0]} width={240} distanceFactor={3.4} accent={ACCENT}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 26, color: ACCENT }}>{w[0]}</span>
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, textTransform: 'uppercase', opacity: 0.65 }}>{w[2]}</span>
          </div>
          <div style={{ fontSize: 13.5, opacity: 0.9, marginTop: 4 }}>{w[1]}</div>
        </Panel>
      ))}

      {/* stat plaques + closing quote — mounted on the right wall */}
      <Panel position={[10.55, 4.7, 3.6]} rotation={[0, -Math.PI / 2, 0]} width={230} distanceFactor={3.2} accent={ACCENT}>
        {s.stats.map(([k, v], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderTop: i ? '1px solid rgba(244,239,230,.08)' : 'none' }}>
            <span style={{ opacity: 0.5, fontFamily: 'Geist Mono, monospace', fontSize: 9.5, textTransform: 'uppercase' }}>{k}</span><span>{v}</span>
          </div>
        ))}
      </Panel>
      <Panel position={[10.55, 2.3, 3.6]} rotation={[0, -Math.PI / 2, 0]} width={230} distanceFactor={3.2} accent={ACCENT}>
        <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 14, lineHeight: 1.45, opacity: 0.9 }}>{s.closing}</div>
      </Panel>

      <ContactShadows position={[0, 0.02, -4]} scale={40} resolution={1024} blur={2.6} opacity={0.5} far={12} />
    </group>
  );
}
