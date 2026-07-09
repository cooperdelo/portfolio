import React, { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, BakeShadows } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette, SMAA } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { useStore } from './store.js';
import HUD from './HUD.jsx';
import Stage from './Stage.jsx';

export default function App() {
  const setReady = useStore((s) => s.setReady);
  useEffect(() => { const t = setTimeout(() => setReady(true), 1400); return () => clearTimeout(t); }, [setReady]);

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.35 }}
        camera={{ position: [0, 2.6, 7.5], fov: 52, near: 0.1, far: 200 }}
      >
        <color attach="background" args={['#0b0806']} />
        <fogExp2 attach="fog" args={['#140d09', 0.012]} />
        <Suspense fallback={null}>
          <Stage />
        </Suspense>
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.72} luminanceSmoothing={0.85} />
          <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.0009, 0.0009]} radialModulation modulationOffset={0.3} />
          <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.32} />
          <Vignette eskil={false} offset={0.28} darkness={0.72} />
          <SMAA />
        </EffectComposer>
        <AdaptiveDpr pixelated />
      </Canvas>
      <HUD />
    </>
  );
}
