import React, { Suspense } from 'react';
import { Environment } from '@react-three/drei';
import { useStore } from './store.js';
import Hub from './Hub.jsx';
import CameraRig from './CameraRig.jsx';
import { ActiveRoom, Timers } from './Rooms.jsx';

export default function Stage() {
  const shown = useStore((s) => s.shown);
  return (
    <>
      <CameraRig />
      <Timers />

      {shown === 'hub' ? (
        <>
          <Environment preset="apartment" environmentIntensity={0.55} />
          <ambientLight intensity={0.7} color="#4a3626" />
          <hemisphereLight intensity={0.55} color="#6a5238" groundColor="#241811" />
          <spotLight position={[2, 9, 2]} angle={0.7} penumbra={0.9} intensity={60} distance={30} color="#ffc188" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
          <pointLight position={[-7, 3, 4]} intensity={0.7} distance={26} color="#ff945a" />
          <pointLight position={[7, 1, 4]} intensity={0.5} distance={24} color="#FF4D2E" />
          <directionalLight position={[-4, 6, -8]} intensity={0.3} color="#9ab4ff" />
          <Suspense fallback={null}><Hub /></Suspense>
        </>
      ) : (
        <Suspense fallback={null}><ActiveRoom /></Suspense>
      )}
    </>
  );
}
