import React, { Suspense } from 'react';
import { Environment, OrbitControls } from '@react-three/drei';
import Hub from './Hub.jsx';

export default function Stage() {
  return (
    <>
      <Environment preset="apartment" environmentIntensity={0.55} />
      <ambientLight intensity={0.7} color="#4a3626" />
      <hemisphereLight intensity={0.55} color="#6a5238" groundColor="#241811" />
      {/* warm key from above the desk */}
      <spotLight position={[2, 9, 2]} target-position={[0, 0, -4]} angle={0.7} penumbra={0.9} intensity={60} distance={30} color="#ffc188" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <pointLight position={[-7, 3, 4]} intensity={0.7} distance={26} color="#ff945a" />
      <pointLight position={[7, 1, 4]} intensity={0.5} distance={24} color="#FF4D2E" />
      <directionalLight position={[-4, 6, -8]} intensity={0.3} color="#9ab4ff" />

      <Suspense fallback={null}>
        <Hub />
      </Suspense>

      <OrbitControls target={[0, 1.4, -4]} maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={16} />
    </>
  );
}
