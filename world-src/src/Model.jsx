import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const base = import.meta.env.BASE_URL; // '/world/'
export const MODELS = {
  turntable: base + 'models/turntable.glb',
  bass: base + 'models/bass.glb',
  electric: base + 'models/electric.glb',
  acoustic: base + 'models/acoustic.glb',
  amp: base + 'models/amp.glb',
  drums: base + 'models/drums.glb',
  monitor: base + 'models/monitor.glb',
  mixingdesk: base + 'models/mixingdesk.glb',
  chair: base + 'models/chair.glb',
  lamp: base + 'models/lamp.glb',
  mic: base + 'models/mic.glb',
  camera: base + 'models/camera.glb',
  golfclub: base + 'models/golfclub.glb',
  dumbbell: base + 'models/dumbbell.glb',
  plant: base + 'models/plant.glb',
  sofa: base + 'models/sofa.glb',
  coffeetable: base + 'models/coffeetable.glb'
};

Object.values(MODELS).forEach((u) => useGLTF.preload(u));

// Loads a GLB, centers it on its base (feet on the floor), normalizes so its
// largest dimension == `fit`, and applies shadows + optional emissive tint.
// This makes wildly-scaled Poly Pizza assets placeable with predictable size.
export function Model({ src, fit = 1, position = [0, 0, 0], rotation = [0, 0, 0], onFloor = true, envIntensity = 0.8, cast = true, receive = false, dim = 1, ...props }) {
  const url = MODELS[src] || src;
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const obj = scene.clone(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = fit / maxDim;
    // recenter to origin, then rest on floor (y=0) if requested
    obj.position.set(-center.x, -center.y, -center.z);
    if (onFloor) obj.position.y += size.y / 2;
    const wrap = new THREE.Group();
    wrap.add(obj);
    wrap.scale.setScalar(s);
    wrap.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = cast; o.receiveShadow = receive;
        if (o.material) {
          o.material = o.material.clone();
          o.material.envMapIntensity = envIntensity;
          if (dim !== 1 && o.material.color) o.material.color.multiplyScalar(dim); // tame blown-out light plastics
        }
      }
    });
    return wrap;
  }, [scene, fit, onFloor, cast, receive, envIntensity, dim]);
  return <primitive object={cloned} position={position} rotation={rotation} {...props} />;
}
