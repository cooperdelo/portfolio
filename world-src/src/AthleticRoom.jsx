import React, { Suspense } from 'react';
import { ContactShadows } from '@react-three/drei';
import { Model } from './Model.jsx';
import { Frame, VideoScreen, Panel, Label, InfoTile } from './bits.jsx';
import { RoomShell } from './studio.jsx';

const ACCENT = '#9FC9C7';

function StatPanel({ stats, position, rotation, title }) {
  return (
    <Panel position={position} rotation={rotation} width={220} accent={ACCENT}>
      {title && <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: ACCENT, marginBottom: 6 }}>{title}</div>}
      {stats.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderTop: i ? '1px solid rgba(244,239,230,.08)' : 'none' }}>
          <span style={{ opacity: 0.5, fontFamily: 'Geist Mono, monospace', fontSize: 9.5, textTransform: 'uppercase' }}>{k}</span><span>{v}</span>
        </div>
      ))}
    </Panel>
  );
}

export default function AthleticRoom({ section: s }) {
  return (
    <group>
      {/* real studio shell */}
      <RoomShell halfW={11} backZ={-13} height={13} frontZ={9} accent={ACCENT} />

      {/* lighting */}
      <pointLight position={[0, 5, -3]} intensity={3.0} distance={20} color="#dfeeec" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-6, 4, -4]} intensity={2.4} distance={16} color={ACCENT} />
      <pointLight position={[6, 4, -4]} intensity={2.4} distance={16} color="#cfe8a0" />

      <Label position={[0, 8.4, -12.6]} size={1.6} color={ACCENT} font max={26}>ATHLETIC</Label>
      <Label position={[0, 7.1, -12.6]} size={0.28} color="#F4EFE6" mono opacity={0.7} max={26}>DISCIPLINE FIRST · HOBBY SECOND</Label>

      {/* ---- IRON zone (left) ---- */}
      <Label position={[-6, 5.4, -10]} size={0.6} color={ACCENT} font>IRON</Label>
      <Suspense fallback={null}>
        {/* bench */}
        <mesh castShadow receiveShadow position={[-6, 0.5, -8]}><boxGeometry args={[2.4, 0.3, 0.7]} /><meshStandardMaterial color="#161616" roughness={0.6} /></mesh>
        <mesh castShadow position={[-7, 0.25, -8]}><boxGeometry args={[0.15, 0.5, 0.7]} /><meshStandardMaterial color="#222" metalness={0.5} roughness={0.4} /></mesh>
        <mesh castShadow position={[-5, 0.25, -8]}><boxGeometry args={[0.15, 0.5, 0.7]} /><meshStandardMaterial color="#222" metalness={0.5} roughness={0.4} /></mesh>
        <Model src="dumbbell" fit={1.0} position={[-4.4, 0, -8]} rotation={[0, 0.4, 0]} />
        <Model src="dumbbell" fit={0.9} position={[-7.6, 0, -7.4]} rotation={[0, -0.3, 0]} />
        {s.iron.photos.map((p, i) => (
          <Frame key={p} src={p} position={[-9.9, 3.6 - i * 2.2, -6 + i * 0]} rotation={[0, Math.PI / 2, 0]} width={1.9} accent={ACCENT} />
        ))}
      </Suspense>
      <StatPanel stats={s.iron.stats} position={[-10.55, 3.2, -2.2]} rotation={[0, Math.PI / 2, 0]} title="The split" />

      {/* ---- GOLF zone (right) ---- */}
      <Label position={[6, 5.4, -10]} size={0.6} color={ACCENT} font>GOLF</Label>
      {/* putting green strip */}
      <mesh receiveShadow position={[6.5, 0.02, -6]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[6, 9]} /><meshStandardMaterial color="#2f5a34" roughness={0.9} /></mesh>
      <mesh position={[6.5, 0.03, -8]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.14, 24]} /><meshStandardMaterial color="#0a0a0a" /></mesh>
      <Suspense fallback={null}>
        <Model src="golfclub" fit={1.6} position={[8.4, 0, -5]} rotation={[0, 0.6, 0.2]} />
        {/* hole in one hero */}
        <Frame src="hole_in_one_par_4.JPG" position={[9.9, 4.4, -3]} rotation={[0, -Math.PI / 2, 0]} width={2.4} accent={ACCENT} caption="Hole in one · par 4" />
        <Label position={[9.85, 5.9, -3]} rotation={[0, -Math.PI / 2, 0]} size={0.24} color={ACCENT} font>HOLE IN ONE</Label>
        {/* the bag — 4 clubs */}
        {s.golf.bag.map((b, i) => (
          <InfoTile key={b.name} src={b.img} position={[9.9, 3.6 - (i % 2) * 2.1, -6.5 - Math.floor(i / 2) * 2.2]} rotation={[0, -Math.PI / 2, 0]} width={1.5} accent={ACCENT} cardSide={-1}
            info={{ eyebrow: `THE BAG · ${b.badge}`, title: b.name, meta: b.specs }}
            card={<>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8.5, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT }}>{b.badge}</div>
              <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 16, textTransform: 'uppercase', margin: '3px 0 6px' }}>{b.name}</div>
              {b.specs.map(([a, c], j) => <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Geist Mono, monospace', fontSize: 8.5, textTransform: 'uppercase', opacity: 0.7, padding: '2px 0' }}><span>{a}</span><span>{c}</span></div>)}
            </>} />
        ))}
        {/* swing photo — on the right wall above the golf zone */}
        <Frame src="golf_swing_finish.jpg" position={[10.55, 5.4, 0.8]} rotation={[0, -Math.PI / 2, 0]} width={2.0} accent={ACCENT} caption="On the course" />
      </Suspense>
      <StatPanel stats={s.golf.stats} position={[10.55, 3.2, 0.8]} rotation={[0, -Math.PI / 2, 0]} title="The hobby" />

      {/* snowboard + blurb — mounted on the back wall (nothing floats mid-room) */}
      <Suspense fallback={null}>
        <Frame src="snowboard_athletics.jpg" position={[0, 3.2, -12.55]} width={2.6} accent={ACCENT} caption="Snowboard" />
      </Suspense>
      <Panel position={[0, 5.6, -12.5]} width={300} accent={ACCENT}>
        <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 13.5, textAlign: 'center', opacity: 0.9, lineHeight: 1.4 }}>{s.blurb}</div>
      </Panel>

      <ContactShadows position={[0, 0.02, -4]} scale={40} resolution={1024} blur={2.6} opacity={0.5} far={12} />
    </group>
  );
}
