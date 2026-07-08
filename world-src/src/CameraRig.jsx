import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import * as THREE from 'three';
import { useStore } from './store.js';

// Camera anchors per scene. { p: position, l: lookAt }
const ANCHORS = {
  hub: { p: [0, 2.7, 7.6], l: [0, 1.9, -3.8] },
  drop: { p: [-0.4, 1.7, -1.4], l: [-1.0, 1.2, -4.0] },   // pushed toward the turntable
  room: { p: [0, 1.75, 7.2], l: [0, 1.6, -3.2] }
};

export default function CameraRig() {
  const { camera, gl } = useThree();
  const phase = useStore((s) => s.phase);
  const shown = useStore((s) => s.shown);
  const drag = useRef({ on: false, lx: 0, ly: 0, yaw: 0, pitch: 0, tyaw: 0, tpitch: 0, dolly: 0 });
  const tmpP = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3(0, 1.8, -3));

  useEffect(() => {
    const el = gl.domElement;
    const down = (e) => { drag.current.on = true; drag.current.lx = e.clientX; drag.current.ly = e.clientY; };
    const up = () => { drag.current.on = false; };
    const move = (e) => {
      const d = drag.current; if (!d.on) return;
      d.tyaw = THREE.MathUtils.clamp(d.tyaw + (e.clientX - d.lx) * 0.004, -0.7, 0.7);
      d.tpitch = THREE.MathUtils.clamp(d.tpitch - (e.clientY - d.ly) * 0.003, -0.25, 0.35);
      d.lx = e.clientX; d.ly = e.clientY;
    };
    const wheel = (e) => { drag.current.dolly = THREE.MathUtils.clamp(drag.current.dolly + e.deltaY * 0.0011, -1, 1.6); };
    el.addEventListener('pointerdown', down); addEventListener('pointerup', up);
    addEventListener('pointermove', move); addEventListener('wheel', wheel, { passive: true });
    return () => { el.removeEventListener('pointerdown', down); removeEventListener('pointerup', up); removeEventListener('pointermove', move); removeEventListener('wheel', wheel); };
  }, [gl]);

  // reset drag offsets when entering/leaving rooms
  useEffect(() => { drag.current.tyaw = 0; drag.current.tpitch = 0; drag.current.dolly = 0; }, [shown]);

  useFrame((_, dt) => {
    const d = drag.current;
    d.yaw = THREE.MathUtils.damp(d.yaw, d.tyaw, 4, dt);
    d.pitch = THREE.MathUtils.damp(d.pitch, d.tpitch, 4, dt);

    let a = shown === 'hub' ? ANCHORS.hub : ANCHORS.room;
    if (phase === 'dropping') a = ANCHORS.drop;

    // apply orbit offsets
    const p = tmpP.current.set(a.p[0], a.p[1], a.p[2]);
    p.x += d.yaw * 3.2;
    p.y += d.pitch * 2.4;
    p.z -= d.dolly * 2.2;

    const speed = phase === 'dropping' || phase === 'returning' ? 2.2 : 3.2;
    easing.damp3(camera.position, [p.x, p.y, p.z], 1 / speed, dt);
    easing.damp3(look.current, a.l, 1 / speed, dt);
    camera.lookAt(look.current);
  });
  return null;
}
