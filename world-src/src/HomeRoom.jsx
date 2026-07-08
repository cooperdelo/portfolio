import React, { Suspense, useState, useEffect } from 'react';
import { ContactShadows, Html } from '@react-three/drei';
import { Frame, Panel, Label, ContactStation } from './bits.jsx';

const ACCENT = '#E8DCC6';

// Cycles the role words like the site's rotating sign.
function Roles({ roles }) {
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((v) => (v + 1) % roles.length), 1600); return () => clearInterval(id); }, [roles.length]);
  return (
    <Html position={[0, 3.4, -8]} transform occlude distanceFactor={2.6} style={{ pointerEvents: 'none' }}>
      <div style={{ textAlign: 'center', color: '#F4EFE6', fontFamily: 'Geist, sans-serif' }}>
        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', opacity: 0.5 }}>Role</span>
        <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 40, textTransform: 'uppercase', color: '#FF4D2E', minWidth: 260 }}>{roles[i]}</div>
      </div>
    </Html>
  );
}

export default function HomeRoom({ section: s }) {
  const portraits = s.portraits;
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[52, 52]} /><meshStandardMaterial color="#161009" roughness={0.95} /></mesh>
      <mesh receiveShadow position={[0, 6, -12]}><boxGeometry args={[28, 16, 0.4]} /><meshStandardMaterial color="#241a11" roughness={0.92} /></mesh>
      <mesh receiveShadow position={[-10, 6, -3]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[20, 16, 0.4]} /><meshStandardMaterial color="#20160e" roughness={0.94} /></mesh>
      <mesh receiveShadow position={[10, 6, -3]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[20, 16, 0.4]} /><meshStandardMaterial color="#20160e" roughness={0.94} /></mesh>

      <ambientLight intensity={0.9} color="#5a4632" />
      <pointLight position={[0, 5, -3]} intensity={3.2} distance={20} color="#ffe6c4" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-6, 4, -4]} intensity={2.2} distance={16} color="#ffce9a" />
      <pointLight position={[6, 4, -4]} intensity={2.2} distance={16} color="#ff945a" />

      {/* name + manifesto */}
      <Label position={[0, 8.6, -11.6]} size={1.5} color={ACCENT} font max={26}>COOPER DELO</Label>
      {s.manifesto.map((line, i) => (
        <Label key={i} position={[0, 7.1 - i * 0.7, -11.6]} size={0.5} color={i === s.manifesto.length - 1 ? '#FF4D2E' : '#F4EFE6'} font max={26}>{line}</Label>
      ))}

      {/* rotating role */}
      <Roles roles={s.roles} />

      {/* portrait gallery on side walls */}
      <Suspense fallback={null}>
        {portraits.slice(0, 4).map((p, i) => (
          <Frame key={'l' + p} src={p} position={[-9.8, 4 - (i % 2) * 2.3, 1 - Math.floor(i / 2) * 2.6]} rotation={[0, Math.PI / 2, 0]} width={2.0} accent={ACCENT} />
        ))}
        {portraits.slice(4, 7).map((p, i) => (
          <Frame key={'r' + p} src={p} position={[9.8, 4 - (i % 2) * 2.3, 1 - Math.floor(i / 2) * 2.6]} rotation={[0, -Math.PI / 2, 0]} width={2.0} accent={ACCENT} />
        ))}
      </Suspense>

      {/* quick facts */}
      <Panel position={[-4.4, 2.4, -1]} rotation={[0, 0.55, 0]} width={230} accent={ACCENT}>
        {s.facts.map(([k, v], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderTop: i ? '1px solid rgba(244,239,230,.08)' : 'none' }}>
            <span style={{ opacity: 0.5, fontFamily: 'Geist Mono, monospace', fontSize: 9.5, textTransform: 'uppercase' }}>{k}</span><span>{v}</span>
          </div>
        ))}
      </Panel>

      {/* in-world contact station */}
      <ContactStation position={[4.4, 2.2, -1]} rotation={[0, -0.55, 0]} accent={ACCENT} />

      <ContactShadows position={[0, 0.02, -4]} scale={40} resolution={1024} blur={2.6} opacity={0.5} far={12} />
    </group>
  );
}
