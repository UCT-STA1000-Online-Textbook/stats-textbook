/**
 * 3D roulette wheel for the "Games of chance" section of
 * `m1-conditional-probability`. A showcase-tier visualisation (see the viz
 * tiers note in CLAUDE.md) that does one thing: shows the house edge at work.
 *
 * The student places a R1 bet on a mini roulette table, on red, black or any
 * single number, and keeps that bet every spin. The chart follows their
 * winnings spin by spin against a dashed line for the expected loss of R1/37
 * (about 2.7c) a spin. That line is the same for every bet, which is the
 * point: a number pays far more than a colour, but wins far less often, and
 * the house keeps the same share either way. Changing the bet clears the
 * spins, since winnings from one bet say nothing about another.
 *
 * The line only goes down, while the winnings wander either side of it:
 * their typical distance from the line grows like √n. On a colour bet (about
 * R1 of spread a spin) the blue line can still sit R20 or more off the line
 * after a few hundred spins, and the line's fall only outruns the wander after
 * about 1,400 spins. On a single number (about R5.84 a spin) that takes some
 * 47,000 spins. The read-out's wording is chosen not to promise more than
 * that, and says so outright for number bets.
 *
 * The wheel is animated with a tween, not a physics engine: physics is not
 * the lesson here. The pocket is drawn first (`sampleEquallyLikely`) and the
 * ball's path is then worked out backwards so it comes to rest in it.
 * three.js is imported only here and in `threeScene`, so `React.lazy` keeps it
 * out of every other unit. Everything built in the scene effect is disposed
 * on unmount, and the render loop stops whenever the wheel is still.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createThreeScene } from "../threeScene";
import { VizGuide } from "../VizGuide";
import { VIZ_TEXT, VizHint } from "../shared";
import { sampleEquallyLikely } from "../sampling";
import {
  HOUSE_EDGE,
  POCKET_COUNT,
  WHEEL_ORDER,
  betOdds,
  betPayout,
  betWins,
  colourOf,
  type PocketColour,
  type RouletteBet,
} from "../data/rouletteData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
/** Long-run (expected) line. Black and dashed, the book-wide colour for a mean. */
const MEAN_C = "rgb(0, 0, 0)";

/**
 * Pocket colours. Red here is the literal colour of the pockets on a real
 * wheel, not the "wrong answer" red used elsewhere in the book.
 */
const POCKET_FILL: Record<PocketColour, string> = {
  red: "#b91c1c",
  black: "#111827",
  green: "#15803d",
};

// --- Scene geometry (world units) ---
const ROTOR_R = 3; // radius of the spinning disc
const POCKET_R = ROTOR_R * 0.71; // where a ball sits once it has dropped in
const TRACK_R = 3.75; // where the ball circles on the sloping bowl
const BALL_R = 0.13;
const DISC_Y = 0.02; // height of the rotor's top face
/** Angle taken up by one pocket. */
const SLOT = (2 * Math.PI) / POCKET_COUNT;

/**
 * Cross-section of the wooden bowl around the rotor, as (radius, height)
 * points. `LatheGeometry` sweeps it round the wheel's axis, and `bowlHeight`
 * reads the same points to keep the ball on the slope.
 */
const BOWL_PROFILE: Array<[number, number]> = [
  [ROTOR_R, DISC_Y],
  [3.4, 0.18],
  [3.8, 0.34],
  [4.05, 0.42],
  [4.25, 0.62],
  [4.45, 0.62],
  [4.45, 0],
];

/** Height of the surface the ball rolls on at distance `r` from the centre. */
function bowlHeight(r: number): number {
  if (r <= ROTOR_R) return DISC_Y;
  for (let i = 1; i < 4; i++) {
    const [r0, y0] = BOWL_PROFILE[i - 1];
    const [r1, y1] = BOWL_PROFILE[i];
    if (r <= r1) return y0 + ((r - r0) / (r1 - r0)) * (y1 - y0);
  }
  return BOWL_PROFILE[3][1];
}

/**
 * Paints the top of the rotor: a ring of numbered, coloured pockets around a
 * wooden centre. Pocket `i` of `WHEEL_ORDER` is centred on angle i × SLOT,
 * measured anticlockwise from +x as seen from above.
 *
 * The canvas maps onto the disc with canvas-right = world +x and canvas-down
 * = world +z (towards the camera), so a point at angle θ sits at canvas
 * (c + r cos θ, c − r sin θ), and canvas arc angles are the negatives of θ.
 */
function createRotorTexture(): HTMLCanvasElement {
  const size = 1024;
  const c = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Wooden centre.
  const wood = ctx.createRadialGradient(c, c, 0, c, c, c);
  wood.addColorStop(0, "#9a6a3a");
  wood.addColorStop(1, "#4a2c14");
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();

  const sector = (theta: number, rIn: number, rOut: number) => {
    const a0 = theta - SLOT / 2;
    const a1 = theta + SLOT / 2;
    ctx.beginPath();
    ctx.arc(c, c, rOut, -a1, -a0);
    ctx.arc(c, c, rIn, -a0, -a1, true);
    ctx.closePath();
    ctx.fill();
  };

  WHEEL_ORDER.forEach((n, i) => {
    const theta = i * SLOT;
    const fill = POCKET_FILL[colourOf(n)];

    // Outer band: the numbers.
    ctx.fillStyle = fill;
    sector(theta, c * 0.82, c);
    // Inner band: the pocket the ball drops into, a shade darker.
    sector(theta, c * 0.6, c * 0.82);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    sector(theta, c * 0.6, c * 0.82);

    // Number, upright when read from outside the wheel (its top points at
    // the centre), so the pockets nearest the camera read the right way up.
    const r = c * 0.91;
    ctx.save();
    ctx.translate(c + r * Math.cos(theta), c - r * Math.sin(theta));
    ctx.rotate((3 * Math.PI) / 2 - theta);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  });

  // Brass rings between the bands.
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 6;
  for (const f of [0.6, 0.82, 0.995]) {
    ctx.beginPath();
    ctx.arc(c, c, c * f, 0, Math.PI * 2);
    ctx.stroke();
  }
  return canvas;
}

/** One spin's animation, in progress. Times are in seconds. */
interface SpinAnim {
  t: number;
  /** Total length; the rotor coasts to a stop at this time. */
  duration: number;
  /** When the ball comes to rest in its pocket. */
  drop: number;
  /** Rotor angle and speed when the spin began. */
  rotor0: number;
  rotorSpeed0: number;
  /** Angle of the target pocket on the rotor. */
  pocketAngle: number;
  /** How far ahead of its pocket the ball starts, measured on the rotor. */
  lead: number;
  /** Ball's distance from the centre when the spin began. */
  r0: number;
  onDone: () => void;
}

/**
 * Interactive 3D roulette wheel: bet R1 a spin on a colour or a number and
 * watch the house edge pull your winnings down. Takes no params; it always
 * opens on a bet on red.
 */
export default function RouletteWheel() {
  /** The bet placed on every spin. */
  const [bet, setBet] = useState<RouletteBet>("red");
  /** Every spin so far, as the number the ball landed on, oldest first. */
  const [spins, setSpins] = useState<number[]>([]);
  /** True while the wheel is turning; the run buttons wait for it. */
  const [spinning, setSpinning] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  /** Starts the wheel turning and lands the ball on `n`, then calls `onDone`. */
  const spinWheelRef = useRef<
    ((n: number, seconds: number, onDone: () => void) => void) | null
  >(null);
  /**
   * The latest `run`, for the canvas tap handler. The scene effect runs once,
   * so it reaches the current closure through this ref.
   */
  const runRef = useRef<(times: number) => void>(() => {});
  /**
   * Set the moment a spin starts, before React has re-rendered with
   * `spinning`, so two quick taps cannot start two spins at once.
   */
  const busyRef = useRef(false);

  // --- three.js scene: built once, torn down on unmount. ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const three = createThreeScene({
      mount,
      camera: { fov: 40, near: 0.1, far: 100 },
      ambient: { intensity: 1.5 },
      directional: {
        intensity: 2.4,
        position: [4, 12, 6],
        shadowMapSize: 512,
        shadowBounds: { near: 1, far: 30, left: -6, right: 6, top: 6, bottom: -6 },
      },
      floor: { size: 20, color: 0x14532d, roughness: 0.95, metalness: 0 },
      cursor: "pointer",
    });
    const { scene, camera, canvas, addDisposer, ensureLoop, setOnFrame } = three;
    camera.position.set(0, 7.3, 5.7);
    camera.lookAt(0, 0, 0.3);

    // Static wooden bowl around the rotor.
    const bowlGeom = new THREE.LatheGeometry(
      BOWL_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      72,
    );
    const bowlMat = new THREE.MeshStandardMaterial({
      color: 0x7c4a21,
      roughness: 0.55,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const bowl = new THREE.Mesh(bowlGeom, bowlMat);
    bowl.receiveShadow = true;
    scene.add(bowl);
    addDisposer(() => bowlGeom.dispose(), () => bowlMat.dispose());

    // The rotor: everything on it turns together through `rotor.rotation.y`.
    // A rotation of β about +y adds β to every angle in the convention used
    // by `createRotorTexture`, so pocket i sits at world angle rotation + i·SLOT.
    const rotor = new THREE.Group();
    scene.add(rotor);

    const rotorTex = new THREE.CanvasTexture(createRotorTexture());
    rotorTex.colorSpace = THREE.SRGBColorSpace;
    rotorTex.anisotropy = 4;
    const discGeom = new THREE.CircleGeometry(ROTOR_R, 96);
    const discMat = new THREE.MeshStandardMaterial({ map: rotorTex, roughness: 0.5 });
    const disc = new THREE.Mesh(discGeom, discMat);
    disc.rotation.x = -Math.PI / 2; // lie flat, facing up
    disc.position.y = DISC_Y;
    disc.receiveShadow = true;
    rotor.add(disc);
    addDisposer(
      () => discGeom.dispose(),
      () => discMat.dispose(),
      () => rotorTex.dispose(),
    );

    // Brass frets between the pockets, and a turret in the middle.
    const brass = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.3,
      metalness: 0.8,
    });
    const fretLen = ROTOR_R * 0.22;
    const fretGeom = new THREE.BoxGeometry(fretLen, 0.12, 0.035);
    const fretR = ROTOR_R * 0.71;
    for (let i = 0; i < POCKET_COUNT; i++) {
      const a = (i + 0.5) * SLOT; // the boundary between pockets i and i + 1
      const fret = new THREE.Mesh(fretGeom, brass);
      fret.position.set(fretR * Math.cos(a), DISC_Y + 0.06, -fretR * Math.sin(a));
      fret.rotation.y = a; // turn its long side to point at the centre
      fret.castShadow = true;
      rotor.add(fret);
    }
    const turretGeom = new THREE.ConeGeometry(0.32, 0.8, 24);
    const turret = new THREE.Mesh(turretGeom, brass);
    turret.position.y = DISC_Y + 0.4;
    turret.castShadow = true;
    rotor.add(turret);
    addDisposer(
      () => fretGeom.dispose(),
      () => turretGeom.dispose(),
      () => brass.dispose(),
    );

    // The ball.
    const ballGeom = new THREE.SphereGeometry(BALL_R, 20, 14);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
    const ball = new THREE.Mesh(ballGeom, ballMat);
    ball.castShadow = true;
    scene.add(ball);
    addDisposer(() => ballGeom.dispose(), () => ballMat.dispose());

    // --- Wheel state, read and written by the animation ---
    let rotorAngle = 0;
    let ballAngle = 0; // world angle; starts resting in pocket 0
    let ballR = POCKET_R;
    let anim: SpinAnim | null = null;

    const place = (lift = 0) => {
      rotor.rotation.y = rotorAngle;
      ball.position.set(
        ballR * Math.cos(ballAngle),
        bowlHeight(ballR) + BALL_R + lift,
        -ballR * Math.sin(ballAngle),
      );
    };

    /**
     * Lands the ball on number `n`. The rotor turns one way, slowing evenly
     * to a stop; the ball circles the other way and drops into its pocket at
     * `drop`, then rides round with the rotor until it stops.
     *
     * The ball's angle is tracked relative to the rotor as
     * pocketAngle + lead × (1 − s)², s running from 0 to 1 by the drop. So
     * it comes to rest in exactly its pocket, with no jump in speed as it
     * lands. `lead` is chosen so the ball starts where it was left, and
     * travels several turns backwards in the world first.
     */
    const spinWheel = (n: number, seconds: number, onDone: () => void) => {
      const pocketAngle = WHEEL_ORDER.indexOf(n) * SLOT;
      const drop = seconds * 0.72;
      const rotorSpeed0 = seconds > 2.5 ? 2.4 : 4;
      // Rotor travel up to the drop, with speed falling linearly to 0 at `seconds`.
      const rotorTurnToDrop = rotorSpeed0 * (drop - (drop * drop) / (2 * seconds));
      const backwardTurns = seconds > 2.5 ? 4 : 3;
      const base = rotorTurnToDrop + backwardTurns * 2 * Math.PI;
      // Add whatever extra (under one turn) makes the ball start where it is.
      const gap = ballAngle - rotorAngle - pocketAngle - base;
      const extra = ((gap % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      anim = {
        t: 0,
        duration: seconds,
        drop,
        rotor0: rotorAngle,
        rotorSpeed0,
        pocketAngle,
        lead: base + extra,
        r0: ballR,
        onDone,
      };
      ensureLoop();
    };
    spinWheelRef.current = spinWheel;

    setOnFrame((deltaMs) => {
      const a = anim;
      if (!a) return false;
      // Cap one frame's step so a backgrounded tab doesn't jump to the end.
      a.t = Math.min(a.t + Math.min(deltaMs / 1000, 0.1), a.duration);
      const { t, duration, drop } = a;

      rotorAngle = a.rotor0 + a.rotorSpeed0 * (t - (t * t) / (2 * duration));

      let lift = 0;
      if (t < drop) {
        const s = t / drop;
        ballAngle = rotorAngle + a.pocketAngle + a.lead * (1 - s) ** 2;
        if (s < 0.08) {
          // Launched out of its old pocket up onto the track.
          ballR = a.r0 + (TRACK_R - a.r0) * (s / 0.08);
        } else if (s < 0.7) {
          ballR = TRACK_R;
        } else {
          // Spirals down the bowl and across the rotor into the pocket.
          const u = (s - 0.7) / 0.3;
          ballR = TRACK_R + (POCKET_R - TRACK_R) * u * u;
          // A few shrinking hops as it clatters over the frets.
          if (u > 0.55) {
            const v = (u - 0.55) / 0.45;
            lift = 0.22 * (1 - v) * Math.abs(Math.sin(v * 3 * Math.PI));
          }
        }
      } else {
        ballAngle = rotorAngle + a.pocketAngle;
        ballR = POCKET_R;
      }
      place(lift);

      if (t >= duration) {
        anim = null;
        a.onDone();
        return false;
      }
      return true;
    });

    // A tap spins the wheel. Listening for "click" rather than "pointerdown"
    // means a swipe that scrolls the panel does not count as a tap, and
    // "pan-y" hands vertical swipes back to the browser so the panel still
    // scrolls on a phone (the shared scene sets "none" for drag-based viz).
    canvas.style.touchAction = "pan-y";
    const onClick = () => runRef.current(1);
    canvas.addEventListener("click", onClick);

    place();
    ensureLoop(); // draw the first frame

    return () => {
      canvas.removeEventListener("click", onClick);
      spinWheelRef.current = null;
      three.dispose();
    };
  }, []);

  /**
   * Spin `times` times. The numbers are drawn now; the wheel then turns and
   * lands the ball on the last of them, and only once it has stopped are the
   * spins added to the record, so a single spin is never given away early.
   */
  function run(times: number) {
    if (busyRef.current) return;
    busyRef.current = true;
    const drawn: number[] = [];
    for (let i = 0; i < times; i++) drawn.push(sampleEquallyLikely(POCKET_COUNT));
    const commit = () => {
      setSpins((prev) => prev.concat(drawn));
      setSpinning(false);
      busyRef.current = false;
    };
    const spinWheel = spinWheelRef.current;
    if (!spinWheel) {
      commit();
      return;
    }
    setSpinning(true);
    // A single spin gets the full show; a batch only needs a quick turn.
    spinWheel(drawn[drawn.length - 1], times === 1 ? 4.2 : 1.8, commit);
  }
  useEffect(() => {
    runRef.current = run;
  });

  // --- Everything below is worked out from the list of spins ---
  const total = spins.length;
  const last = total > 0 ? spins[total - 1] : null;

  const payout = betPayout(bet);
  const odds = betOdds(bet);

  /** Net winnings after each spin, starting from 0: payout − R1 on a win, −R1 otherwise. */
  const path = useMemo(() => {
    const out = [0];
    let net = 0;
    for (const n of spins) {
      net += betWins(bet, n) ? payout - 1 : -1;
      out.push(net);
    }
    return out;
  }, [spins, bet, payout]);
  const net = path[path.length - 1];
  const expectedLoss = total * HOUSE_EDGE;
  const spinWord = `spin${total === 1 ? "" : "s"}`;

  /** Place a new bet. The old bet's spins are cleared: they say nothing about the new one. */
  function placeBet(next: RouletteBet) {
    // busyRef, not `spinning`: it is set the instant a spin starts, so drawn
    // spins can never be committed under a bet placed after they were drawn.
    if (busyRef.current || next === bet) return;
    setBet(next);
    setSpins([]);
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <VizHint>Tap a number or a colour on the table to bet on it, then press Spin once.</VizHint>

      {/* 3D viewport. Fixed height; the panel scrolls if space is short. */}
      <div
        ref={mountRef}
        className="relative h-[250px] rounded-lg overflow-hidden"
        style={{
          background: "radial-gradient(circle at 50% 40%, #334155 0%, #0f172a 100%)",
        }}
      >
        {last !== null && !spinning && (
          <div className="absolute left-2 top-2 flex items-center gap-2 rounded-md bg-black/45 px-2 py-1 pointer-events-none">
            <Pocket n={last} size={26} />
            {/* Name what the bet was on: the colour for a colour bet, the
                number for a number bet, so a loss on 17 never reads as
                "Black" being the reason. */}
            <span className="text-[12px] font-medium text-white">
              <span className="capitalize">
                {typeof bet === "number" ? last : colourOf(last)}
              </span>
              {": "}
              {betWins(bet, last) ? `you win R${payout - 1}` : "you lose R1"}
            </span>
          </div>
        )}
        {/* The badge above is visual only; this tells a screen reader where the ball landed. */}
        <p className="sr-only" aria-live="polite">
          {last !== null && !spinning
            ? `The ball landed on ${last} ${colourOf(last)}: you ${
                betWins(bet, last) ? `win R${payout - 1}` : "lose R1"
              }.`
            : ""}
        </p>
        <p className="absolute inset-x-0 bottom-1.5 text-center text-[10px] text-white/55 pointer-events-none">
          {spinning ? "Spinning…" : "Tap the wheel to spin"}
        </p>
      </div>

      <BetTable bet={bet} payout={payout} disabled={spinning} onPick={placeBet} />

      {/* Run controls */}
      <div className="rounded-lg border border-[color:var(--color-line)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mr-0.5">
            Run it
          </span>
          {[1, 500].map((times) => (
            <button
              key={times}
              onClick={() => run(times)}
              disabled={spinning}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait"
            >
              {times === 1 ? "Spin once" : "Spin 500"}
            </button>
          ))}
          <button
            onClick={() => setSpins([])}
            disabled={spinning}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-500)] transition-colors hover:border-blue-400 disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>

      <WinningsChart path={path} />

      {/* Read-out: the working, then what it means. */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            Your winnings
          </p>
          <VizGuide
            steps={[
              "Tap a number or a colour on the table to place your R1 bet. Changing your bet clears the spins.",
              "Tap the wheel or press Spin once to watch one spin land.",
              "Press Spin 500 to add 500 spins at a time.",
              "Compare your winnings (the blue line) with the dashed line: the expected loss of 2.7c a spin, which is the same for every bet.",
              "Reset clears every spin.",
            ]}
          />
        </div>
        {total === 0 ? (
          <p className="mt-1 text-[15px] leading-snug text-[color:var(--color-ink-900)] tabular-nums">
            Expected loss per spin = R1 − {odds.pText} × R{payout} ={" "}
            <span className="font-semibold" style={{ color: MEAN_C }}>
              R{HOUSE_EDGE.toFixed(3)}
            </span>
          </p>
        ) : (
          <>
            <p className="mt-1 text-[15px] leading-snug text-[color:var(--color-ink-900)] tabular-nums">
              After {total.toLocaleString()} {spinWord} you are{" "}
              <span className="font-semibold text-blue-700">
                {net === 0 ? "even" : `${net > 0 ? "up" : "down"} R${Math.abs(net).toLocaleString()}`}
              </span>
            </p>
            <p className="text-[15px] leading-snug text-[color:var(--color-ink-900)] tabular-nums">
              Expected loss = {total.toLocaleString()} × R1 / 37 ={" "}
              <span className="font-semibold" style={{ color: MEAN_C }}>
                R{expectedLoss.toFixed(2)}
              </span>
            </p>
          </>
        )}
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          {total === 0
            ? `The casino pays R${payout} where a fair payout would be R${odds.fairText}, so in the long run it keeps 2.7c of every rand bet.`
            : net > 0
              ? "You are ahead for now, but the dashed line slopes down. Keep spinning."
              : total < 100
                ? "Over a few spins anything can happen. Press Spin 500 to see the long run."
                : typeof bet === "number"
                  ? "Wins on one number are rare but big, so your winnings swing far from the dashed line. The line is the same as for a colour: every bet loses 2.7c a rand."
                  : "Your winnings wander either side of the dashed line, but the line only goes one way: down 2.7c for every rand you bet."}
        </p>
      </div>
    </div>
  );
}

/** The 1 to 36 squares in table order: column `c` holds 3c + 1 to 3c + 3, highest at the top. */
const TABLE_CELLS = Array.from({ length: 36 }, (_, i) => {
  const c = Math.floor(i / 3);
  const r = i % 3; // 0 = top row
  return { n: 3 * c + (3 - r), col: c + 2, row: r + 1 };
});

/**
 * A small roulette table to bet on, laid out like a real one: the green 0 on
 * the left, 1 to 36 in three rows of twelve (3, 6, … 36 along the top), and a
 * Red and a Black box below. The current bet is ringed in blue.
 */
function BetTable({
  bet,
  payout,
  disabled,
  onPick,
}: {
  bet: RouletteBet;
  /** Payout of the current bet, for the caption. */
  payout: number;
  /** True while the wheel is turning: no bets change mid-spin. */
  disabled: boolean;
  onPick: (bet: RouletteBet) => void;
}) {
  const cell = (selected: boolean) =>
    `grid place-items-center rounded-[3px] text-[11px] font-bold text-white tabular-nums transition-opacity disabled:cursor-wait ${
      selected
        ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-[#14532d] z-10"
        : "hover:opacity-80"
    }`;

  return (
    <div>
      <p className="mb-1 text-[12px] text-[color:var(--color-ink-700)]">
        Your bet: <span className="font-semibold">R1 on {bet}</span> (pays R{payout})
      </p>
      <div className="rounded-lg p-1.5" style={{ background: "#14532d" }}>
        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: "1.2fr repeat(12, 1fr)",
            gridTemplateRows: "repeat(3, 24px)",
          }}
        >
          <button
            onClick={() => onPick(0)}
            disabled={disabled}
            aria-pressed={bet === 0}
            aria-label="Bet on 0"
            className={cell(bet === 0)}
            style={{ gridColumn: 1, gridRow: "1 / span 3", background: POCKET_FILL.green }}
          >
            0
          </button>
          {TABLE_CELLS.map(({ n, col, row }) => (
            <button
              key={n}
              onClick={() => onPick(n)}
              disabled={disabled}
              aria-pressed={bet === n}
              aria-label={`Bet on ${n}`}
              className={cell(bet === n)}
              style={{ gridColumn: col, gridRow: row, background: POCKET_FILL[colourOf(n)] }}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-[3px] grid grid-cols-2 gap-[3px]">
          {(["red", "black"] as const).map((c) => (
            <button
              key={c}
              onClick={() => onPick(c)}
              disabled={disabled}
              aria-pressed={bet === c}
              aria-label={`Bet on ${c}`}
              className={`${cell(bet === c)} h-6 uppercase tracking-wider`}
              style={{ background: POCKET_FILL[c] }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A round marker in a pocket's colour, carrying its number. */
function Pocket({ n, size }: { n: number; size: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-full font-bold text-white tabular-nums"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.48,
        background: POCKET_FILL[colourOf(n)],
      }}
    >
      {n}
    </span>
  );
}

// Chart geometry (viewBox units).
const CW = 440;
const CH = 180;
const CX0 = 50;
const CX1 = 428;
const CY0 = 14;
const CY1 = 150;

/**
 * Net winnings after each spin (blue) against the long-run expectation of
 * losing 1/37 of a rand a spin (black, dashed). Long histories are thinned to
 * about 400 points, which is more than the chart has pixels for.
 */
function WinningsChart({ path }: { path: number[] }) {
  const n = path.length - 1;
  if (n === 0) {
    return (
      <div className="h-[120px] grid place-items-center rounded-lg border border-dashed border-[color:var(--color-line)] text-[12px] text-[color:var(--color-ink-500)]">
        Your winnings will be drawn here, spin by spin.
      </div>
    );
  }
  const expectedEnd = -n / 37;
  // A loop rather than Math.min(...path): spreading a very long history
  // into call arguments can overflow the stack.
  let lo = expectedEnd;
  let hi = 0;
  for (const v of path) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const pad = Math.max((hi - lo) * 0.08, 1);
  const yMin = lo - pad;
  const yMax = hi + pad;
  const xOf = (i: number) => CX0 + (i / n) * (CX1 - CX0);
  const yOf = (v: number) => CY1 - ((v - yMin) / (yMax - yMin)) * (CY1 - CY0);

  const step = Math.max(1, Math.ceil(n / 400));
  const points: string[] = [];
  for (let i = 0; i <= n; i += step) points.push(`${xOf(i)},${yOf(path[i])}`);
  if (n % step !== 0) points.push(`${xOf(n)},${yOf(path[n])}`);

  // Whole-rand ticks at the lowest point, zero and the highest point. Rounded
  // before de-duplicating, so a tiny loss never prints as a second "R0".
  // Labels closer than 12 units to the zero line would overprint it.
  const ticks = [Math.ceil(lo), 0, Math.floor(hi)].filter(
    (v, i, all) =>
      all.indexOf(v) === i && (v === 0 || Math.abs(yOf(v) - yOf(0)) >= 12),
  );

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full h-auto select-none" role="img">
      <title>
        {`Net winnings over ${n} spin${n === 1 ? "" : "s"}, ending at ${
          path[n] < 0 ? `−R${-path[n]}` : `R${path[n]}`
        }, against an expected loss of R${(-expectedEnd).toFixed(2)}`}
      </title>
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={CX0}
            x2={CX1}
            y1={yOf(v)}
            y2={yOf(v)}
            stroke="var(--color-line)"
            strokeDasharray={v === 0 ? undefined : "3 3"}
          />
          <text
            x={CX0 - 6}
            y={yOf(v) + 3}
            textAnchor="end"
            fontSize={VIZ_TEXT.axisTick}
            fill="var(--color-ink-500)"
            className="tabular-nums"
          >
            {v < 0 ? `−R${-v}` : `R${v}`}
          </text>
        </g>
      ))}
      {/* Theory first, so the observed winnings are drawn over it. */}
      <line
        x1={xOf(0)}
        y1={yOf(0)}
        x2={xOf(n)}
        y2={yOf(expectedEnd)}
        stroke={MEAN_C}
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <text
        x={CX1}
        y={yOf(expectedEnd) + 14}
        textAnchor="end"
        fontSize={VIZ_TEXT.axisTick}
        fontWeight="600"
        fill={MEAN_C}
        stroke="white"
        strokeWidth="3"
        paintOrder="stroke"
      >
        long run: −2.7c a spin
      </text>
      <text
        x={(CX0 + CX1) / 2}
        y={CH - 8}
        textAnchor="middle"
        fontSize={VIZ_TEXT.label}
        fill="var(--color-ink-700)"
      >
        winnings after {n.toLocaleString()} spin{n === 1 ? "" : "s"}
      </text>
    </svg>
  );
}
