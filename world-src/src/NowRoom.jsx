import React, { Suspense, useState, useEffect } from 'react';
import { ContactShadows, Html } from '@react-three/drei';
import { Model } from './Model.jsx';
import { Frame, Panel, Label } from './bits.jsx';
import { RoomShell } from './studio.jsx';

const ACCENT = '#8FA382';

// Live flip-clock counting down to the Truist start (clamps at 0 → "IN PROGRESS").
function Countdown({ label, target }) {
  const [t, setT] = useState(() => diff(target));
  useEffect(() => { const id = setInterval(() => setT(diff(target)), 1000); return () => clearInterval(id); }, [target]);
  function diff(tg) { const ms = new Date(tg).getTime() - Date.now(); return Math.max(0, ms); }
  const d = Math.floor(t / 864e5), h = Math.floor(t / 36e5) % 24, m = Math.floor(t / 6e4) % 60, s = Math.floor(t / 1e3) % 60;
  const cell = (v, u) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 30, background: 'rgba(244,239,230,.06)', border: '1px solid rgba(244,239,230,.14)', borderRadius: 8, padding: '6px 10px', minWidth: 52 }}>{String(v).padStart(2, '0')}</div>
      <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8, letterSpacing: '.16em', textTransform: 'uppercase', opacity: 0.5, marginTop: 4 }}>{u}</div>
    </div>
  );
  return (
    <Html position={[0, 2.9, -11.55]} transform occlude zIndexRange={[25, 0]} distanceFactor={2.6} style={{ pointerEvents: 'none' }}>
      <div style={{ width: 320, textAlign: 'center', color: '#F4EFE6', fontFamily: 'Geist, sans-serif' }}>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: ACCENT, marginBottom: 10 }}>{label}</div>
        {t > 0
          ? <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>{cell(d, 'days')}{cell(h, 'hrs')}{cell(m, 'min')}{cell(s, 'sec')}</div>
          : <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 30, color: ACCENT }}>IN PROGRESS</div>}
      </div>
    </Html>
  );
}

export default function NowRoom({ section: s }) {
  return (
    <group>
      <RoomShell halfW={10} backZ={-12} height={13} frontZ={8} accent={ACCENT} />

      <pointLight position={[0, 5, -3]} intensity={3.0} distance={20} color="#e2ecd6" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-6, 4, -4]} intensity={2.2} distance={16} color={ACCENT} />
      <pointLight position={[6, 4, -2]} intensity={1.6} distance={16} color="#ffb066" />

      <Label position={[0, 8.4, -11.6]} size={1.8} color={ACCENT} font max={24}>NOW</Label>
      <Label position={[0, 7.2, -11.6]} size={0.24} color="#F4EFE6" mono opacity={0.65} max={24}>{s.refreshed.toUpperCase()}</Label>

      {/* the desk */}
      <Suspense fallback={null}>
        <Model src="mixingdesk" fit={3.4} position={[0, 0, -9]} />
        <Model src="chair" fit={1.2} position={[0, 0, -7.2]} rotation={[0, Math.PI, 0]} />
        <Frame src="workspace_studio_desk.jpg" position={[0, 4.6, -11.7]} width={3.4} accent={ACCENT} caption="The desk" />
      </Suspense>

      {/* live countdown */}
      <Countdown label={s.countdown.label} target={s.countdown.target} />

      {/* task board — sticky notes (right) */}
      <Label position={[8, 5.4, -3]} rotation={[0, -Math.PI / 2, 0]} size={0.4} color={ACCENT} font>THE BOARD</Label>
      {s.nowList.map(([tag, item], i) => (
        <Html key={i} position={[9.7, 4.6 - i * 1.6, -3]} rotation={[0, -Math.PI / 2, 0]} transform occlude zIndexRange={[25, 0]} distanceFactor={3.0} style={{ pointerEvents: 'none' }}>
          <div style={{ width: 210, padding: '11px 13px', borderRadius: 4, background: tag === 'this wk' ? 'rgba(143,163,130,.16)' : 'rgba(244,239,230,.06)', border: `1px solid ${ACCENT}44`, color: '#F4EFE6', fontFamily: 'Geist, sans-serif', boxShadow: '0 16px 40px -22px #000', transform: 'rotate(-1.5deg)' }}>
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT }}>{tag}</span>
            <div style={{ fontSize: 12, lineHeight: 1.4, marginTop: 4 }}>{item}</div>
          </div>
        </Html>
      ))}

      {/* stats + agent note (left) */}
      <Panel position={[-9.7, 4, -3]} rotation={[0, Math.PI / 2, 0]} width={220} accent={ACCENT}>
        <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 13.5, opacity: 0.9, lineHeight: 1.4 }}>{s.lede}</div>
      </Panel>
      <Panel position={[-9.7, 2, -3]} rotation={[0, Math.PI / 2, 0]} width={220} accent={ACCENT}>
        {s.stats.map(([k, v], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderTop: i ? '1px solid rgba(244,239,230,.08)' : 'none' }}>
            <span style={{ opacity: 0.5, fontFamily: 'Geist Mono, monospace', fontSize: 9, textTransform: 'uppercase' }}>{k}</span><span>{v}</span>
          </div>
        ))}
        <div style={{ fontSize: 10, opacity: 0.55, marginTop: 8, lineHeight: 1.45, fontStyle: 'italic' }}>{s.note}</div>
      </Panel>

      <ContactShadows position={[0, 0.02, -4]} scale={38} resolution={1024} blur={2.6} opacity={0.5} far={12} />
    </group>
  );
}
