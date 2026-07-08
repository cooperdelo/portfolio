import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image, Html, Text } from '@react-three/drei';
import { easing } from 'maath';
import * as THREE from 'three';
import { useStore } from './store.js';
import { SECTIONS, P } from './data.js';

const SIZE = 1.15;

// One face-out record: sleeve with cover art, a black vinyl peeking above,
// a readable spine label, and a description card on hover. Click = drop needle.
function Record({ section, position }) {
  const g = useRef();
  const glow = useRef();
  const disc = useRef();
  const [hover, setHover] = useState(false);
  const dive = useStore((s) => s.dive);
  const setHovered = useStore((s) => s.setHovered);
  const phase = useStore((s) => s.phase);

  useFrame((state, dt) => {
    const lift = hover ? 0.55 : 0;
    easing.damp3(g.current.position, [position[0], position[1] + (hover ? 0.12 : 0), position[2] + lift], 0.18, dt);
    const sc = hover ? 1.06 : 1;
    easing.damp3(g.current.scale, [sc, sc, sc], 0.18, dt);
    easing.damp(glow.current.material, 'opacity', hover ? 0.4 : 0, 0.2, dt);
    if (hover) disc.current.rotation.z += dt * 1.2;
  });

  return (
    <group
      ref={g}
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); if (phase === 'idle') { setHover(true); setHovered(section.key); document.body.classList.add('hot'); } }}
      onPointerOut={() => { setHover(false); setHovered(null); document.body.classList.remove('hot'); }}
      onClick={(e) => { e.stopPropagation(); if (phase === 'idle') dive(section); }}
    >
      {/* accent glow */}
      <mesh ref={glow} position={[0, 0, -0.1]}>
        <planeGeometry args={[SIZE * 1.7, SIZE * 1.7]} />
        <meshBasicMaterial color={section.accent} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* vinyl disc peeking above the sleeve */}
      <mesh ref={disc} position={[0, SIZE * 0.34, -0.06]}>
        <cylinderGeometry args={[SIZE * 0.46, SIZE * 0.46, 0.03, 48]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.55} metalness={0.35} envMapIntensity={0.5} />
      </mesh>
      <mesh position={[0, SIZE * 0.34, -0.045]}>
        <cylinderGeometry args={[SIZE * 0.16, SIZE * 0.16, 0.032, 32]} />
        <meshStandardMaterial color={section.accent} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* sleeve */}
      <mesh castShadow>
        <boxGeometry args={[SIZE, SIZE, 0.07]} />
        <meshStandardMaterial color="#15100c" roughness={0.6} metalness={0.05} envMapIntensity={0.5} />
      </mesh>
      <Image url={P + section.cover} position={[0, 0, 0.037]} scale={[SIZE * 0.985, SIZE * 0.985]} toneMapped={false} />

      {/* spine label */}
      <Text position={[0, -SIZE * 0.62, 0.05]} fontSize={0.11} color={section.accent} anchorX="center" anchorY="middle" letterSpacing={0.14} outlineWidth={0.004} outlineColor="#000">
        {section.key}
      </Text>

      {/* description card on hover */}
      {hover && (
        <Html position={[SIZE * 0.72, 0.1, 0.1]} transform occlude distanceFactor={2.6} style={{ pointerEvents: 'none' }}>
          <div style={{
            width: 210, padding: '13px 15px', borderRadius: 12,
            background: 'linear-gradient(180deg, rgba(14,10,8,.9), rgba(14,10,8,.96))',
            backdropFilter: 'blur(18px)', border: '1px solid rgba(244,239,230,.16)', color: '#F4EFE6',
            fontFamily: 'Geist, sans-serif', borderTop: `2px solid ${section.accent}`, boxShadow: '0 24px 60px -28px #000'
          }}>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8.5, letterSpacing: '.2em', textTransform: 'uppercase', color: section.accent }}>{section.eyebrow}</div>
            <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 22, textTransform: 'uppercase', margin: '2px 0 6px' }}>{section.key}</div>
            <div style={{ fontSize: 11, lineHeight: 1.5, opacity: 0.85 }}>{section.blurb}</div>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8, letterSpacing: '.16em', textTransform: 'uppercase', color: section.accent, marginTop: 9, opacity: 0.9 }}>▶ click to drop the needle</div>
          </div>
        </Html>
      )}
    </group>
  );
}

// The face-out record display on a wooden ledge along the back wall.
export default function Records({ y = 2.7, z = -6.55 }) {
  const positions = useMemo(() => {
    const gap = 1.5;
    return SECTIONS.map((_, i) => [(i - (SECTIONS.length - 1) / 2) * gap, y, z]);
  }, [y, z]);
  return (
    <group>
      {/* wooden ledge */}
      <mesh position={[0, y - SIZE * 0.6, z - 0.15]} receiveShadow castShadow>
        <boxGeometry args={[SECTIONS.length * 1.5 + 0.6, 0.16, 0.6]} />
        <meshStandardMaterial color="#4a3018" roughness={0.7} metalness={0.05} />
      </mesh>
      {/* rust LED under the ledge */}
      <mesh position={[0, y - SIZE * 0.6 - 0.1, z + 0.12]}>
        <boxGeometry args={[SECTIONS.length * 1.5, 0.03, 0.03]} />
        <meshStandardMaterial color="#4a3520" emissive="#ff6a3a" emissiveIntensity={1.2} />
      </mesh>
      {SECTIONS.map((s, i) => (
        <Record key={s.key} section={s} position={positions[i]} />
      ))}
    </group>
  );
}
