"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useReducedMotion } from "framer-motion";
import { VaultRing } from "@/components/VaultRing";
import { CUSTOM_EMBLEM_PATH, emblemOutline } from "@/lib/emblem";
import {
  NVIDIA_GREEN_RGB,
  addStudioLights,
  createRenderer,
  createStudioEnvironment,
  disposeScene,
  glowPlane,
  observeSize,
  physicalBlack,
  physicalGreen,
  radialGlowTexture,
  runLoop,
} from "@/lib/three/studio";
import { supportsWebGL } from "@/lib/three/support";
import { cn } from "@/lib/utils";

const SLAB = { size: 3, depth: 0.24, radius: 0.34 };
const EMBLEM = { depth: 0.16, bevel: 0.035, span: 2.2 };
const REST = { x: -0.22, y: -0.42 };

async function emblemShapes(): Promise<THREE.Shape[]> {
  if (CUSTOM_EMBLEM_PATH) {
    const { SVGLoader } = await import("three/examples/jsm/loaders/SVGLoader.js");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${CUSTOM_EMBLEM_PATH}"/></svg>`;
    return new SVGLoader().parse(svg).paths.flatMap((path) => SVGLoader.createShapes(path));
  }
  return [new THREE.Shape(emblemOutline().map(([x, y]) => new THREE.Vector2(x, y)))];
}

/**
 * The hero object: a black clearcoat slab carrying the green emblem, lit by a
 * painted studio environment, floating and tilting toward the pointer.
 * Falls back to the CSS VaultRing where WebGL is unavailable.
 */
export function EyeHero({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setSupported(supportsWebGL());
  }, []);

  useEffect(() => {
    if (!supported) return;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const animate = !reduce;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const shapes = await emblemShapes();
      if (disposed) return;

      const renderer = createRenderer(canvas);
      const environment = createStudioEnvironment(renderer);

      const scene = new THREE.Scene();
      scene.environment = environment;

      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
      camera.position.set(0, 1, 6.9);
      camera.lookAt(0, -0.15, 0);

      addStudioLights(scene);

      const group = new THREE.Group();
      group.rotation.set(REST.x, REST.y, 0);
      scene.add(group);

      // Slab
      const slab = new THREE.Mesh(new RoundedBoxGeometry(SLAB.size, SLAB.size, SLAB.depth, 7, SLAB.radius), physicalBlack());
      group.add(slab);

      // Emblem
      const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: EMBLEM.depth,
        bevelEnabled: true,
        bevelThickness: EMBLEM.bevel,
        bevelSize: EMBLEM.bevel * 0.85,
        bevelSegments: 5,
        curveSegments: 10,
      });
      geometry.center();
      geometry.computeBoundingBox();
      const box = geometry.boundingBox as THREE.Box3;
      const scale = EMBLEM.span / Math.max(box.max.x - box.min.x, box.max.y - box.min.y);
      const emblem = new THREE.Mesh(geometry, physicalGreen());
      emblem.scale.set(scale, CUSTOM_EMBLEM_PATH ? -scale : scale, scale);
      emblem.position.z = SLAB.depth / 2 + ((EMBLEM.depth + EMBLEM.bevel * 2) / 2) * scale;
      group.add(emblem);

      // Light spill: an ellipse on the floor and a halo behind the slab
      // Both planes stay inside the camera frustum so the glow fades to nothing
      // before the canvas edge instead of being clipped into a rectangle.
      const glow = radialGlowTexture(NVIDIA_GREEN_RGB, 0.55);
      const floor = glowPlane(glow, 4);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0.1, -1.95, 0.2);
      scene.add(floor);
      const halo = glowPlane(glow, 4.6);
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.4;
      halo.position.z = -1.8;
      scene.add(halo);

      // Pointer parallax, normalised to the viewport
      const pointer = new THREE.Vector2();
      const onMove = (event: PointerEvent) => {
        pointer.set((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const render = (t: number) => {
        if (animate) {
          const targetY = REST.y + pointer.x * 0.28 + Math.sin(t * 0.35) * 0.16;
          const targetX = REST.x - pointer.y * 0.18 + Math.sin(t * 0.5 + 1) * 0.04;
          group.rotation.y += (targetY - group.rotation.y) * 0.04;
          group.rotation.x += (targetX - group.rotation.x) * 0.04;
          group.position.y = Math.sin(t * 0.6) * 0.06;
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

      cleanup = () => {
        stopLoop();
        stopSize();
        window.removeEventListener("pointermove", onMove);
        disposeScene(scene);
        environment.dispose();
        glow.dispose();
        renderer.dispose();
      };
    })().catch((error: unknown) => {
      console.error("EyeHero failed to initialise", error);
      setSupported(false);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [supported, reduce]);

  if (supported === false) return <VaultRing />;

  return (
    <div ref={hostRef} className={cn("relative mx-auto aspect-square w-full max-w-[560px]", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
    </div>
  );
}
