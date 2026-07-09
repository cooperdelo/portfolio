import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import * as THREE from 'three';
import { useStore } from './store.js';

// Camera anchors per scene. { p: position, l: lookAt }
const ANCHORS = {
  drop: { p: [-0.6, 1.6, -1.2], l: [-1.0, 1.25, -4.0] }    // pushed toward the turntable
};
// Hub POV: face the record wall, or turn to the window (left) / shelf (right).
const HUB_VIEWS = {
  front: { p: [0, 2.7, 7.6], l: [0, 1.9, -3.8] },
  left: { p: [4.2, 2.9, 1.8], l: [-10.7, 3.2, -1.5] },
  right: { p: [-4.2, 2.9, 1.8], l: [10.7, 3.2, -1.5] }
};
// Room POV: click to face the stage (front) or turn to the side walls.
const ROOM_VIEWS = {
  front: { p: [0, 2.1, 7.0], l: [0, 2.6, -7] },
  left: { p: [3.4, 3.0, 1.5], l: [-11, 3.4, -3] },
  right: { p: [-3.4, 3.0, 1.5], l: [11, 3.4, -3] }
};

export default function CameraRig() {
  const { camera, gl } = useThree();
  const phase = useStore((s) => s.phase);
  const shown = useStore((s) => s.shown);
  const roomView = useStore((s) => s.roomView);
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

  // reset drag offsets when entering/leaving rooms or switching wall view
  useEffect(() => { drag.current.tyaw = 0; drag.current.tpitch = 0; drag.current.dolly = 0; }, [shown, roomView]);

  // widen FOV on narrow (portrait / mobile) viewports so rooms don't feel cropped
  const size = useThree((s) => s.size);
  useEffect(() => {
    camera.fov = size.width / size.height < 0.8 ? 68 : size.width / size.height < 1.1 ? 60 : 52;
    camera.updateProjectionMatrix();
  }, [size, camera]);

  useFrame((_, dt) => {
    const d = drag.current;
    d.yaw = THREE.MathUtils.damp(d.yaw, d.tyaw, 4, dt);
    d.pitch = THREE.MathUtils.damp(d.pitch, d.tpitch, 4, dt);

    let a = shown === 'hub'
      ? (HUB_VIEWS[roomView] || HUB_VIEWS.front)
      : (ROOM_VIEWS[roomView] || ROOM_VIEWS.front);
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
