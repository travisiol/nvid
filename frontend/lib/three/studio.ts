import * as THREE from "three";

/*
  Shared three.js plumbing for the two scenes on the site. Everything here is
  painted at runtime — there is no texture, model or HDR file to load.
*/

export const NVIDIA_GREEN = 0x76b900;
export const NVIDIA_GREEN_RGB = "118, 185, 0";

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/**
 * A studio environment for reflections: a black room, two white softboxes, a
 * long thin top strip for the specular line, and a green rim strip below and
 * behind the subject so every edge picks up the brand colour.
 */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  scene.add(
    new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x030303, side: THREE.BackSide })),
  );

  const panel = (w: number, h: number, color: number, intensity: number, x: number, y: number, z: number) => {
    const material = new THREE.MeshBasicMaterial();
    material.color.set(color).multiplyScalar(intensity);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };

  panel(6, 3, 0xffffff, 7, -4, 6, 4); // key softbox, top-left-front
  panel(3, 6, 0xffffff, 2.2, 7, 1, 3); // fill, right
  panel(12, 0.5, 0xffffff, 5, 0, 8, -2); // thin strip overhead → long specular line
  panel(12, 1.2, NVIDIA_GREEN, 9, -3, -6, -4); // green rim, below-back-left
  panel(4, 1, NVIDIA_GREEN, 3, 6, -3, -5); // faint green kicker, right-back

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  disposeScene(scene);
  return target.texture;
}

/** Soft radial glow as a texture, for light spill under and behind the subject. */
export function radialGlowTexture(rgb: string, alpha: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    gradient.addColorStop(0.45, `rgba(${rgb}, ${alpha * 0.32})`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function glowPlane(texture: THREE.Texture, size: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
}

export function physicalGreen(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: NVIDIA_GREEN,
    emissive: 0x1a2e00,
    emissiveIntensity: 0.55,
    metalness: 0.25,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.5,
  });
}

export function physicalBlack(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a,
    metalness: 0.5,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.2,
  });
}

/** Key / rim / kicker lights shared by both scenes. */
export function addStudioLights(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.PointLight(NVIDIA_GREEN, 30, 14, 2);
  rim.position.set(-2.6, -2.4, -1.2);
  scene.add(rim);
  const kicker = new THREE.PointLight(0xffffff, 10, 12, 2);
  kicker.position.set(3.2, 2.4, 2.5);
  scene.add(kicker);
}

/** Calls `cb` now and on every size change of `el`. */
export function observeSize(el: HTMLElement, cb: (width: number, height: number) => void): () => void {
  const emit = () => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) cb(rect.width, rect.height);
  };
  const observer = new ResizeObserver(emit);
  observer.observe(el);
  emit();
  return () => observer.disconnect();
}

/**
 * requestAnimationFrame loop that only runs while the canvas is on screen and
 * the tab is visible. With `animate = false` it renders a single frame.
 */
export function runLoop(canvas: HTMLCanvasElement, render: (time: number, dt: number) => void, animate: boolean): () => void {
  let raf = 0;
  let running = false;
  let visible = true;
  let last = performance.now();

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    render(now / 1000, dt);
    raf = requestAnimationFrame(frame);
  };

  const sync = () => {
    const should = animate && visible && !document.hidden;
    if (should && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };

  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      sync();
    },
    { threshold: 0 },
  );
  observer.observe(canvas);
  document.addEventListener("visibilitychange", sync);

  if (!animate) render(0, 0);
  sync();

  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", sync);
    cancelAnimationFrame(raf);
    running = false;
  };
}

export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const map = (material as THREE.MeshBasicMaterial).map;
        if (map) map.dispose();
        material.dispose();
      }
    }
  });
}
