import React, { Suspense } from 'react';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Model } from './Model.jsx';
import { Frame } from './bits.jsx';
import Records from './Records.jsx';

// Warm wood-ish wall/floor material helpers
const wall = <meshStandardMaterial color="#3a2a1c" roughness={0.9} metalness={0.02} envMapIntensity={0.4} />;

// Procedural near-field studio monitor (reliable look; the GLB rendered poorly).
function Monitor({ position, rotation }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow><boxGeometry args={[0.5, 0.72, 0.44]} /><meshStandardMaterial color="#17130f" roughness={0.6} envMapIntensity={0.5} /></mesh>
      <mesh position={[0, -0.11, 0.23]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.05, 32]} /><meshStandardMaterial color="#0b0b0b" roughness={0.5} metalness={0.3} /></mesh>
      <mesh position={[0, -0.11, 0.255]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.11, 0.11, 0.02, 32]} /><meshStandardMaterial color="#050505" roughness={0.9} /></mesh>
      <mesh position={[0, 0.2, 0.23]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 0.05, 24]} /><meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[0, 0.28, 0.225]}><planeGeometry args={[0.14, 0.03]} /><meshStandardMaterial color="#ff6a3a" emissive="#ff6a3a" emissiveIntensity={1.4} /></mesh>
    </group>
  );
}

// The Control Room — the hub you land in. Real models, dressed like a studio.
export default function Hub() {
  return (
    <group>
      {/* ---- room shell ---- */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#1a120c" roughness={0.96} metalness={0.04} envMapIntensity={0.3} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1]}>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#2a1513" roughness={0.98} />
      </mesh>
      {/* back wall */}
      <mesh receiveShadow position={[0, 4, -7]}>
        <boxGeometry args={[24, 12, 0.4]} />{wall}
      </mesh>
      {/* side walls */}
      <mesh receiveShadow position={[-11, 4, -1]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 12, 0.4]} />{wall}
      </mesh>
      <mesh receiveShadow position={[11, 4, -1]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 12, 0.4]} />{wall}
      </mesh>
      {/* acoustic panels on back wall */}
      {[-6.5, -4.3, 4.3, 6.5].map((x) => (
        <mesh key={x} position={[x, 5.2, -6.78]}>
          <boxGeometry args={[1.7, 3.4, 0.14]} />
          <meshStandardMaterial color="#241a12" roughness={1} />
        </mesh>
      ))}

      <Suspense fallback={null}>
        {/* ---- the desk + turntable + monitors ---- */}
        <Model src="mixingdesk" fit={3.4} position={[0, 0, -4.2]} rotation={[0, 0, 0]} envIntensity={0.9} />
        <Model src="turntable" fit={1.15} position={[-1.0, 1.15, -4.0]} rotation={[0, 0.3, 0]} envIntensity={1.1} />
        <Monitor position={[2.3, 1.5, -4.2]} rotation={[0, -0.4, 0]} />
        <Monitor position={[-3.2, 1.5, -4.2]} rotation={[0, 0.4, 0]} />
        <Model src="chair" fit={1.15} position={[0, 0, -2.4]} rotation={[0, Math.PI, 0]} />
        <Model src="mic" fit={1.7} position={[1.2, 0, -3.2]} rotation={[0, -0.3, 0]} cast />

        {/* ---- the guitars on stands (left) — clickable to Music ---- */}
        <group position={[-6.2, 0, -3]}>
          <Model src="bass" fit={1.7} position={[0, 0, 0]} rotation={[0, 0.5, 0.06]} />
          <Model src="electric" fit={1.5} position={[1.1, 0, 0.5]} rotation={[0, 0.9, -0.05]} />
          <Model src="acoustic" fit={1.6} position={[-1.0, 0, 0.4]} rotation={[0, 0.2, 0.05]} />
        </group>
        {/* amps */}
        <Model src="amp" fit={1.1} position={[-8.2, 0, -1.2]} rotation={[0, 0.6, 0]} />

        {/* ---- drums (right corner) ---- */}
        <Model src="drums" fit={2.4} position={[6.4, 0, -3.6]} rotation={[0, -0.7, 0]} />

        {/* ---- ambience ---- */}
        <Model src="lamp" fit={2.6} position={[-9.2, 0, 2.2]} rotation={[0, 0, 0]} envIntensity={1.2} />
        <Model src="plant" fit={1.6} position={[8.8, 0, 1.6]} />
        <pointLight position={[-9.2, 2.4, 2.2]} intensity={1.2} distance={9} color="#ffb066" />

        {/* ---- side-wall archive frames ---- */}
        {[['gig_rubber_big_stage_1.jpg', -3], ['thailand_trip_wat_arun.jpg', -0.2], ['concert_pearl_jam_may2025.jpg', 2.6]].map(([p, z], i) => (
          <Frame key={i} src={p} position={[-10.7, 3, z]} rotation={[0, Math.PI / 2, 0]} width={2.0} />
        ))}
        {[['Plugverse_picture.jpeg', -3], ['golf_swing_finish.jpg', -0.2], ['cooper_tux_with_canon.jpg', 2.6]].map(([p, z], i) => (
          <Frame key={i} src={p} position={[10.7, 3, z]} rotation={[0, -Math.PI / 2, 0]} width={2.0} />
        ))}
      </Suspense>

      {/* the face-out record display on the back wall */}
      <Records y={2.75} z={-6.5} />

      {/* consistent soft contact shadows under everything (fixes the inconsistent-shadow look) */}
      <ContactShadows position={[0, 0.02, -3]} scale={30} resolution={1024} blur={2.6} opacity={0.55} far={9} color="#000000" />
    </group>
  );
}
