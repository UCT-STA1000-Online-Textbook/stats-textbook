/**
 * 3D "random trials" simulator — the project's showcase-tier visualisation for
 * the law of large numbers (true 3D physics; see the viz tiers note in
 * CLAUDE.md).
 *
 * Students pick an experiment — rolling a fair die or flipping a fair coin —
 * then drag-throw the object for a real, physically-simulated trial, or use the
 * "Simulate" buttons to fast-forward many trials. A bar chart of the observed
 * relative frequency per outcome is drawn with Observable Plot, with a dashed
 * line at the theoretical probability (1/6 for the die, 1/2 for the coin). As
 * the number of trials grows the bars converge on that line — which is exactly
 * Pr(A) = lim r/n.
 *
 * Three.js and cannon-es are imported here and nowhere else, so `React.lazy` in
 * `VizRegistry` keeps both libraries out of the initial bundle and out of every
 * unit that doesn't open this viz.
 *
 * All GPU/physics objects are created inside the scene `useEffect` and disposed
 * on unmount or experiment change — `VizPanel` remounts the viz on every
 * `<TryThis>` click, and switching experiment tears down and rebuilds the
 * scene. Trial data lives in React state, and the render loop pauses once the
 * object has settled.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { VizGuide } from "../VizGuide";
import * as Plot from "@observablehq/plot";
import type { VizParams } from "@/store/vizStore";

type Experiment = "die" | "coin";

/** Theoretical probability of any single outcome, per experiment. */
const THEORETICAL: Record<Experiment, number> = { die: 1 / 6, coin: 1 / 2 };

// --- Shared scene geometry (world units) ---
const TRAY = 12; // floor is TRAY × TRAY
const HALF_TRAY = TRAY / 2;
const WALL_H = 5;
const LIFT_Y = 3; // object-centre height while being dragged

// --- Die ---
const DIE = 2.4; // edge length
const HALF_DIE = DIE / 2;

// --- Coin ---
const COIN_R = 1.7; // visual radius
const COIN_T = 0.4; // thickness
/** Half-extent of the coin's (square slab) physics shape — kept inside the
 *  visual disc so a tumbling coin doesn't appear to balance on a corner. */
const COIN_HALF = COIN_R * 0.8;

/** Outcome labels for a given experiment, in bar-chart / tally order. */
function labelsFor(exp: Experiment): string[] {
  return exp === "coin" ? ["Heads", "Tails"] : ["1", "2", "3", "4", "5", "6"];
}

/**
 * Draws one die face (1–6 pips) onto an offscreen canvas — the pip layout is
 * generated procedurally so the die needs no external texture assets.
 */
function createDieFace(pips: number): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#f8fafc"; // bone white
  ctx.fillRect(0, 0, size, size);
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#e2e8f0";
  ctx.strokeRect(5, 5, size - 10, size - 10);

  ctx.fillStyle = "#991b1b"; // deep red
  const r = 26;
  const c = size / 2;
  const o = size / 4;
  const dot = (x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  if (pips % 2 === 1) dot(c, c); // 1, 3, 5 share a centre pip
  if (pips >= 2) {
    dot(c - o, c - o);
    dot(c + o, c + o);
  }
  if (pips >= 4) {
    dot(c + o, c - o);
    dot(c - o, c + o);
  }
  if (pips === 6) {
    dot(c - o, c);
    dot(c + o, c);
  }
  return canvas;
}

/**
 * Draws one coin face — a gold disc with a single letter ("H" / "T"). Only the
 * inscribed circle is sampled by the cylinder-cap UVs, so the disc fills it.
 */
function createCoinFace(letter: string): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#e8b923"; // gold
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#b8860b"; // darker ring
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 22, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#6b4e09";
  ctx.font = "bold 150px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, size / 2, size / 2 + 8);
  return canvas;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Interactive 3D die / coin simulator.
 *
 * @param params.experiment — initial experiment, "coin" (default) or "die".
 *   Students switch between the two at any time with the in-viz toggle.
 */
export default function RandomTrials({ params }: { params: VizParams }) {
  // Default to the coin — the prompt that opens this viz sits in WU2's
  // coin-toss discussion of relative frequency. The toggle covers the die.
  const initialExp: Experiment = params.experiment === "die" ? "die" : "coin";
  const [experiment, setExperiment] = useState<Experiment>(initialExp);

  // Per-outcome tally (die: 6 entries, coin: 2). Starts empty so the student
  // builds the distribution from their own trials.
  const [counts, setCounts] = useState<number[]>(() =>
    Array(initialExp === "coin" ? 2 : 6).fill(0),
  );
  /** Label of the most recent manual (physics) trial; null after a reset. */
  const [lastRoll, setLastRoll] = useState<string | null>(null);

  const mountRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  /** Imperative handle the control buttons use to poke the physics world. */
  const apiRef = useRef<{ spin: () => void; reset: () => void } | null>(null);

  // --- Three.js + cannon-es scene. Rebuilt whenever the experiment changes;
  //     fully torn down on unmount. ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const isCoin = experiment === "coin";

    let width = mount.clientWidth || 400;
    let height = mount.clientHeight || 240;

    // Renderer — alpha so the container's CSS gradient shows through; pixel
    // ratio capped at 2 so high-DPI phones don't render a punishing 3× buffer.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // soft by default in modern three
    const canvas = renderer.domElement;
    canvas.style.touchAction = "none"; // let Pointer Events own touch gestures
    canvas.style.cursor = "grab";
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(0, 12, 9.5);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.6);
    dirLight.position.set(6, 14, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(512, 512);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 40;
    dirLight.shadow.camera.left = -8;
    dirLight.shadow.camera.right = 8;
    dirLight.shadow.camera.top = 8;
    dirLight.shadow.camera.bottom = -8;
    scene.add(dirLight);

    // Physics world. Heavy gravity keeps trials snappy in the small viewport.
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -45, 0) });
    world.broadphase = new CANNON.NaiveBroadphase();
    (world.solver as CANNON.GSSolver).iterations = 18;

    const objMat = new CANNON.Material("object");
    const trayMat = new CANNON.Material("tray");
    world.addContactMaterial(
      new CANNON.ContactMaterial(objMat, trayMat, {
        friction: 0.35,
        restitution: 0.3,
      }),
    );

    // Disposal closures collected as objects are built; run on cleanup.
    const disposeFns: Array<() => void> = [];

    // Floor: infinite physics plane + a felt-coloured visual quad.
    const floorBody = new CANNON.Body({
      mass: 0,
      material: trayMat,
      shape: new CANNON.Plane(),
    });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floorBody);

    const floorGeom = new THREE.PlaneGeometry(TRAY, TRAY);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.95,
      metalness: 0.05,
    });
    const floorMesh = new THREE.Mesh(floorGeom, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
    disposeFns.push(() => floorGeom.dispose(), () => floorMat.dispose());

    // Four invisible physics walls keep the object inside the camera's view.
    const addWall = (x: number, z: number, ry: number) => {
      const body = new CANNON.Body({
        mass: 0,
        material: trayMat,
        shape: new CANNON.Box(new CANNON.Vec3(HALF_TRAY, WALL_H / 2, 0.5)),
        position: new CANNON.Vec3(x, WALL_H / 2, z),
      });
      body.quaternion.setFromEuler(0, ry, 0);
      world.addBody(body);
    };
    addWall(0, -HALF_TRAY, 0);
    addWall(0, HALF_TRAY, 0);
    addWall(-HALF_TRAY, 0, Math.PI / 2);
    addWall(HALF_TRAY, 0, Math.PI / 2);

    // --- The thrown object: a die or a coin ---
    const restY = isCoin ? COIN_T / 2 + 0.001 : HALF_DIE + 0.001;
    const span = isCoin ? COIN_R : HALF_DIE;
    const dragBound = HALF_TRAY - span - 0.15;

    let objMesh: THREE.Mesh;
    /** Local axes paired with the outcome index they represent when up. */
    let faceAxes: Array<{ v: CANNON.Vec3; outcome: number }>;

    if (isCoin) {
      const headsTex = new THREE.CanvasTexture(createCoinFace("H"));
      const tailsTex = new THREE.CanvasTexture(createCoinFace("T"));
      [headsTex, tailsTex].forEach((t) => (t.colorSpace = THREE.SRGBColorSpace));
      // CylinderGeometry material order: side, +Y cap, -Y cap.
      const coinMats = [
        new THREE.MeshStandardMaterial({
          color: 0xc99a18,
          roughness: 0.4,
          metalness: 0.55,
        }),
        new THREE.MeshStandardMaterial({ map: headsTex, roughness: 0.45 }),
        new THREE.MeshStandardMaterial({ map: tailsTex, roughness: 0.45 }),
      ];
      const coinGeom = new THREE.CylinderGeometry(
        COIN_R,
        COIN_R,
        COIN_T,
        48,
      );
      objMesh = new THREE.Mesh(coinGeom, coinMats);
      disposeFns.push(
        () => coinGeom.dispose(),
        ...coinMats.map((m) => () => {
          m.map?.dispose();
          m.dispose();
        }),
      );
      // Heads is the +Y cap, Tails the −Y cap.
      faceAxes = [
        { v: new CANNON.Vec3(0, 1, 0), outcome: 0 },
        { v: new CANNON.Vec3(0, -1, 0), outcome: 1 },
      ];
    } else {
      const texByPips: THREE.CanvasTexture[] = [];
      for (let n = 1; n <= 6; n++) {
        const tex = new THREE.CanvasTexture(createDieFace(n));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        texByPips.push(tex);
      }
      // BoxGeometry material order is +X, −X, +Y, −Y, +Z, −Z. Faces are mapped
      // so opposite sides sum to 7; `faceAxes` below uses the same mapping.
      const faceForSlot = [1, 6, 2, 5, 3, 4];
      const dieMats = faceForSlot.map(
        (pips) =>
          new THREE.MeshStandardMaterial({
            map: texByPips[pips - 1],
            roughness: 0.45,
            metalness: 0.05,
          }),
      );
      const dieGeom = new THREE.BoxGeometry(DIE, DIE, DIE);
      objMesh = new THREE.Mesh(dieGeom, dieMats);
      disposeFns.push(
        () => dieGeom.dispose(),
        ...dieMats.map((m) => () => {
          m.map?.dispose();
          m.dispose();
        }),
      );
      // outcome index = face value − 1.
      faceAxes = [
        { v: new CANNON.Vec3(1, 0, 0), outcome: 0 },
        { v: new CANNON.Vec3(-1, 0, 0), outcome: 5 },
        { v: new CANNON.Vec3(0, 1, 0), outcome: 1 },
        { v: new CANNON.Vec3(0, -1, 0), outcome: 4 },
        { v: new CANNON.Vec3(0, 0, 1), outcome: 2 },
        { v: new CANNON.Vec3(0, 0, -1), outcome: 3 },
      ];
    }
    objMesh.castShadow = true;
    scene.add(objMesh);

    const objBody = new CANNON.Body({
      mass: 1,
      material: objMat,
      shape: isCoin
        ? new CANNON.Box(new CANNON.Vec3(COIN_HALF, COIN_T / 2, COIN_HALF))
        : new CANNON.Box(new CANNON.Vec3(HALF_DIE, HALF_DIE, HALF_DIE)),
      position: new CANNON.Vec3(0, restY, 0),
      allowSleep: true,
    });
    objBody.sleepSpeedLimit = 0.15;
    objBody.sleepTimeLimit = 0.3;
    world.addBody(objBody);

    // The local axis pointing most directly upward after the object settles
    // gives the trial outcome.
    const worldUp = new CANNON.Vec3(0, 1, 0);
    const upTmp = new CANNON.Vec3();
    const getOutcome = (): number => {
      let best = 0;
      let bestDot = -Infinity;
      for (const { v, outcome } of faceAxes) {
        objBody.quaternion.vmult(v, upTmp);
        const d = upTmp.dot(worldUp);
        if (d > bestDot) {
          bestDot = d;
          best = outcome;
        }
      }
      return best;
    };

    const labels = labelsFor(experiment);

    // --- Trial lifecycle flags (mutable, read by the animation loop) ---
    let isRolling = false; // object is in motion from a throw/spin
    let isDragging = false; // pointer is currently holding the object
    let resultLogged = true; // true ⇒ current motion must not be tallied

    // --- Drag-to-throw, unified mouse + touch via Pointer Events ---
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    // Horizontal plane at the drag height; the cursor ray is intersected with
    // it to get an exact world position for the object.
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT_Y);
    const dragPoint = new THREE.Vector3();
    const prevDragPoint = new THREE.Vector3();
    let prevDragTime = 0;
    const dragVel = { x: 0, z: 0 };

    const setNdc = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      setNdc(e);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.intersectObject(objMesh).length === 0) return;
      isDragging = true;
      isRolling = true;
      resultLogged = false; // this throw should be tallied once it settles
      canvas.style.cursor = "grabbing";
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture is best-effort; the window pointerup is the fallback.
      }
      objBody.wakeUp();
      objBody.velocity.setZero();
      objBody.angularVelocity.setZero();
      if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
        prevDragPoint.copy(dragPoint);
      }
      prevDragTime = performance.now();
      dragVel.x = 0;
      dragVel.z = 0;
      ensureLoop();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      setNdc(e);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) return;
      dragPoint.x = clamp(dragPoint.x, -dragBound, dragBound);
      dragPoint.z = clamp(dragPoint.z, -dragBound, dragBound);
      objBody.position.set(dragPoint.x, LIFT_Y, dragPoint.z);
      objBody.velocity.setZero();
      objBody.angularVelocity.setZero();

      // Track recent cursor speed (world units/sec) to scale the throw.
      const now = performance.now();
      const dt = Math.max((now - prevDragTime) / 1000, 1 / 120);
      dragVel.x = (dragPoint.x - prevDragPoint.x) / dt;
      dragVel.z = (dragPoint.z - prevDragPoint.z) / dt;
      prevDragPoint.copy(dragPoint);
      prevDragTime = now;
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      canvas.style.cursor = "grab";
      objBody.wakeUp();
      // Fling along the drag direction, plus an upward toss and random spin so
      // even a near-still release still tumbles and produces an honest trial.
      const k = 0.16;
      objBody.applyImpulse(
        new CANNON.Vec3(
          clamp(dragVel.x * k, -9, 9),
          4 + Math.random() * 3,
          clamp(dragVel.z * k, -9, 9),
        ),
      );
      const spin = 16;
      objBody.angularVelocity.set(
        (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin,
      );
      isRolling = true;
      ensureLoop();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    // --- Animation loop: runs only while something is moving ---
    const STEP = 1 / 60;
    let rafId = 0;
    let loopRunning = false;

    const syncMesh = () => {
      objMesh.position.set(
        objBody.position.x,
        objBody.position.y,
        objBody.position.z,
      );
      objMesh.quaternion.set(
        objBody.quaternion.x,
        objBody.quaternion.y,
        objBody.quaternion.z,
        objBody.quaternion.w,
      );
    };

    const frame = () => {
      rafId = 0;
      world.step(STEP);
      syncMesh();

      const motion =
        objBody.velocity.lengthSquared() +
        objBody.angularVelocity.lengthSquared();

      // The object has come to rest: tally the result of a manual throw
      // exactly once, then let the loop wind down.
      if (
        isRolling &&
        !isDragging &&
        motion < 0.08 &&
        objBody.position.y < restY + 0.4
      ) {
        if (!resultLogged) {
          const outcome = getOutcome();
          resultLogged = true;
          setCounts((prev) => {
            const next = [...prev];
            next[outcome]++;
            return next;
          });
          setLastRoll(labels[outcome]);
        }
        isRolling = false;
      }

      renderer.render(scene, camera);

      if (isRolling || isDragging) {
        rafId = requestAnimationFrame(frame);
      } else {
        loopRunning = false; // idle — stop burning frames until next interaction
      }
    };

    /** Restart the render loop if it has gone idle. */
    function ensureLoop() {
      if (loopRunning) return;
      loopRunning = true;
      rafId = requestAnimationFrame(frame);
    }

    // Imperative controls for the buttons. `spin` is cosmetic only — the bulk
    // "Simulate" tally is computed in React state, so the spin must not be
    // counted as a physics trial (hence resultLogged = true).
    apiRef.current = {
      spin: () => {
        resultLogged = true;
        objBody.wakeUp();
        objBody.velocity.set(0, 6, 0);
        const s = 18;
        objBody.angularVelocity.set(
          (Math.random() - 0.5) * s,
          (Math.random() - 0.5) * s,
          (Math.random() - 0.5) * s,
        );
        isRolling = true;
        ensureLoop();
      },
      reset: () => {
        resultLogged = true;
        isRolling = false;
        isDragging = false;
        objBody.velocity.setZero();
        objBody.angularVelocity.setZero();
        objBody.position.set(0, restY, 0);
        objBody.quaternion.set(0, 0, 0, 1);
        ensureLoop(); // render the reset pose once
      },
    };

    syncMesh();
    ensureLoop(); // draw the initial frame

    // Keep the renderer and camera matched to the panel width.
    const resizeObserver = new ResizeObserver(() => {
      width = mount.clientWidth;
      height = mount.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.render(scene, camera);
    });
    resizeObserver.observe(mount);

    // Full teardown — leaking GPU buffers or animation frames here would
    // compound on every TryThis click and every experiment switch.
    return () => {
      resizeObserver.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      apiRef.current = null;
      disposeFns.forEach((fn) => fn());
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [experiment]);

  // --- Observable Plot bar chart, redrawn when the tally or experiment changes ---
  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;
    const total = counts.reduce((a, b) => a + b, 0);
    const labels = labelsFor(experiment);
    const theoreticalPct = THEORETICAL[experiment] * 100;

    const render = () => {
      container.innerHTML = "";
      const width = container.clientWidth || 380;
      const height = container.clientHeight || 150;

      if (total === 0) {
        const empty = document.createElement("div");
        empty.className =
          "h-full grid place-items-center text-center text-[12px] text-[color:var(--color-ink-500)] px-4";
        empty.textContent =
          "Throw the object, or use Simulate below to run trials.";
        container.appendChild(empty);
        return;
      }

      const data = counts.map((count, i) => ({
        outcome: labels[i],
        pct: (count / total) * 100,
      }));
      const maxPct = Math.max(...data.map((d) => d.pct));
      // Coin sits near 50% so a fixed 0–100% scale reads cleanly; the die's
      // bars are low, so the scale tracks the data with a 40% floor.
      const yMax =
        experiment === "coin"
          ? 100
          : Math.max(40, Math.ceil((maxPct * 1.15) / 10) * 10);

      const chart = Plot.plot({
        width,
        height,
        marginLeft: 44,
        marginBottom: 26,
        marginTop: 12,
        marginRight: 12,
        x: {
          label: experiment === "coin" ? "Outcome" : "Die face",
          domain: labels,
        },
        y: { label: "Relative frequency (%)", domain: [0, yMax], grid: true },
        marks: [
          Plot.barY(data, {
            x: "outcome",
            y: "pct",
            fill: "rgb(249, 115, 22)", // orange-500
            rx: 2,
          }),
          // Theoretical probability — the line the bars converge on as n grows.
          Plot.ruleY([theoreticalPct], {
            stroke: "rgb(15, 23, 42)",
            strokeDasharray: "4 3",
          }),
          Plot.ruleY([0]),
        ],
      });
      container.appendChild(chart);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(container);
    return () => observer.disconnect();
  }, [counts, experiment]);

  const total = counts.reduce((a, b) => a + b, 0);
  const isCoin = experiment === "coin";

  /** Switch experiment — this clears the tally and rebuilds the 3D scene. */
  function switchTo(next: Experiment) {
    if (next === experiment) return;
    setExperiment(next);
    setCounts(Array(next === "coin" ? 2 : 6).fill(0));
    setLastRoll(null);
  }

  /** Add `n` purely random trials and give the object a cosmetic spin. */
  function simulate(n: number) {
    setCounts((prev) => {
      const next = [...prev];
      for (let i = 0; i < n; i++)
        next[Math.floor(Math.random() * prev.length)]++;
      return next;
    });
    setLastRoll(null);
    apiRef.current?.spin();
  }

  function reset() {
    setCounts(Array(isCoin ? 2 : 6).fill(0));
    setLastRoll(null);
    apiRef.current?.reset();
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto">
      {/* Experiment toggle + how-to. `shrink-0` is essential — without it the
          flex column squashes this row to a sliver when the content overflows. */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-[color:var(--color-line)] overflow-hidden">
          {(["die", "coin"] as Experiment[]).map((exp) => (
            <button
              key={exp}
              onClick={() => switchTo(exp)}
              className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                experiment === exp
                  ? "bg-blue-600 text-white"
                  : "bg-white text-[color:var(--color-ink-700)] hover:bg-blue-50"
              }`}
            >
              {exp === "die" ? "Roll a die" : "Flip a coin"}
            </button>
          ))}
        </div>
        <VizGuide
          steps={[
            "Use the toggle to choose the die or the coin.",
            "Drag the object in the 3D view to throw it.",
            "Or press Simulate to run many trials at once.",
            "Watch each bar settle toward the dashed theoretical line.",
          ]}
        />
      </div>

      {/* 3D viewport — fixed height; the panel scrolls if space is tight. */}
      <div
        ref={mountRef}
        className="relative shrink-0 h-[240px] rounded-lg overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, #334155 0%, #0f172a 100%)",
        }}
      >
        <p className="absolute inset-x-0 bottom-1.5 text-center text-[10px] text-white/55 pointer-events-none">
          Drag the {isCoin ? "coin to flip" : "die to throw"} it
        </p>
      </div>

      {/* Tally summary */}
      <div className="flex shrink-0 items-stretch gap-2">
        <div className="flex-1 rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
            Total trials (N)
          </p>
          <p className="text-[18px] font-mono font-semibold text-[color:var(--color-ink-900)] tabular-nums">
            {total.toLocaleString()}
          </p>
        </div>
        <div className="flex-1 rounded-lg bg-slate-50 border border-[color:var(--color-line)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-500)]">
            Last thrown
          </p>
          <p className="text-[18px] font-mono font-semibold text-[color:var(--color-ink-900)] tabular-nums">
            {lastRoll ?? "—"}
          </p>
        </div>
      </div>

      {/* Observed relative frequency per outcome */}
      <div
        ref={chartRef}
        className="shrink-0 h-[150px] rounded-lg border border-[color:var(--color-line)] bg-white p-1"
      />
      <p className="shrink-0 text-[11px] text-[color:var(--color-ink-500)] -mt-1">
        Dashed line marks the theoretical probability,{" "}
        {isCoin ? "1/2 = 50%" : "1/6 ≈ 16.7%"}. The more you throw, the closer
        every bar settles to it.
      </p>

      {/* Bulk-trial controls */}
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <button
          onClick={() => simulate(10)}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-colors"
        >
          Simulate 10×
        </button>
        <button
          onClick={() => simulate(100)}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-colors"
        >
          Simulate 100×
        </button>
        <button
          onClick={() => simulate(1000)}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-colors"
        >
          Simulate 1000×
        </button>
        <button
          onClick={reset}
          className="px-3 py-1.5 rounded-md bg-white border border-[color:var(--color-line)] text-[color:var(--color-ink-700)] text-[12px] font-semibold hover:bg-slate-50 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
