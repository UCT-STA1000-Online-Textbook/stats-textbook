/**
 * Counting Studio — a 3D, hands-on view of the four counting rules of WU3.
 *
 * The notes derive every counting rule with the same picture: "r slots to
 * fill". This viz makes that physical. A tray of n numbered tiles sits in
 * front of a row of r slots; click a tile to send it (with a little tweened
 * arc) into the next slot, click a placed tile to take the last one back.
 * A scenario selector reframes the same scene as each of the four rules,
 * each with a real-world example, and a panel shows the choices multiplying
 * out slot by slot into the rule's formula and count.
 *
 *   Arrange all n   → n!          (line up n books on a shelf)
 *   Order r of n    → (n)_r       (pose r of n people for a photo)
 *   Choose r of n   → C(n, r)     (pick a work team of r from n)
 *   Code, r of n    → n^r         (set an r-symbol code from n types)
 *
 * Showcase-tier viz: real 3D (three.js). `three` is imported only in this
 * module, so `React.lazy` in `VizRegistry` keeps it out of every other unit's
 * bundle. No physics engine is needed — placement is tweened, not simulated.
 * The scene is built in one `useEffect` and fully disposed on unmount or when
 * the scenario / n / r change; the render loop is paused whenever nothing is
 * moving (the cohort runs budget devices — see CLAUDE.md).
 */

"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { VizGuide } from "../VizGuide";
import type { VizParams } from "@/store/vizStore";

/** The four counting rules, each as a selectable scenario. */
type Scenario = "arrange" | "order" | "choose" | "code";

interface ScenarioDef {
  id: Scenario;
  tab: string;
  /** Real-world framing; `{n}` and `{r}` are substituted for the live values. */
  real: (n: number, r: number) => string;
  /** Whether a tile may be used in more than one slot. */
  repeats: boolean;
  /** Whether slot order matters (false ⇒ a combination). */
  ordered: boolean;
}

const SCENARIOS: ScenarioDef[] = [
  {
    id: "arrange",
    tab: "Arrange n",
    real: (n) => `Line up all ${n} books on a shelf — every book used once.`,
    repeats: false,
    ordered: true,
  },
  {
    id: "order",
    tab: "Order r of n",
    real: (n, r) => `Pose ${r} of ${n} people for a photo — positions matter.`,
    repeats: false,
    ordered: true,
  },
  {
    id: "choose",
    tab: "Choose r of n",
    real: (n, r) => `Pick a work team of ${r} from ${n} — order does not matter.`,
    repeats: false,
    ordered: false,
  },
  {
    id: "code",
    tab: "Code, r of n",
    real: (n, r) => `Build a code of ${r} symbols from ${n} types — repeats allowed.`,
    repeats: true,
    ordered: true,
  },
];

const N_MIN = 2;
const N_MAX = 8;
const R_MIN = 1;
const R_MAX = 6;

// --- counting maths ---
function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}
/** Permutations (n)_r = n!/(n−r)! — the product n(n−1)…(n−r+1). */
function permutations(n: number, r: number): number {
  let p = 1;
  for (let i = 0; i < r; i++) p *= n - i;
  return p;
}
/** Combinations C(n, r). */
function combinations(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  return permutations(n, r) / factorial(r);
}

/** Total number of arrangements for the scenario at the given n, r. */
function countFor(scenario: Scenario, n: number, r: number): number {
  switch (scenario) {
    case "arrange":
      return factorial(n);
    case "order":
      return permutations(n, r);
    case "choose":
      return combinations(n, r);
    case "code":
      return Math.pow(n, r);
  }
}

/**
 * Draws one numbered tile face onto an offscreen canvas — a rounded coloured
 * square with a large white numeral. Generated procedurally so the viz needs
 * no texture asset files (the same approach `RandomTrials` uses for dice).
 */
function createTileFace(label: string, hue: number): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0f172a"; // dark backing so edges read cleanly
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = `hsl(${hue}, 64%, 55%)`;
  ctx.beginPath();
  ctx.roundRect(14, 14, size - 28, size - 28, 36);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.font = "bold 150px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, size / 2, size / 2 + 10);
  return canvas;
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/**
 * @param params.scenario — initial rule: "arrange" | "order" | "choose" |
 *   "code". Defaults to "order". Students switch with the in-viz selector.
 */
export default function CountingStudio({ params }: { params: VizParams }) {
  const initialScenario: Scenario =
    typeof params.scenario === "string" &&
    SCENARIOS.some((s) => s.id === params.scenario)
      ? (params.scenario as Scenario)
      : "order";

  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [n, setN] = useState(6);
  const [r, setR] = useState(3);
  /** Number of slots currently filled — mirrored up from the 3D scene. */
  const [filled, setFilled] = useState(0);

  const def = SCENARIOS.find((s) => s.id === scenario)!;
  // "Arrange" uses every tile, so r is locked to n; "order"/"choose" need
  // r ≤ n; "code" allows r independent of n (a long code from few symbols).
  const rEff =
    scenario === "arrange" ? n : scenario === "code" ? r : Math.min(r, n);

  const total = countFor(scenario, n, rEff);

  const mountRef = useRef<HTMLDivElement>(null);
  /** Imperative handle the Clear / Shuffle buttons use to poke the scene. */
  const apiRef = useRef<{ clear: () => void; shuffle: () => void } | null>(null);

  // --- 3D scene. Rebuilt whenever the scenario, n or r changes; fully torn
  //     down on unmount. ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    setFilled(0);

    let width = mount.clientWidth || 420;
    let height = mount.clientHeight || 260;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const canvas = renderer.domElement;
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);

    scene.add(new THREE.AmbientLight(0xffffff, 1.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.4);
    dirLight.position.set(5, 13, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(512, 512);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 44;
    dirLight.shadow.camera.left = -14;
    dirLight.shadow.camera.right = 14;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    scene.add(dirLight);

    // Disposal closures, run on cleanup.
    const disposeFns: Array<() => void> = [];

    // Floor — catches the tile shadows.
    const floorGeom = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.97,
      metalness: 0.04,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    disposeFns.push(() => floorGeom.dispose(), () => floorMat.dispose());

    // Shared tile geometry — a thin rounded-ish slab.
    const TILE = 1.5;
    const TILE_H = 0.28;
    const tileGeom = new THREE.BoxGeometry(TILE, TILE_H, TILE);
    disposeFns.push(() => tileGeom.dispose());

    // --- n tray tiles (the palette of distinct numbered objects) ---
    const TRAY_Z = 3.4;
    const PAD_Z = -3.0;
    const trayPitch = TILE + 0.32;
    const padPitch = TILE + 0.5;

    const trayX = (i: number) => (i - (n - 1) / 2) * trayPitch;
    const padX = (j: number) => (j - (rEff - 1) / 2) * padPitch;

    const tileTextures: THREE.CanvasTexture[] = [];
    const trayMats: THREE.MeshStandardMaterial[] = [];
    const trayTiles: THREE.Mesh[] = [];
    for (let i = 0; i < n; i++) {
      const tex = new THREE.CanvasTexture(
        createTileFace(String(i + 1), (i / n) * 360),
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tileTextures.push(tex);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.5,
        metalness: 0.05,
        transparent: true,
      });
      trayMats.push(mat);
      const tile = new THREE.Mesh(tileGeom, mat);
      tile.position.set(trayX(i), TILE_H / 2, TRAY_Z);
      tile.castShadow = true;
      tile.userData = { kind: "tray", index: i };
      scene.add(tile);
      trayTiles.push(tile);
    }
    disposeFns.push(
      ...tileTextures.map((t) => () => t.dispose()),
      ...trayMats.map((m) => () => m.dispose()),
    );

    // --- r slot pads, and a mobile tile that rests on each when filled ---
    const padGeom = new THREE.CylinderGeometry(TILE * 0.78, TILE * 0.82, 0.18, 36);
    disposeFns.push(() => padGeom.dispose());
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.8,
      metalness: 0.1,
    });
    disposeFns.push(() => padMat.dispose());

    const padTileMats: THREE.MeshStandardMaterial[] = [];
    const padTiles: THREE.Mesh[] = [];
    const pads: THREE.Mesh[] = [];
    for (let j = 0; j < rEff; j++) {
      const pad = new THREE.Mesh(padGeom, padMat);
      pad.position.set(padX(j), 0.09, PAD_Z);
      pad.receiveShadow = true;
      pad.userData = { kind: "pad", slot: j };
      scene.add(pad);
      pads.push(pad);

      const ptMat = new THREE.MeshStandardMaterial({
        roughness: 0.5,
        metalness: 0.05,
      });
      padTileMats.push(ptMat);
      const pt = new THREE.Mesh(tileGeom, ptMat);
      pt.castShadow = true;
      pt.visible = false;
      pt.userData = { kind: "padtile", slot: j };
      scene.add(pt);
      padTiles.push(pt);
    }
    disposeFns.push(...padTileMats.map((m) => () => m.dispose()));

    // --- placement state (owned imperatively by the scene) ---
    /** placed[j] = tray-tile index in slot j, or -1 if the slot is empty. */
    const placed: number[] = Array(rEff).fill(-1);

    /** Refresh which tray tiles look "used up" (no-repeat scenarios only). */
    function refreshTrayDim() {
      const used = new Set(placed.filter((v) => v >= 0));
      for (let i = 0; i < n; i++) {
        trayMats[i].opacity = !def.repeats && used.has(i) ? 0.28 : 1;
      }
    }

    // --- tween system: a tile sliding from the tray to a pad ---
    interface Tween {
      mesh: THREE.Mesh;
      from: THREE.Vector3;
      to: THREE.Vector3;
      t: number;
    }
    const tweens: Tween[] = [];
    const TWEEN_MS = 420;

    function placeTile(trayIndex: number) {
      const slot = placed.indexOf(-1);
      if (slot === -1) return; // every slot full
      if (!def.repeats && placed.includes(trayIndex)) return; // already used
      placed[slot] = trayIndex;

      const pt = padTiles[slot];
      pt.material = padTileMats[slot];
      padTileMats[slot].map = tileTextures[trayIndex];
      padTileMats[slot].needsUpdate = true;
      pt.visible = true;
      const from = new THREE.Vector3(trayX(trayIndex), TILE_H / 2, TRAY_Z);
      const to = new THREE.Vector3(padX(slot), 0.18 + TILE_H / 2, PAD_Z);
      pt.position.copy(from);
      tweens.push({ mesh: pt, from, to, t: 0 });

      refreshTrayDim();
      setFilled(placed.filter((v) => v >= 0).length);
      ensureLoop();
    }

    /** Remove the most recently placed tile (stack pop). */
    function removeLast() {
      let slot = -1;
      for (let j = rEff - 1; j >= 0; j--) {
        if (placed[j] >= 0) {
          slot = j;
          break;
        }
      }
      if (slot === -1) return;
      placed[slot] = -1;
      padTiles[slot].visible = false;
      refreshTrayDim();
      setFilled(placed.filter((v) => v >= 0).length);
      renderOnce();
    }

    function clearAll() {
      for (let j = 0; j < rEff; j++) {
        placed[j] = -1;
        padTiles[j].visible = false;
      }
      tweens.length = 0;
      refreshTrayDim();
      setFilled(0);
      renderOnce();
    }

    /** Auto-fill every slot with a random valid arrangement. */
    function shuffleFill() {
      clearAll();
      for (let j = 0; j < rEff; j++) {
        if (def.repeats) {
          placeTile(Math.floor(Math.random() * n));
        } else {
          // pick a tray index not yet used
          let idx = Math.floor(Math.random() * n);
          let guard = 0;
          while (placed.includes(idx) && guard++ < 100) {
            idx = Math.floor(Math.random() * n);
          }
          placeTile(idx);
        }
      }
    }

    apiRef.current = { clear: clearAll, shuffle: shuffleFill };

    // --- camera (fixed framing, pointer-drag orbits the azimuth) ---
    const sceneSpan = Math.max(n * trayPitch, rEff * padPitch);
    const camRadius = Math.max(11, sceneSpan * 0.95);
    const camHeight = camRadius * 0.62;
    let azimuth = 0;
    const target = new THREE.Vector3(0, 0.4, 0.2);
    function applyCamera() {
      camera.position.set(
        Math.sin(azimuth) * camRadius,
        camHeight,
        Math.cos(azimuth) * camRadius,
      );
      camera.lookAt(target);
    }
    applyCamera();

    // --- render loop, paused when nothing moves ---
    let rafId = 0;
    let running = false;
    function renderOnce() {
      renderer.render(scene, camera);
    }
    function frame() {
      let active = false;
      for (let k = tweens.length - 1; k >= 0; k--) {
        const tw = tweens[k];
        tw.t = Math.min(1, tw.t + 16 / TWEEN_MS);
        const e = tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - Math.pow(-2 * tw.t + 2, 2) / 2;
        tw.mesh.position.lerpVectors(tw.from, tw.to, e);
        // a small lift so the tile arcs rather than slides flat
        tw.mesh.position.y += Math.sin(tw.t * Math.PI) * 1.5;
        if (tw.t >= 1) tweens.splice(k, 1);
        else active = true;
      }
      renderOnce();
      if (active) {
        rafId = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    }
    function ensureLoop() {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(frame);
      }
    }
    renderOnce();

    // --- pointer: a tap places / removes, a drag orbits ---
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let pointerDown = false;
    let moved = false;
    let lastX = 0;
    let downX = 0;

    function setNdc(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    const onDown = (e: PointerEvent) => {
      pointerDown = true;
      moved = false;
      lastX = e.clientX;
      downX = e.clientX;
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      if (Math.abs(e.clientX - downX) > 4) moved = true;
      azimuth += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
      applyCamera();
      ensureLoop();
    };
    const onUp = (e: PointerEvent) => {
      if (!pointerDown) return;
      pointerDown = false;
      canvas.style.cursor = "grab";
      if (moved) return; // it was an orbit drag, not a tap

      setNdc(e);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([
        ...trayTiles,
        ...pads,
        ...padTiles.filter((p) => p.visible),
      ]);
      if (hits.length === 0) return;
      const ud = hits[0].object.userData as {
        kind: string;
        index?: number;
        slot?: number;
      };
      if (ud.kind === "tray") placeTile(ud.index!);
      else removeLast(); // tapped a pad or a placed tile
    };

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // --- keep the canvas sized to its container ---
    const ro = new ResizeObserver(() => {
      width = mount.clientWidth || width;
      height = mount.clientHeight || height;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderOnce();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      apiRef.current = null;
      disposeFns.forEach((fn) => fn());
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [scenario, n, rEff, def.repeats]);

  // --- readout, derived from the React state ---
  /** Number of choices available for each slot, in fill order. */
  const slotChoices: number[] = [];
  for (let i = 0; i < rEff; i++) {
    slotChoices.push(def.repeats ? n : n - i);
  }
  const runningProduct = slotChoices
    .slice(0, filled)
    .reduce((p, c) => p * c, 1);
  const nextChoices = filled < rEff ? slotChoices[filled] : null;

  return (
    <div className="h-full flex flex-col gap-2.5 overflow-y-auto">
      {/* Scenario selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium border transition-colors ${
                scenario === s.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
              }`}
            >
              {s.tab}
            </button>
          ))}
        </div>
        <VizGuide
          steps={[
            "Pick a counting rule with the buttons above — each is a real-world example.",
            "Click a numbered tile to drop it into the next slot; click a placed tile to take the last one back.",
            "Use the n and r steppers to resize the pool and the slots.",
            "Watch the panel: the choices for each slot multiply out into the rule's formula.",
            "Drag the scene to rotate it; Shuffle fills the slots at random.",
          ]}
        />
      </div>

      {/* n / r steppers + actions */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <Stepper
          label="n"
          value={n}
          min={N_MIN}
          max={N_MAX}
          onChange={(v) => {
            setN(v);
            if (scenario !== "code") setR((cur) => Math.min(cur, v));
          }}
        />
        <Stepper
          label="r"
          value={rEff}
          min={R_MIN}
          max={scenario === "code" ? R_MAX : Math.min(R_MAX, n)}
          disabled={scenario === "arrange"}
          onChange={setR}
        />
        <div className="flex gap-1.5">
          <button
            onClick={() => apiRef.current?.shuffle()}
            className="rounded-md border border-[color:var(--color-line)] bg-white px-2.5 py-1 text-[11px] font-medium text-[color:var(--color-ink-700)] hover:border-blue-400 transition-colors"
          >
            Shuffle
          </button>
          <button
            onClick={() => apiRef.current?.clear()}
            className="rounded-md border border-[color:var(--color-line)] bg-white px-2.5 py-1 text-[11px] font-medium text-[color:var(--color-ink-700)] hover:border-blue-400 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* 3D scene */}
      <div
        ref={mountRef}
        className="w-full rounded-xl overflow-hidden"
        style={{
          height: 250,
          background:
            "linear-gradient(160deg, rgb(51, 65, 85) 0%, rgb(15, 23, 42) 100%)",
        }}
      />

      {/* Readout */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2 text-[12px] leading-relaxed text-[color:var(--color-ink-700)]">
        <p>{def.real(n, rEff)}</p>
        <p className="mt-1 font-mono">
          <Formula scenario={scenario} n={n} r={rEff} /> ={" "}
          <span className="font-semibold text-blue-700 tabular-nums">
            {total.toLocaleString("en")}
          </span>
        </p>
        <p className="mt-1 text-[color:var(--color-ink-500)]">
          {scenario === "choose" ? (
            <>
              {filled} of {rEff} chosen — order does not matter, so every
              ordering of the same group counts once.
            </>
          ) : filled === 0 ? (
            <>
              Slot 1 has {slotChoices[0]} choices. Place a tile to start
              multiplying.
            </>
          ) : (
            <>
              Choices so far:{" "}
              <span className="font-mono text-[color:var(--color-ink-700)]">
                {slotChoices.slice(0, filled).join(" × ")} ={" "}
                {runningProduct.toLocaleString("en")}
              </span>
              {nextChoices !== null && (
                <> · next slot: {nextChoices} choices</>
              )}
              {filled === rEff && (
                <span className="text-[color:var(--color-ink-700)]">
                  {" "}
                  — you have built 1 of {total.toLocaleString("en")} possible
                  arrangements.
                </span>
              )}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** Renders the counting-rule formula for the current scenario, with the
 *  live n and r substituted, using proper sub/super-scripts. */
function Formula({
  scenario,
  n,
  r,
}: {
  scenario: Scenario;
  n: number;
  r: number;
}) {
  switch (scenario) {
    case "arrange":
      return (
        <>
          {n}! = {n} × {n - 1} × … × 1
        </>
      );
    case "order":
      return (
        <>
          ({n})<sub>{r}</sub> = {n}! / ({n} − {r})!
        </>
      );
    case "choose":
      return (
        <>
          C({n}, {r}) = {n}! / ({r}! ({n} − {r})!)
        </>
      );
    case "code":
      return (
        <>
          {n}
          <sup>{r}</sup>
        </>
      );
  }
}

/** Compact −/＋ integer stepper. */
function Stepper({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 ${disabled ? "opacity-45" : ""}`}
    >
      <span className="text-[12px] font-mono font-semibold text-[color:var(--color-ink-700)]">
        {label}
      </span>
      <button
        onClick={() => onChange(clampInt(value - 1, min, max))}
        disabled={disabled || value <= min}
        className="grid place-items-center w-6 h-6 rounded-md border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-700)] disabled:opacity-40 hover:border-blue-400 transition-colors"
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <span className="w-5 text-center text-[13px] font-mono tabular-nums font-semibold text-[color:var(--color-ink-900)]">
        {value}
      </span>
      <button
        onClick={() => onChange(clampInt(value + 1, min, max))}
        disabled={disabled || value >= max}
        className="grid place-items-center w-6 h-6 rounded-md border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-700)] disabled:opacity-40 hover:border-blue-400 transition-colors"
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}
