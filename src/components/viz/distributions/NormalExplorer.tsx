/**
 * Bell-curve explorer for the Normal distribution, used by Module 4, WU4
 * (`m4-normal`).
 *
 * The unit's big idea is that every Normal distribution is the same shape,
 * so one table (or one Excel function) serves them all once x is converted
 * into z = (x − μ)/σ. The viz makes that link visible rather than asserted:
 *
 *   1. A second axis under the x-axis marks z, the number of standard
 *      deviations from the mean. Drag μ or σ and the curve moves and
 *      flattens, and the z-axis moves and stretches with it, so the same
 *      stretch of z always sits under the same share of the curve.
 *   2. The shading handles c and d sweep out an area. Pull a handle off
 *      either end of the axis and that edge becomes −∞ or ∞, which covers
 *      the "less than" and "more than" questions. The read-out standardises
 *      the edges and shows the subtraction of cumulative probabilities, then
 *      the Excel formula that gives the same answer.
 *   3. Run draws real values (tubs weighed, cups poured) and piles them up as
 *      a pale histogram under the curve, with a rug of the latest draws on the
 *      axis, and scores how many land in the shaded area. For Example 21B each
 *      draw is four chore times added together, so the sum is seen to come
 *      out Normal with the mean and variance the text adds up.
 *
 * The x-axis window is fixed per preset and never rescales, so moving σ
 * visibly flattens the curve. The tally is cleared whenever μ, σ or the
 * shading moves, because draws scored against one question say nothing about
 * another.
 *
 * Default tier: hand-rolled SVG, pointer drags via `useSvgDrag`. The only
 * animation is the short entrance tween on preset loads.
 */

"use client";

import { useMemo, useRef, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { useSvgDrag, clampN } from "../useDrag";
import { useReplayTween } from "../useReplayTween";
import { Slider, VIZ_TEXT, VizHint } from "../shared";
import { sampleNormal } from "../sampling";
import { NORMAL_PRESETS, type NormalPreset } from "../data/distributionData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
/** Mean marker colour, shared with every other viz that marks a mean. */
const MEAN_C = "rgb(220, 38, 38)"; // red-600

// SVG geometry (viewBox units).
const W = 440;
const H = 396;
const PLOT_X0 = 52;
const PLOT_X1 = 424;
/** Right edge of the italic "x" and "z" names beside the two axes. */
const AXIS_NAME_X = PLOT_X0 - 16;
const PLOT_Y0 = 30;
const AXIS_Y = 256;
/** Second axis, marking z = (x − μ)/σ under the x-axis ticks. */
const Z_AXIS_Y = AXIS_Y + 30;
/** Row holding the two shading handles. */
const HANDLE_Y = Z_AXIS_Y + 42;

/** Points used to draw the curve across the window. */
const SAMPLES = 160;
/** Number of histogram bins the draws are collected into across the window. */
const BINS = 32;
/** How many recent draws are kept on screen as a rug. */
const RECENT_SHOWN = 40;
/**
 * The σ slider runs from this fraction of the preset's σ up to twice it. The
 * lower bound fixes the top of the y-axis (the narrowest curve is the
 * tallest), so it trades headroom to squeeze against how much of the plot the
 * opening curve fills: at 0.6 the curve opens at about 60% of the height.
 */
const SIGMA_MIN_FRAC = 0.6;
const SIGMA_MAX_FRAC = 2;

/** Share of a Normal distribution within k standard deviations, as the text rounds it. */
const WITHIN_K: Record<number, string> = { 1: "68%", 2: "95%", 3: "99.7%" };

/**
 * Cumulative probability Φ(z) of the standard Normal distribution.
 *
 * There is no closed form, so this uses Hart's rational approximation as
 * published by West (2005), which is accurate to about 15 decimal places:
 * far past the four the read-out prints, so the panel agrees with Excel's
 * NORM.S.DIST to the last digit shown.
 */
function normalCdf(z: number): number {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  const x = Math.abs(z);
  let tail: number;
  if (x > 37) {
    tail = 0;
  } else {
    const e = Math.exp((-x * x) / 2);
    if (x < 7.07106781186547) {
      let num = 3.52624965998911e-2 * x + 0.700383064443688;
      num = num * x + 6.37396220353165;
      num = num * x + 33.912866078383;
      num = num * x + 112.079291497871;
      num = num * x + 221.213596169931;
      num = num * x + 220.206867912376;
      let den = 8.83883476483184e-2 * x + 1.75566716318264;
      den = den * x + 16.064177579207;
      den = den * x + 86.7807322029461;
      den = den * x + 296.564248779674;
      den = den * x + 637.333633378831;
      den = den * x + 793.826512519948;
      den = den * x + 440.413735824752;
      tail = (e * num) / den;
    } else {
      // Far tail: a continued fraction converges faster than the rational form.
      let b = x + 0.65;
      b = x + 4 / b;
      b = x + 3 / b;
      b = x + 2 / b;
      b = x + 1 / b;
      tail = e / b / 2.506628274631;
    }
  }
  return z > 0 ? 1 - tail : tail;
}

/** Normal density f(x) for N(μ, σ²). */
function normalPdf(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Number of decimal places in a step such as 0.1 or 0.01. */
function decimalsOf(step: number): number {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

/**
 * Formats a value for display with at most `dp` decimals and no trailing
 * zeros, using a true minus sign. Infinite edges print as ∞.
 */
function show(v: number, dp: number): string {
  if (v === Infinity) return "∞";
  if (v === -Infinity) return "−∞";
  return String(+v.toFixed(dp)).replace("-", "−");
}

/** The same, for an Excel formula: plain ASCII minus so it can be pasted in. */
function excelNum(v: number, dp: number): string {
  return String(+v.toFixed(dp));
}

/** Fresh, empty histogram. */
const emptyBins = () => new Array<number>(BINS).fill(0);

/**
 * Interactive Normal density: shade an area to read off a probability, drag
 * μ and σ to see the curve and the z-axis move together, and run the example
 * to watch real draws fill the curve.
 *
 * @param params.preset — id of the example to open with, from
 *   `NORMAL_PRESETS`; defaults to the margarine tubs. All the numbers come
 *   from the preset, since MDX only forwards quoted string attributes.
 */
export default function NormalExplorer({ params }: { params: VizParams }) {
  const initial = NORMAL_PRESETS.find((p) => p.id === params.preset) ?? NORMAL_PRESETS[0];

  const [presetId, setPresetId] = useState(initial.id);
  const preset: NormalPreset =
    NORMAL_PRESETS.find((p) => p.id === presetId) ?? NORMAL_PRESETS[0];
  const [viewLo, viewHi] = preset.view;
  const viewSpan = viewHi - viewLo;
  const dp = decimalsOf(preset.step);
  const rv = preset.variable ?? "X";
  const isZ = rv === "Z";

  const [mu, setMu] = useState(initial.mu);
  const [sigma, setSigma] = useState(initial.sigma);
  // Shading edges; ±Infinity when a handle has been pulled off the axis.
  const [c, setC] = useState(initial.shade[0] ?? -Infinity);
  const [d, setD] = useState(initial.shade[1] ?? Infinity);

  /** Values drawn so far, how many landed in the shaded area, and their histogram. */
  const [drops, setDrops] = useState(0);
  const [hits, setHits] = useState(0);
  const [bins, setBins] = useState<number[]>(emptyBins);
  /** The latest draws, drawn as a rug; capped so the picture stays legible. */
  const [recent, setRecent] = useState<number[]>([]);
  /**
   * The outcome of the last single run, shown in words. Cleared by a batch,
   * which only updates the tally. `parts` holds each chore time when the
   * preset is built as a sum.
   */
  const [lastRun, setLastRun] = useState<{ value: number; parts?: number[] } | null>(null);

  /**
   * Bumped whenever a preset loads, purely to restart the entrance tween.
   * Keyed off this rather than μ and σ so dragging a slider does not send
   * the curve back to zero on every step.
   */
  const [replayKey, setReplayKey] = useState(0);
  const progress = useReplayTween([replayKey]);

  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = useSvgDrag(svgRef);
  // Value captured at pointer-down: `useSvgDrag` reports displacement from
  // the drag origin, not an absolute position.
  const dragOrigin = useRef(0);

  // Rounded to the step's decimals: 3 × 0.6 is 1.7999999999999998 in
  // floating point, which would offset the slider's step grid.
  const tidy = (v: number) => +v.toFixed(dp + 1);
  const sigmaMin = tidy(preset.sigma * SIGMA_MIN_FRAC);
  const sigmaMax = tidy(preset.sigma * SIGMA_MAX_FRAC);
  const muMin = tidy(viewLo + viewSpan * 0.2);
  const muMax = tidy(viewHi - viewSpan * 0.2);

  /**
   * Top of the y-axis, fixed per preset. With sliders it is the peak of the
   * narrowest curve allowed, so no σ can run off the top. A locked preset
   * cannot change shape, so it only needs headroom for a histogram that
   * overshoots the curve on a small sample.
   */
  const peakAt = (s: number) => 1 / (s * Math.sqrt(2 * Math.PI));
  const yTop = preset.locked ? peakAt(preset.sigma) * 1.3 : peakAt(sigmaMin) * 1.08;

  const xOf = (v: number) => PLOT_X0 + ((v - viewLo) / viewSpan) * (PLOT_X1 - PLOT_X0);
  const yOf = (v: number) => AXIS_Y - (Math.min(v, yTop) / yTop) * (AXIS_Y - PLOT_Y0);
  const toData = (dx: number) => (dx / (PLOT_X1 - PLOT_X0)) * viewSpan;

  const lo = Math.min(c, d);
  const hi = Math.max(c, d);
  const zLo = (lo - mu) / sigma;
  const zHi = (hi - mu) / sigma;
  const phiLo = normalCdf(zLo);
  const phiHi = normalCdf(zHi);
  const probability = phiHi - phiLo;
  const empty = lo === hi;

  const curvePath = useMemo(() => {
    const seg: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = viewLo + (viewSpan * i) / SAMPLES;
      seg.push(`${i ? "L" : "M"} ${xOf(x)} ${yOf(normalPdf(x, mu, sigma) * progress)}`);
    }
    return seg.join(" ");
    // `xOf`/`yOf` are pure functions of the preset's window and yTop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mu, sigma, progress, viewLo, viewSpan, yTop]);

  /** The shaded area between the (clipped) edges, closed along the axis. */
  const shadePath = useMemo(() => {
    const from = Math.max(lo, viewLo);
    const to = Math.min(hi, viewHi);
    if (to <= from) return "";
    const seg: string[] = [`M ${xOf(from)} ${AXIS_Y}`];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = from + ((to - from) * i) / SAMPLES;
      seg.push(`L ${xOf(x)} ${yOf(normalPdf(x, mu, sigma) * progress)}`);
    }
    seg.push(`L ${xOf(to)} ${AXIS_Y}`, "Z");
    return seg.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lo, hi, mu, sigma, progress, viewLo, viewHi, yTop]);

  /** Forget every draw so far. Called whenever the question on screen changes. */
  function clearRuns() {
    setDrops(0);
    setHits(0);
    setBins(emptyBins());
    setRecent([]);
    setLastRun(null);
  }

  /**
   * Draw `times` values and score them against the shaded area.
   *
   * A preset built as a sum draws each part and adds them, which is the
   * whole point of Example 21B: nobody told the viz the total was Normal.
   */
  function run(times: number) {
    const binW = viewSpan / BINS;
    const nextBins = [...bins];
    const kept: number[] = [];
    let landed = 0;
    let last: { value: number; parts?: number[] } | null = null;
    for (let i = 0; i < times; i++) {
      let value: number;
      let parts: number[] | undefined;
      if (preset.parts) {
        parts = preset.parts.map((p) => sampleNormal(p.mu, p.sigma));
        value = parts.reduce((s, v) => s + v, 0);
      } else {
        value = sampleNormal(mu, sigma);
      }
      if (value >= lo && value <= hi) landed += 1;
      const bin = Math.floor((value - viewLo) / binW);
      if (bin >= 0 && bin < BINS) nextBins[bin] += 1;
      kept.push(value);
      last = { value, parts };
    }
    setDrops((k) => k + times);
    setHits((k) => k + landed);
    setBins(nextBins);
    setRecent((prev) => [...prev, ...kept].slice(-RECENT_SHOWN));
    setLastRun(times === 1 ? last : null);
  }

  /** Load a preset, resetting μ, σ and the shading to its own figures. */
  function loadPreset(id: string) {
    const p = NORMAL_PRESETS.find((q) => q.id === id);
    if (!p) return;
    setPresetId(id);
    setMu(p.mu);
    setSigma(p.sigma);
    setC(p.shade[0] ?? -Infinity);
    setD(p.shade[1] ?? Infinity);
    setReplayKey((k) => k + 1);
    clearRuns();
  }

  /**
   * Starts a drag on shading handle c or d. Pulling a handle to either end of
   * the axis turns that edge into −∞ or ∞; otherwise it snaps to the
   * preset's step so the read-out shows tidy numbers like 253, not 252.97.
   */
  function dragShade(e: React.PointerEvent, current: number, set: (v: number) => void) {
    clearRuns();
    dragOrigin.current = Number.isFinite(current) ? current : current < 0 ? viewLo : viewHi;
    startDrag(e, (dx) => {
      const raw = dragOrigin.current + toData(dx);
      if (raw <= viewLo) set(-Infinity);
      else if (raw >= viewHi) set(Infinity);
      else set(snap(raw));
    });
  }

  /** Rounds a value onto the preset's step, e.g. 252.97 to 253. */
  const snap = (v: number) => +(Math.round(v / preset.step) * preset.step).toFixed(dp);

  /**
   * Arrow keys nudge a focused handle by one step. A drag moves in jumps of
   * about one screen pixel, which on the standard Normal preset is wider
   * than its 0.01 step, so exact values such as z = 1.28 are only reliably
   * reachable from the keyboard. Stepping past either end of the axis makes
   * the edge infinite, as a drag does.
   */
  function nudgeShade(e: React.KeyboardEvent, current: number, set: (v: number) => void) {
    const dir =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -1
          : 0;
    if (dir === 0) return;
    e.preventDefault();
    clearRuns();
    // An infinite edge steps back in from the end of the axis it sits at.
    const from = Number.isFinite(current) ? current : current < 0 ? viewLo : viewHi;
    const next = snap(from + dir * preset.step);
    if (next <= viewLo) set(-Infinity);
    else if (next >= viewHi) set(Infinity);
    else set(next);
  }

  // ---- Read-out text --------------------------------------------------
  const fx = (v: number) => show(v, dp);
  // Three decimals rather than the two a printed table uses: the
  // probabilities beside z are computed from the exact value, and z rounded
  // to two decimals would not reproduce them.
  const fz = (v: number) => show(v, 3);
  const p4 = (v: number) => v.toFixed(4);

  /** "Pr[251 ≤ X ≤ 253]", "Pr[X ≤ 250]" or "Pr[X ≥ 40]" for either variable. */
  function prOf(name: string, a: number, b: number, f: (v: number) => string) {
    if (a === -Infinity && b === Infinity) return `Pr[−∞ < ${name} < ∞]`;
    if (a === -Infinity) return `Pr[${name} ≤ ${f(b)}]`;
    if (b === Infinity) return `Pr[${name} ≥ ${f(a)}]`;
    return `Pr[${f(a)} ≤ ${name} ≤ ${f(b)}]`;
  }

  /**
   * The cumulative-probability step: nothing for a lower tail (Φ is the
   * answer), 1 − Φ for an upper tail, a difference of two Φ for a strip.
   */
  let terms = "";
  if (lo !== -Infinity && hi === Infinity) terms = `1 − ${p4(phiLo)}`;
  else if (lo !== -Infinity && hi !== Infinity) terms = `${p4(phiHi)} − ${p4(phiLo)}`;

  const sigmaEx =
    preset.sigmaExcel && sigma === preset.sigma ? preset.sigmaExcel : excelNum(sigma, 4);
  /** One cumulative probability as Excel would be asked for it. */
  const cdfEx = (x: number) =>
    isZ
      ? `NORM.S.DIST(${excelNum(x, dp)}, TRUE)`
      : `NORM.DIST(${excelNum(x, dp)}, ${excelNum(mu, 4)}, ${sigmaEx}, TRUE)`;
  // Nothing to compute when the shading is empty, including both edges at ∞.
  let excel = "";
  if (!empty) {
    if (lo === -Infinity && hi !== Infinity) excel = `=${cdfEx(hi)}`;
    else if (lo !== -Infinity && hi === Infinity) excel = `=1 - ${cdfEx(lo)}`;
    else if (lo !== -Infinity && hi !== Infinity) excel = `=${cdfEx(hi)} - ${cdfEx(lo)}`;
  }

  /** The one interpretive sentence: what the picture means right now. */
  function meaning(): string {
    if (empty && !Number.isFinite(lo))
      return "Both handles are off the same end of the axis, so nothing is shaded. Pull one back in.";
    if (empty)
      return "The shaded strip has no width, so the probability is zero. A continuous variable never lands on an exact value.";
    if (lo === -Infinity && hi === Infinity)
      return "Everything is shaded, and the total area under any density is 1.";
    if (lo !== -Infinity && hi !== Infinity) {
      const k = Math.round(zHi);
      if (WITHIN_K[k] && Math.abs(zHi - k) < 0.02 && Math.abs(zLo + k) < 0.02)
        return `This is μ ± ${k}σ. About ${WITHIN_K[k]} of every Normal distribution lies within ${k} standard deviation${k > 1 ? "s" : ""} of its mean.`;
      return `The area runs from z = ${fz(zLo)} to z = ${fz(zHi)}. That stretch of z holds the same area in every Normal distribution, which is why a single table is enough.`;
    }
    const edge = lo === -Infinity ? zHi : zLo;
    const side = lo === -Infinity ? "below" : "above";
    if (isZ)
      return `${(probability * 100).toFixed(1)}% of the distribution lies ${side} z = ${fz(edge)}: the percentage points in the text are found this way round.`;
    return `The tail starts ${fz(Math.abs(edge))} standard deviations ${
      edge < 0 ? "below" : "above"
    } the mean. Any Normal distribution has this same area ${side} that many standard deviations.`;
  }

  /** z-axis ticks: every whole number of standard deviations inside the window. */
  const zTicks: number[] = [];
  for (let k = -6; k <= 6; k++) {
    const x = mu + k * sigma;
    if (x >= viewLo && x <= viewHi) zTicks.push(k);
  }
  /** Five evenly spaced x ticks across the fixed window. */
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => viewLo + viewSpan * f);
  const binW = viewSpan / BINS;
  const peakY = yOf(peakAt(sigma) * progress);

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      {/* Preset selector */}
      <div className="flex flex-wrap gap-1.5">
        {NORMAL_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => loadPreset(p.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              presetId === p.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <VizHint>
        Drag <strong className="font-semibold">c</strong> and{" "}
        <strong className="font-semibold">d</strong> to shade an area (pull one off the end
        for −∞ or ∞), then press Run to take real {preset.drawNoun} and see how many land in
        it.
      </VizHint>

      {/* Run the experiment */}
      <div className="rounded-lg border border-[color:var(--color-line)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mr-0.5">
            Run it
          </span>
          {[1, 500].map((times) => (
            <button
              key={times}
              onClick={() => run(times)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700"
            >
              {times === 1 ? preset.drawOne : preset.drawMany}
            </button>
          ))}
          <button
            onClick={clearRuns}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-500)] transition-colors hover:border-blue-400"
          >
            Reset
          </button>
        </div>
        {lastRun && (
          <p className="mt-1.5 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
            {lastRun.parts
              ? `${lastRun.parts
                  .map((v, i) => `${preset.parts?.[i]?.name} ${v.toFixed(1)}`)
                  .join(" + ")} = ${lastRun.value.toFixed(1)} ${preset.unit}`
              : `That one came out at ${show(lastRun.value, dp + 1)} ${preset.unit}`}
          </p>
        )}
        {drops > 0 && (
          <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)]">
            <span className="tabular-nums">{hits.toLocaleString()}</span> of{" "}
            <span className="tabular-nums">{drops.toLocaleString()}</span> {preset.drawNoun}{" "}
            landed in the shaded area:{" "}
            <span className="font-semibold tabular-nums">{(hits / drops).toFixed(4)}</span>{" "}
            against a predicted <span className="tabular-nums">{p4(probability)}</span>
          </p>
        )}
      </div>

      {/* μ and σ, or the reason they are fixed for this example */}
      {preset.locked ? (
        <p className="text-[12px] leading-snug text-[color:var(--color-ink-700)]">
          {preset.locked}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Slider
            label="μ (mean)"
            value={mu}
            min={muMin}
            max={muMax}
            step={preset.step}
            format={(v) => show(v, dp)}
            onChange={(v) => {
              setMu(v);
              clearRuns();
            }}
          />
          <Slider
            label="σ (std dev)"
            value={sigma}
            min={sigmaMin}
            max={sigmaMax}
            step={preset.step}
            format={(v) => show(v, dp + 1)}
            onChange={(v) => {
              setSigma(v);
              clearRuns();
            }}
          />
        </div>
      )}

      {/* The density */}
      <div className="shrink-0 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto max-h-[520px] select-none"
        >
          <title>
            Normal density for {rv} with mean {fx(mu)} and standard deviation{" "}
            {show(sigma, dp + 2)}, {empty
              ? "no area shaded"
              : `with the area ${prOf(rv, lo, hi, fx)} shaded, equal to ${p4(probability)}`}
          </title>

          {/* Horizontal gridlines and y-axis ticks */}
          {[0, 0.5, 1].map((frac) => {
            const v = yTop * frac;
            return (
              <g key={frac}>
                <line
                  x1={PLOT_X0}
                  y1={yOf(v)}
                  x2={PLOT_X1}
                  y2={yOf(v)}
                  stroke="var(--color-line)"
                  strokeWidth="1"
                  strokeDasharray={frac === 0 ? undefined : "3 3"}
                />
                <text
                  x={PLOT_X0 - 6}
                  y={yOf(v) + 3}
                  textAnchor="end"
                  fontSize={VIZ_TEXT.axisTick}
                  fill="var(--color-ink-500)"
                  className="tabular-nums"
                >
                  {v.toFixed(yTop < 0.1 ? 3 : 2)}
                </text>
              </g>
            );
          })}
          <text
            x={14}
            y={(PLOT_Y0 + AXIS_Y) / 2}
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
            textAnchor="middle"
            transform={`rotate(-90 14 ${(PLOT_Y0 + AXIS_Y) / 2})`}
          >
            f({rv.toLowerCase()})
          </text>

          {/* Draws so far as a density histogram, pale and behind the curve
              so the theory reads on top of the data. Heights are share of all
              draws divided by bin width, the same scale as f(x). */}
          {drops > 0 &&
            bins.map((count, i) =>
              count === 0 ? null : (
                <rect
                  key={i}
                  x={xOf(viewLo + i * binW) + 0.5}
                  y={yOf(count / (drops * binW))}
                  width={xOf(viewLo + binW) - PLOT_X0 - 1}
                  height={AXIS_Y - yOf(count / (drops * binW))}
                  fill={ACCENT}
                  fillOpacity={0.16}
                />
              ),
            )}

          {shadePath && <path d={shadePath} fill={ACCENT} fillOpacity={0.3} />}
          <path d={curvePath} fill="none" stroke={ACCENT_DARK} strokeWidth="2" />

          {/* The latest draws as a rug standing on the axis. A draw has only
              a position along x; dots at a height inside the curve would
              suggest the height meant something. */}
          {recent.map((v, i) =>
            v < viewLo || v > viewHi ? null : (
              <line
                key={i}
                x1={xOf(v)}
                y1={AXIS_Y}
                x2={xOf(v)}
                y2={AXIS_Y - 11}
                stroke={v >= lo && v <= hi ? ACCENT_DARK : "var(--color-ink-500)"}
                strokeWidth="1.5"
                strokeOpacity={0.65}
              />
            ),
          )}

          {/* Mean marker: red, dashed, labelled above the peak with a white
              halo, the treatment every viz in the book gives a mean. */}
          <g>
            <line
              x1={xOf(mu)}
              y1={peakY}
              x2={xOf(mu)}
              y2={AXIS_Y}
              stroke={MEAN_C}
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text
              x={xOf(mu)}
              y={peakY - 7}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fontWeight="600"
              fill={MEAN_C}
              stroke="white"
              strokeWidth="3"
              paintOrder="stroke"
            >
              &#956; = {fx(mu)}
            </text>
          </g>

          {/* x-axis */}
          <line
            x1={PLOT_X0}
            y1={AXIS_Y}
            x2={PLOT_X1}
            y2={AXIS_Y}
            stroke="var(--color-ink-900)"
            strokeWidth="1"
          />
          {xTicks.map((t) => (
            <text
              key={t}
              x={xOf(t)}
              y={AXIS_Y + 14}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-500)"
              className="tabular-nums"
            >
              {show(t, dp)}
            </text>
          ))}
          {/* Axis names sit in the left margin, clear of the first tick,
              which is centred on the plot's left edge. */}
          <text
            x={AXIS_NAME_X}
            y={AXIS_Y + 14}
            textAnchor="end"
            fontSize={VIZ_TEXT.axisTick}
            fontStyle="italic"
            fill="var(--color-ink-700)"
          >
            {rv.toLowerCase()}
          </text>

          {/* z-axis: whole standard deviations from the mean. It rides along
              with μ and stretches with σ, which is the standardisation
              z = (x − μ)/σ drawn as a picture. The standard Normal preset
              already has z on its main axis, so it does without. */}
          {!isZ && (
            <g>
              <line
                x1={PLOT_X0}
                y1={Z_AXIS_Y}
                x2={PLOT_X1}
                y2={Z_AXIS_Y}
                stroke="var(--color-ink-500)"
                strokeWidth="1"
              />
              <text
                x={AXIS_NAME_X}
                y={Z_AXIS_Y + 4}
                textAnchor="end"
                fontSize={VIZ_TEXT.axisTick}
                fontStyle="italic"
                fill="var(--color-ink-700)"
              >
                z
              </text>
              {zTicks.map((k) => (
                <g key={k}>
                  <line
                    x1={xOf(mu + k * sigma)}
                    y1={Z_AXIS_Y - 4}
                    x2={xOf(mu + k * sigma)}
                    y2={Z_AXIS_Y + 4}
                    stroke="var(--color-ink-500)"
                    strokeWidth="1"
                  />
                  <text
                    x={xOf(mu + k * sigma)}
                    y={Z_AXIS_Y + 15}
                    textAnchor="middle"
                    fontSize={VIZ_TEXT.axisTick}
                    fill={k === 0 ? MEAN_C : "var(--color-ink-500)"}
                    className="tabular-nums"
                  >
                    {show(k, 0)}
                  </text>
                </g>
              ))}
            </g>
          )}

          <text
            x={(PLOT_X0 + PLOT_X1) / 2}
            y={HANDLE_Y + 42}
            textAnchor="middle"
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
          >
            {preset.axisLabel}
          </text>

          {/* Draggable shading handles c and d. An infinite edge parks its
              handle at that end of the axis and labels it ∞. */}
          {([
            [c, setC, "c"],
            [d, setD, "d"],
          ] as const).map(([v, set, name]) => {
            const px = xOf(clampN(v, viewLo, viewHi));
            return (
              <g
                key={name}
                className="cursor-ew-resize"
                style={{ touchAction: "none" }}
                onPointerDown={(e) => dragShade(e, v, set)}
                onKeyDown={(e) => nudgeShade(e, v, set)}
                tabIndex={0}
                role="slider"
                aria-label={`Shading handle ${name}`}
                aria-valuenow={clampN(v, viewLo, viewHi)}
                aria-valuemin={viewLo}
                aria-valuemax={viewHi}
                aria-valuetext={fx(v)}
              >
                {/* Invisible wider hit area: c and d can sit on top of each other. */}
                <rect
                  x={px - 22}
                  y={AXIS_Y}
                  width={44}
                  height={HANDLE_Y + 26 - AXIS_Y}
                  fill="transparent"
                />
                <line
                  x1={px}
                  y1={AXIS_Y}
                  x2={px}
                  y2={HANDLE_Y - 10}
                  stroke={ACCENT}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <rect x={px - 11} y={HANDLE_Y - 10} width={22} height={18} rx="5" fill={ACCENT} />
                <text
                  x={px}
                  y={HANDLE_Y + 3}
                  textAnchor="middle"
                  fontSize={VIZ_TEXT.caption}
                  fontWeight="700"
                  fill="white"
                >
                  {name}
                </text>
                <text
                  x={px}
                  y={HANDLE_Y + 21}
                  textAnchor="middle"
                  fontSize={VIZ_TEXT.axisTick}
                  fill={ACCENT_DARK}
                  className="tabular-nums"
                >
                  {fx(v)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            {preset.source}
          </p>
          <VizGuide
            steps={[
              "Pick an example along the top. Each one is worked through in this unit.",
              "Drag the handles c and d to shade an area. Pull a handle off either end of the axis to make that edge −∞ or ∞.",
              "Read the working below the chart: each edge is turned into z = (x − μ)/σ, then the cumulative probabilities are subtracted.",
              "Move the μ and σ sliders. The z-axis moves and stretches with the curve, so the same z values always cut off the same area.",
              "Press Run to take real values. They pile up as pale bars under the curve, and the share landing in the shaded area closes on the predicted probability.",
            ]}
          />
        </div>
        {/* The working, then the answer: standardise each edge, then subtract
            cumulative probabilities. Seeing the substitution is most of the
            lesson; the answer alone is something to copy down. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)]">
          {empty ? (
            "No area shaded"
          ) : (
            <>
              {prOf(rv, lo, hi, fx)}
              {!isZ && lo !== hi && !(lo === -Infinity && hi === Infinity) && (
                <> = {prOf("Z", zLo, zHi, fz)}</>
              )}
              {terms && <> = {terms}</>} ={" "}
              <span className="font-semibold tabular-nums">{p4(probability)}</span>
            </>
          )}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
          {/* Coloured to match the marker on the chart. */}
          <span style={{ color: MEAN_C }}>μ = {fx(mu)}</span> &nbsp;·&nbsp; σ ={" "}
          {show(sigma, dp + 3)}
          {excel && (
            <>
              {" "}
              &nbsp;·&nbsp; Excel: <span className="font-mono text-[11px]">{excel}</span>
            </>
          )}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{meaning()}</p>
      </div>
    </div>
  );
}
