/**
 * Shared three.js scene-lifecycle scaffolding for the project's showcase-tier
 * (real 3D) visualisations — currently `RandomTrials` and `CountingStudio`.
 *
 * Both components need the same boilerplate: a renderer with a capped pixel
 * ratio, soft shadows, an ambient + directional light rig, an optional floor
 * plane, a resize-observed canvas, and a requestAnimationFrame loop that
 * pauses itself the moment nothing is moving (the cohort runs budget devices —
 * see the viz-tiers note in CLAUDE.md). `createThreeScene` builds all of that
 * once and hands back a small imperative handle; each component still owns
 * its bespoke geometry, physics/tweens, and pointer handling, built and torn
 * down inside its own `useEffect`.
 *
 * This is a plain factory function, not a React hook — it holds no React
 * state and calls no other hooks, so it can safely run inside a caller's
 * `useEffect` body (a real "use…" hook name here would trip the
 * rules-of-hooks lint rule at every call site). Both call sites treat it as
 * effect-scoped: build the scene, build bespoke content, return a cleanup
 * that calls `dispose()`.
 *
 * `three` is imported here and in the two showcase-tier viz modules only, so
 * `React.lazy` keeps it out of the initial bundle and every unit that never
 * opens a 3D viz. Do not import this module from anywhere else.
 */

import * as THREE from "three";

/** Directional-light shadow-camera frustum (an orthographic box in world units). */
export interface ShadowBounds {
  near: number;
  far: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ThreeSceneOptions {
  /** Container the canvas is appended to; also observed for resizes. */
  mount: HTMLElement;
  camera?: { fov?: number; near?: number; far?: number };
  ambient?: { intensity?: number };
  directional?: {
    intensity?: number;
    position?: [number, number, number];
    shadowMapSize?: number;
    shadowBounds?: ShadowBounds;
  };
  /** Square visual floor plane (no physics body — callers that need one add
   *  it themselves, since only `RandomTrials` uses cannon-es). Pass `null`
   *  to skip it entirely (e.g. a scene with its own custom ground). */
  floor?: {
    size: number;
    color?: number;
    roughness?: number;
    metalness?: number;
  } | null;
  /** CSS cursor for the canvas element — differs by interaction affordance
   *  ("pointer" for tap-to-throw, "grab" for click-to-place/drag-to-orbit). */
  cursor?: string;
}

/** Imperative handle returned by `createThreeScene`. */
export interface ThreeScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** The renderer's canvas — already appended to `mount`. */
  canvas: HTMLCanvasElement;
  /** Queue one or more cleanup functions (geometry/material/texture disposal)
   *  to run when `dispose()` is called. */
  addDisposer: (...fns: Array<() => void>) => void;
  /** Render the current scene state once, outside the animation loop — used
   *  after a discrete change (a reset, a placed tile) that doesn't need the
   *  loop to keep running. */
  renderOnce: () => void;
  /**
   * Registers the per-frame update. The loop calls `fn(deltaMs)` once per
   * frame — `deltaMs` is the real elapsed time since the previous frame (0 on
   * the first frame after a resume), so tweens and physics can advance by
   * actual elapsed time rather than assuming a fixed refresh rate. Returning
   * `true` keeps the loop running for another frame; `false` lets it go idle
   * after this frame renders.
   */
  setOnFrame: (fn: (deltaMs: number) => boolean) => void;
  /** Wake the render loop if it has gone idle. Safe to call repeatedly. */
  ensureLoop: () => void;
  /** Full teardown: disconnects the resize observer, cancels any pending
   *  frame, runs every queued disposer, disposes the renderer, and removes
   *  the canvas from `mount`. Call once from the owning effect's cleanup. */
  dispose: () => void;
}

/**
 * Builds a renderer + scene + camera + light rig + (optional) floor, wired
 * up to a self-pausing RAF loop and a resize observer. See the file header
 * for why this is a factory, not a hook.
 */
export function createThreeScene(options: ThreeSceneOptions): ThreeScene {
  const { mount } = options;

  let width = mount.clientWidth || 400;
  let height = mount.clientHeight || 240;

  // alpha: true lets the container's own CSS background/gradient show through.
  // Pixel ratio capped at 2 so high-DPI phones don't render a punishing 3×
  // buffer — see the viz-tiers note in CLAUDE.md.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // soft by default in modern three
  const canvas = renderer.domElement;
  canvas.style.touchAction = "none"; // let Pointer Events own touch gestures
  canvas.style.cursor = options.cursor ?? "default";
  mount.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    options.camera?.fov ?? 45,
    width / height,
    options.camera?.near ?? 0.1,
    options.camera?.far ?? 200,
  );

  scene.add(new THREE.AmbientLight(0xffffff, options.ambient?.intensity ?? 1.7));

  if (options.directional) {
    const d = options.directional;
    const dirLight = new THREE.DirectionalLight(0xffffff, d.intensity ?? 2.4);
    dirLight.position.set(...(d.position ?? [6, 14, 6]));
    dirLight.castShadow = true;
    const mapSize = d.shadowMapSize ?? 512;
    dirLight.shadow.mapSize.set(mapSize, mapSize);
    if (d.shadowBounds) {
      const b = d.shadowBounds;
      dirLight.shadow.camera.near = b.near;
      dirLight.shadow.camera.far = b.far;
      dirLight.shadow.camera.left = b.left;
      dirLight.shadow.camera.right = b.right;
      dirLight.shadow.camera.top = b.top;
      dirLight.shadow.camera.bottom = b.bottom;
    }
    scene.add(dirLight);
  }

  // Disposal closures collected as bespoke objects are built; run on cleanup.
  const disposers: Array<() => void> = [];
  function addDisposer(...fns: Array<() => void>) {
    disposers.push(...fns);
  }

  if (options.floor) {
    const { size, color = 0x1e293b, roughness = 0.95, metalness = 0.05 } = options.floor;
    const floorGeom = new THREE.PlaneGeometry(size, size);
    const floorMat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const floorMesh = new THREE.Mesh(floorGeom, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
    addDisposer(() => floorGeom.dispose(), () => floorMat.dispose());
  }

  function renderOnce() {
    renderer.render(scene, camera);
  }

  // --- Animation loop: runs only while `onFrame` reports motion ---
  let rafId = 0;
  let running = false;
  let lastTime = 0;
  let onFrame: ((deltaMs: number) => boolean) | null = null;

  function frame(now: number) {
    rafId = 0;
    // First frame after a (re)start has no valid previous timestamp — treat
    // it as zero elapsed time rather than a huge jump from a stale `lastTime`.
    const deltaMs = lastTime === 0 ? 0 : now - lastTime;
    lastTime = now;
    const keepGoing = onFrame ? onFrame(deltaMs) : false;
    renderOnce();
    if (keepGoing) {
      rafId = requestAnimationFrame(frame);
    } else {
      running = false;
      lastTime = 0; // next ensureLoop() starts a fresh delta sequence
    }
  }

  function ensureLoop() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  function setOnFrame(fn: (deltaMs: number) => boolean) {
    onFrame = fn;
  }

  // Keep the renderer and camera matched to the panel's size. Falls back to
  // the last known size if the container briefly reports zero (e.g. mid
  // layout pass) so the scene never collapses to nothing.
  const resizeObserver = new ResizeObserver(() => {
    const w = mount.clientWidth || width;
    const h = mount.clientHeight || height;
    if (w === 0 || h === 0) return;
    width = w;
    height = h;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderOnce();
  });
  resizeObserver.observe(mount);

  function dispose() {
    resizeObserver.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    disposers.forEach((fn) => fn());
    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  return {
    scene,
    camera,
    renderer,
    canvas,
    addDisposer,
    renderOnce,
    setOnFrame,
    ensureLoop,
    dispose,
  };
}
