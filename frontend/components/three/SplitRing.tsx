"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";
import { tokenomics, type SplitTone } from "@/lib/site";
import {
  NVIDIA_GREEN_RGB,
  addStudioLights,
  createRenderer,
  createStudioEnvironment,
  disposeScene,
  glowPlane,
  observeSize,
  physicalGreen,
  radialGlowTexture,
  runLoop,
} from "@/lib/three/studio";

const RADIUS = 1.3;
const TUBE = 0.27;
const GAP = 0.06; // radians of daylight between segments

function materialFor(tone: SplitTone): THREE.MeshPhysicalMaterial {
  switch (tone) {
    case "accent":
      return physicalGreen();
    case "foreground":
      return new THREE.MeshPhysicalMaterial({
        color: 0xededed,
        metalness: 1,
        roughness: 0.16,
        envMapIntensity: 1.4,
      });
    default:
      return new THREE.MeshPhysicalMaterial({
        color: 0x2b2b2b,
        metalness: 0.6,
        roughness: 0.42,
        clearcoat: 0.6,
        clearcoatRoughness: 0.3,
        envMapIntensity: 1,
      });
  }
}

/** The 2% fee as a three-segment torus: 50% green, 25% chrome, 25% graphite. */
export function SplitRing() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const animate = !reduce;
    const renderer = createRenderer(canvas);
    const environment = createStudioEnvironment(renderer);

    const scene = new THREE.Scene();
    scene.environment = environment;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    camera.position.set(0, 0, 5.6);
    camera.lookAt(0, 0, 0);

    addStudioLights(scene);

    const tilt = new THREE.Group();
    tilt.rotation.x = -0.95; // lay the ring down toward the viewer
    scene.add(tilt);

    const ring = new THREE.Group();
    tilt.add(ring);

    let cursor = 0;
    for (const item of tokenomics.split) {
      const full = (item.shareOfFee / 100) * Math.PI * 2;
      const arc = Math.max(0.01, full - GAP);
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(RADIUS, TUBE, 40, 110, arc), materialFor(item.tone));
      // Segments run clockwise from the top.
      mesh.rotation.z = Math.PI / 2 - cursor - full + GAP / 2;
      ring.add(mesh);
      cursor += full;
    }

    // Kept inside the frustum so the glow fades out before the canvas edge.
    const glow = radialGlowTexture(NVIDIA_GREEN_RGB, 0.45);
    const halo = glowPlane(glow, 3.8);
    halo.position.z = -1.6;
    scene.add(halo);

    const render = (t: number) => {
      if (animate) {
        ring.rotation.z = -t * 0.12;
        tilt.rotation.x = -0.95 + Math.sin(t * 0.4) * 0.06;
        tilt.rotation.y = Math.sin(t * 0.3) * 0.08;
      }
      renderer.render(scene, camera);
    };

    const stopSize = observeSize(host, (w, h) => {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!animate) render(0);
    });
    const stopLoop = runLoop(canvas, render, animate);

    return () => {
      stopLoop();
      stopSize();
      disposeScene(scene);
      environment.dispose();
      glow.dispose();
      renderer.dispose();
    };
  }, [reduce]);

  return (
    <div ref={hostRef} className="relative aspect-square w-full">
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
    </div>
  );
}
