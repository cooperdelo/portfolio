import React, { Suspense } from 'react';
import { ContactShadows } from '@react-three/drei';
import { Model } from './Model.jsx';
import { Frame, VideoScreen, Panel, Label, InfoTile } from './bits.jsx';

const ACCENT = '#C9BEE6';

export default function PlugverseRoom({ section: s }) {
  return (
    <group>
      {/* shell */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[54, 54]} /><meshStandardMaterial color="#12100f" roughness={0.95} /></mesh>
      <mesh receiveShadow position={[0, 6, -13]}><boxGeometry args={[30, 16, 0.4]} /><meshStandardMaterial color="#171622" roughness={0.9} /></mesh>
      <mesh receiveShadow position={[-11, 6, -3]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[22, 16, 0.4]} /><meshStandardMaterial color="#14131c" roughness={0.92} /></mesh>
      <mesh receiveShadow position={[11, 6, -3]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[22, 16, 0.4]} /><meshStandardMaterial color="#14131c" roughness={0.92} /></mesh>

      {/* lighting */}
      <ambientLight intensity={0.7} color="#4a4658" />
      <pointLight position={[0, 5, -3]} intensity={3.2} distance={20} color="#cfc6e8" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-6, 4, -6]} intensity={2.4} distance={16} color={ACCENT} />
      <pointLight position={[6, 4, -2]} intensity={1.8} distance={16} color="#ffb066" />

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
        <VideoScreen src="plugverse_ui.mp4" position={[-1.6, 2.4, -9.6]} rotation={[0, 0.25, 0]} width={2.6} accent={ACCENT} />
        <VideoScreen src="hero_plugverse_product.mov" position={[1.8, 2.4, -9.6]} rotation={[0, -0.25, 0]} width={2.4} accent={ACCENT} />
      </Suspense>

      {/* founder-story timeline along the left wall */}
      <Label position={[-10.6, 7, -3]} rotation={[0, Math.PI / 2, 0]} size={0.5} color={ACCENT} font max={20}>THE STORY</Label>
      {s.story.map((b, i) => (
        <Panel key={i} position={[-10.5, 5 - i * 1.9, -1 + 0]} rotation={[0, Math.PI / 2, 0]} width={240} accent={ACCENT}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT }}>{`0${i + 1} · ${b.h}`}</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, opacity: 0.88, marginTop: 5 }}>{b.t}</div>
        </Panel>
      ))}

      {/* three-sided marketplace kiosks (center front) */}
      {s.kiosks.map((k, i) => (
        <group key={k.role} position={[(i - 1) * 3.2, 0, -3.5]}>
          <mesh castShadow receiveShadow position={[0, 1.1, 0]}><boxGeometry args={[2, 2.2, 0.3]} /><meshStandardMaterial color="#1a1826" roughness={0.6} metalness={0.2} emissive={ACCENT} emissiveIntensity={0.04} /></mesh>
          <Label position={[0, 1.85, 0.18]} size={0.18} color={ACCENT} font>{k.role}</Label>
          <Label position={[0, 1.5, 0.18]} size={0.1} color="#F4EFE6" max={1.7}>{k.h}</Label>
          <Label position={[0, 0.95, 0.18]} size={0.075} color="#F4EFE6" max={1.7} opacity={0.7}>{k.t}</Label>
        </group>
      ))}

      {/* the $20K trophy + wins (right wall) */}
      <Label position={[10.6, 7, -3]} rotation={[0, -Math.PI / 2, 0]} size={0.5} color={ACCENT} font max={20}>THE WINS</Label>
      <group position={[9.2, 0, -3]}>
        <mesh castShadow receiveShadow position={[0, 0.9, 0]}><cylinderGeometry args={[0.9, 1.1, 1.8, 6]} /><meshStandardMaterial color="#1a1826" roughness={0.5} metalness={0.3} /></mesh>
        <Suspense fallback={null}>
          <Frame src="luby_pic_with_check.jpg" position={[0, 2.6, 0.2]} rotation={[0, -Math.PI / 2, 0]} width={2.2} accent={ACCENT} caption="$20K · Luby Pitch · Apr 2026" />
        </Suspense>
        <Label position={[0, 1.5, 0.5]} rotation={[0, -Math.PI / 2, 0]} size={0.4} color="#ff8a4a" font>$20K</Label>
      </group>
      {s.wins.map((w, i) => (
        <Panel key={i} position={[10.5, 5 - i * 1.6, -6.5]} rotation={[0, -Math.PI / 2, 0]} width={210} accent={ACCENT}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 20, color: ACCENT }}>{w[0]}</span>
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8, textTransform: 'uppercase', opacity: 0.6 }}>{w[2]}</span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{w[1]}</div>
        </Panel>
      ))}

      {/* stat plaques + closing quote (front) */}
      <Panel position={[-4.6, 2.4, -1]} rotation={[0, 0.6, 0]} width={230} accent={ACCENT}>
        {s.stats.map(([k, v], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderTop: i ? '1px solid rgba(244,239,230,.08)' : 'none' }}>
            <span style={{ opacity: 0.5, fontFamily: 'Geist Mono, monospace', fontSize: 9.5, textTransform: 'uppercase' }}>{k}</span><span>{v}</span>
          </div>
        ))}
      </Panel>
      <Panel position={[4.6, 2.4, -1]} rotation={[0, -0.6, 0]} width={230} accent={ACCENT}>
        <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 14, lineHeight: 1.45, opacity: 0.9 }}>{s.closing}</div>
      </Panel>

      <ContactShadows position={[0, 0.02, -4]} scale={40} resolution={1024} blur={2.6} opacity={0.5} far={12} />
    </group>
  );
}
