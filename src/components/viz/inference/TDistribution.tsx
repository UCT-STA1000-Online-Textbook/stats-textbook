/**
 * Student's t-distribution viz, used by Module 5, WU5 (`m5-unknown-sigma`).
 *
 * The unit's point is that once σ is unknown and replaced by the sample's own
 * s, the statistic t = (x̄ − μ)/(s/√n) is no longer N(0, 1): s varies from
 * sample to sample, which gives t heavier tails, the more so the smaller the
 * sample. The viz lets the student see that happen rather than take it on
 * trust:
 *
 *   - A strip at the top shows one sample: its values as a rug, the true μ,
 *     and x̄ ± s as a bracket, so the student sees s change from run to run.
 *   - The chart below piles up the t of every run as pale bars, under the
 *     t-curve with n − 1 degrees of freedom (blue) and N(0, 1) (grey).
 *   - The example's cut-off from Excel (T.INV or T.INV.2T) is shaded, and the
 *     z cut-off the student might wrongly reach for is drawn beside it. The
 *     read-out counts how many runs land beyond each: about α beyond the t
 *     cut-off, noticeably more beyond the z one when n is small.
 *   - The n slider moves the degrees of freedom, and the t-curve closes in on
 *     N(0, 1) as n grows, which is the picture the brief asked for in place
 *     of the textbook's static graph on p200.
 *
 * Every run samples with the true mean the preset fixes (μ₀ for a test, so
 * H₀ is true), using the example's s as σ.
 *
 * Default tier: hand-rolled SVG. The only animation is a single run's t
 * dropping onto the axis, via `useReplayTween`.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { Slider, VIZ_TEXT, VizHint } from "../shared";
import { sampleNormal } from "../sampling";
import { normalPdf } from "../normal";
import { tCdf, tInv, tPdf } from "../tdist";
import { useReplayTween } from "../useReplayTween";
import { fmt, pct, sub, trim } from "./format";
import { T_PRESETS, type TPreset, type Tail } from "../data/inferenceData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const INK = "rgb(15, 23, 42)"; // slate-900, the example's observed t
const GREY = "rgb(148, 163, 184)"; // slate-400, the N(0, 1) curve and z cut-off
const MEAN_C = "rgb(0, 0, 0)"; // black, the book-wide mean colour

/**
 * The z cut-offs a student might use by mistake, from =NORM.S.INV, keyed by
 * α. A two-sided cut-off leaves α/2 in each tail.
 */
const Z_CUT: Record<"one" | "two", Record<number, number>> = {
  one: { 0.05: 1.6449, 0.01: 2.3263 },
  two: { 0.05: 1.96, 0.01: 2.5758 },
};

// SVG geometry (viewBox units).
const W = 440;
const PLOT_X0 = 20;
const PLOT_X1 = 420;
/** Sample strip: one sample's values, μ and x̄ ± s. */
const STRIP_TOP = 22;
const STRIP_AXIS = 58;
/** Main chart: the pile of t values under the two curves. */
const CHART_CAPTION_Y = 98;
const PLOT_Y0 = 120;
const AXIS_Y = 272;
const H = AXIS_Y + 36;
/** Visible stretch of the t-axis. Values beyond it still count in the tally. */
const T_LO = -5;
const T_HI = 5;
const BIN_W = 0.25;
const BINS = Math.round((T_HI - T_LO) / BIN_W);
/** Runs needed before the bars, not just the curves, set the chart's height. */
const MIN_FOR_SCALE = 50;
const CURVE_STEPS = 200;
/**
 * Smallest n on the slider. At n = 2 there is one degree of freedom, a
 * distribution so heavy-tailed that most of the pile falls off the chart.
 */
const MIN_N = 3;
/** Largest n. By 59 degrees of freedom t and N(0, 1) are hard to tell apart. */
const MAX_N = 60;
/** Runs needed before the read-out quotes percentages beyond the cut-offs. */
const MIN_FOR_PERCENT = 20;
/** Degrees of freedom from which the interpretation calls t "close to" N(0, 1). */
const CLOSE_DF = 30;

/** Whether a t lies beyond cut-off c, in the direction(s) the tail names. */
function beyond(t: number, tail: Tail, c: number): boolean {
  if (tail === "lower") return t < -c;
  if (tail === "upper") return t > c;
  return Math.abs(t) > c;
}

/** Probability, under t with `df` degrees of freedom, of lying beyond c. */
function tailProb(c: number, tail: Tail, df: number): number {
  const one = 1 - tCdf(c, df);
  return tail === "two" ? 2 * one : one;
}

/** "beyond ±2.2622", "above 1.7291" or "below −2.0150". */
function beyondText(c: number, tail: Tail, dp: number): string {
  if (tail === "lower") return `below ${fmt(-c, dp)}`;
  if (tail === "upper") return `above ${fmt(c, dp)}`;
  return `beyond ±${fmt(c, dp)}`;
}

/** One sample, kept so the strip and the read-out can show it. */
interface Sample {
  values: number[];
  mean: number;
  sd: number;
  t: number;
}

/** Running tally of simulated t values. */
interface Tally {
  /** How many t values fell in each bin, from `T_LO`. */
  counts: number[];
  /** Every run, including any whose t fell off the chart. */
  total: number;
  /** Runs beyond the t cut-off. */
  beyondT: number;
  /** Runs beyond the z cut-off. */
  beyondZ: number;
}

function emptyTally(): Tally {
  return { counts: new Array<number>(BINS).fill(0), total: 0, beyondT: 0, beyondZ: 0 };
}

/** Draws n values from N(μ, σ²) and works out x̄, s and t. */
function takeSample(mu: number, sigma: number, n: number): Sample {
  const values = Array.from({ length: n }, () => sampleNormal(mu, sigma));
  const mean = values.reduce((a, v) => a + v, 0) / n;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1));
  return { values, mean, sd, t: (mean - mu) / (sd / Math.sqrt(n)) };
}

/**
 * Take sample after sample, work out each one's t with s in place of σ, and
 * compare where they land with the t-curve and with N(0, 1).
 *
 * @param params.preset — id of the worked example to open with, from
 *   `T_PRESETS`; defaults to the flights of Example 1A. The starting n comes
 *   from the preset: MDX only forwards quoted string attributes.
 */
export default function TDistribution({ params }: { params: VizParams }) {
  const initial = T_PRESETS.find((p) => p.id === params.preset) ?? T_PRESETS[0];

  const [preset, setPreset] = useState<TPreset>(initial);
  const [n, setN] = useState(initial.n);
  const [tally, setTally] = useState<Tally>(emptyTally);
  /** The most recent single run; null after a batch or a reset. */
  const [last, setLast] = useState<Sample | null>(null);
  const [runId, setRunId] = useState(0);
  const drop = useReplayTween([runId], 420);

  const df = n - 1;
  const tail = preset.tail;
  const alpha = preset.alpha;
  // Cut-off magnitudes. A lower-tail cut-off sits at −c.
  const c = tail === "two" ? -tInv(alpha / 2, df) : tInv(1 - alpha, df);
  const zc = Z_CUT[tail === "two" ? "two" : "one"][alpha];
  const pZ = tailProb(zc, tail, df);
  const atExample = n === preset.n;

  const xOf = (t: number) => PLOT_X0 + ((t - T_LO) / (T_HI - T_LO)) * (PLOT_X1 - PLOT_X0);
  const clampX = (t: number) => Math.min(PLOT_X1, Math.max(PLOT_X0, xOf(t)));

  /** Forget every run so far. Called whenever the question on screen changes. */
  function clearTally() {
    setTally(emptyTally());
    setLast(null);
  }

  /** Take `times` fresh samples, work out each t and score it. */
  function run(times: number) {
    const counts = tally.counts.slice();
    let { total, beyondT, beyondZ } = tally;
    let sample: Sample | null = null;
    for (let k = 0; k < times; k++) {
      sample = takeSample(preset.mu, preset.s, n);
      const bin = Math.floor((sample.t - T_LO) / BIN_W);
      if (bin >= 0 && bin < BINS) counts[bin] += 1;
      total += 1;
      if (beyond(sample.t, tail, c)) beyondT += 1;
      if (beyond(sample.t, tail, zc)) beyondZ += 1;
    }
    setTally({ counts, total, beyondT, beyondZ });
    if (times === 1) {
      setLast(sample);
      setRunId((k) => k + 1);
    } else {
      setLast(null);
    }
  }

  function loadPreset(p: TPreset) {
    setPreset(p);
    setN(p.n);
    clearTally();
  }

  function changeN(next: number) {
    setN(next);
    clearTally();
  }

  // --- Main chart scale ---
  const density = (count: number) => (tally.total > 0 ? count / (tally.total * BIN_W) : 0);
  const maxObserved = tally.counts.reduce((m, k) => Math.max(m, density(k)), 0);
  // N(0, 1) always peaks above any t-curve, so it sets the height until there
  // are enough runs for the bars to have a shape (as in `ZTest`).
  const top = Math.max(normalPdf(0, 0, 1), tally.total >= MIN_FOR_SCALE ? maxObserved : 0) * 1.12;
  const yOf = (f: number) => AXIS_Y - Math.min(1, f / top) * (AXIS_Y - PLOT_Y0);

  const tPoints = (from: number, to: number) =>
    Array.from({ length: CURVE_STEPS + 1 }, (_, k) => {
      const t = from + (k / CURVE_STEPS) * (to - from);
      return `${xOf(t).toFixed(1)} ${yOf(tPdf(t, df)).toFixed(1)}`;
    });
  const tPath = `M ${tPoints(T_LO, T_HI).join(" L ")}`;
  const zPath = `M ${Array.from({ length: CURVE_STEPS + 1 }, (_, k) => {
    const t = T_LO + (k / CURVE_STEPS) * (T_HI - T_LO);
    return `${xOf(t).toFixed(1)} ${yOf(normalPdf(t, 0, 1)).toFixed(1)}`;
  }).join(" L ")}`;
  /** A filled area under the t-curve between two values. */
  const area = (from: number, to: number) =>
    `M ${xOf(from)} ${AXIS_Y} L ${tPoints(from, to).join(" L ")} L ${xOf(to)} ${AXIS_Y} Z`;

  const lowerShaded = tail === "lower" || tail === "two";
  const upperShaded = tail === "upper" || tail === "two";
  // Labels go on the cut-off side: the lower side for a lower-tail cut-off,
  // otherwise the upper side (a two-sided cut-off is labelled once, with ±).
  // The t cut-off is always further out than the z one, so its label points
  // outwards and the z label inwards, and the two never overlap.
  const side = tail === "lower" ? -1 : 1;
  const tLabel = `t${sub(df)}: ${tail === "two" ? "±" : ""}${fmt(side * c, 4)}`;
  /** Whether a cut-off value is inside the visible stretch of the axis. */
  const cOnChart = (x: number) => x > T_LO && x < T_HI;
  // The t label normally sits outside its line. Where it would run off the
  // chart it moves inside the line, and if the cut-off itself is off the
  // chart (bread at n = 3 has ±9.9248) the label is pinned to the edge with
  // an arrow pointing the way. Width is estimated at ~5.5 units a character.
  const tLabelW = tLabel.length * 5.5;
  const tx = xOf(side * c);
  const tLabelPos: { x: number; anchor: "start" | "end"; text: string } = !cOnChart(side * c)
    ? side > 0
      ? { x: PLOT_X1, anchor: "end", text: `${tLabel} →` }
      : { x: PLOT_X0, anchor: "start", text: `← ${tLabel}` }
    : side > 0
      ? tx + 4 + tLabelW <= W
        ? { x: tx + 4, anchor: "start", text: tLabel }
        : { x: tx - 4, anchor: "end", text: tLabel }
      : tx - 4 - tLabelW >= 0
        ? { x: tx - 4, anchor: "end", text: tLabel }
        : { x: tx + 4, anchor: "start", text: tLabel };
  const zLabel = `z: ${tail === "two" ? "±" : ""}${fmt(side * zc, 2)}`;

  const tObs = Number(((preset.xbar - preset.mu) / (preset.s / Math.sqrt(preset.n))).toFixed(2));
  const showObserved = preset.kind === "test" && atExample;

  // --- Sample strip: one sample's values on the example's own scale ---
  const sLo = preset.mu - 3.5 * preset.s;
  const sHi = preset.mu + 3.5 * preset.s;
  const sxOf = (v: number) =>
    Math.min(PLOT_X1, Math.max(PLOT_X0, PLOT_X0 + ((v - sLo) / (sHi - sLo)) * (PLOT_X1 - PLOT_X0)));
  const stripTicks = [-3, -1.5, 0, 1.5, 3].map((k) => preset.mu + k * preset.s);

  // --- Read-out ---
  const alphaPct = `${Math.round(alpha * 100)}%`;
  const excel =
    tail === "two"
      ? `=T.INV.2T(${alpha}, ${df}) = ${fmt(c, 4)}`
      : tail === "upper"
        ? `=T.INV(${Number((1 - alpha).toFixed(2))}, ${df}) = ${fmt(c, 4)}`
        : `=T.INV(${alpha}, ${df}) = ${fmt(-c, 4)}`;
  const excelMeaning =
    preset.kind === "interval"
      ? `so Pr(−${fmt(c, 4)} < t${sub(df)} < ${fmt(c, 4)}) = ${1 - alpha}`
      : `so reject H₀ if t is ${beyondText(c, tail, 4)}`;

  const se = `${trim(preset.s)}/√${preset.n}`;
  const half = (c * preset.s) / Math.sqrt(preset.n);
  const exampleRejects = beyond(tObs, tail, c);
  const exampleWorking =
    preset.kind === "interval"
      ? {
          working: `x̄ ± t × s/√n = ${trim(preset.xbar)} ± ${fmt(c, 4)} × ${se} = `,
          answer: `(${fmt(preset.xbar - half, 2)}, ${fmt(preset.xbar + half, 2)})`,
        }
      : {
          working: `t = (${trim(preset.xbar)} − ${trim(preset.mu)})/(${se}) = ${fmt(tObs, 2)} `,
          answer: `${exampleRejects ? (tail === "lower" ? "<" : ">") : tail === "lower" ? "≥" : "≤"} ${fmt(side * c, 4)}: ${exampleRejects ? "reject" : "do not reject"} H₀`,
        };

  const runText = last
    ? `This sample: x̄ = ${fmt(last.mean, preset.dp + 1)}, s = ${fmt(last.sd, preset.dp + 1)}, so t = (${fmt(last.mean, preset.dp + 1)} − ${trim(preset.mu)})/(${fmt(last.sd, preset.dp + 1)}/√${n}) = ${fmt(last.t, 2)}. `
    : "";
  // Percentages from a handful of runs are noise, so they wait for a batch.
  const tallyText =
    tally.total >= MIN_FOR_PERCENT
      ? `${tally.total.toLocaleString()} runs: ${pct(tally.beyondT / tally.total)} ${beyondText(c, tail, 4)} (should be ${alphaPct}), ${pct(tally.beyondZ / tally.total)} ${beyondText(zc, tail, 2)} (t${sub(df)} says ${pct(pZ)}).`
      : `n = ${n}, so s has n − 1 = ${df} degrees of freedom.`;

  /** One plain sentence on what the picture currently means. */
  const interpretation =
    df < CLOSE_DF
      ? `With ${df} degrees of freedom s is itself unreliable, so t has heavier tails than z: the z cut-off ${tail === "two" ? "±" : ""}${fmt(side * zc, 2)} would leave ${pct(pZ)} of t beyond it, not ${alphaPct}.`
      : `With ${df} degrees of freedom s is a reliable stand-in for σ, so t is close to N(0, 1): the z cut-off would leave ${pct(pZ)} beyond it, near the ${alphaPct} intended.`;

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
    }`;
  const runButton =
    "px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700";

  const lastX = last ? clampX(last.t) : 0;
  const dotY = PLOT_Y0 + (AXIS_Y - 4 - PLOT_Y0) * drop;
  const lastBin = last ? Math.floor((last.t - T_LO) / BIN_W) : -1;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="flex flex-wrap gap-1.5">
        {T_PRESETS.map((p) => (
          <button key={p.id} onClick={() => loadPreset(p)} className={chip(preset.id === p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <VizHint>
        Press <strong className="font-semibold">Repeat 500 times</strong> and count the t
        values beyond each cut-off. Then drag n up and watch t close in on N(0, 1).
      </VizHint>

      <div className="rounded-lg border border-[color:var(--color-line)] px-3 py-2 space-y-2">
        <Slider
          label="n, the sample size"
          mono={false}
          value={n}
          min={MIN_N}
          max={MAX_N}
          step={1}
          format={(v) => String(v)}
          onChange={changeN}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mr-0.5">
            Run it
          </span>
          <button onClick={() => run(1)} className={runButton}>
            {preset.drawOne(n)}
          </button>
          <button onClick={() => run(500)} className={runButton}>
            Repeat 500 times
          </button>
          <button
            onClick={clearTally}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-500)] transition-colors hover:border-blue-400"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[520px] select-none">
          <title>
            {`Top: one sample of ${n} ${preset.items}. Bottom: ${tally.total} simulated t values against the t-distribution with ${df} degrees of freedom and the standard Normal curve, with the cut-off ${excel} shaded.`}
          </title>

          {/* ---- Sample strip ---- */}
          <text x={PLOT_X0} y={12} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
            One sample of {n} {preset.items}
          </text>
          {last ? (
            <g>
              {/* Values as a rug: only their position along the axis means anything. */}
              {last.values.map((v, i) => (
                <line
                  key={i}
                  x1={sxOf(v)}
                  y1={STRIP_AXIS}
                  x2={sxOf(v)}
                  y2={STRIP_AXIS - 10}
                  stroke={ACCENT}
                  strokeWidth="1.5"
                  strokeOpacity={0.6}
                />
              ))}
              {/* x̄ ± s as a bracket, so the run-to-run change in s is visible. */}
              <line
                x1={sxOf(last.mean - last.sd)}
                y1={STRIP_AXIS - 18}
                x2={sxOf(last.mean + last.sd)}
                y2={STRIP_AXIS - 18}
                stroke={ACCENT_DARK}
                strokeWidth="1.5"
              />
              {[last.mean - last.sd, last.mean + last.sd].map((v) => (
                <line key={v} x1={sxOf(v)} y1={STRIP_AXIS - 22} x2={sxOf(v)} y2={STRIP_AXIS - 14} stroke={ACCENT_DARK} strokeWidth="1.5" />
              ))}
              <line x1={sxOf(last.mean)} y1={STRIP_AXIS - 26} x2={sxOf(last.mean)} y2={STRIP_AXIS} stroke={ACCENT_DARK} strokeWidth="2" />
              <text
                x={sxOf(last.mean + last.sd) + 4}
                y={STRIP_AXIS - 15}
                fontSize={VIZ_TEXT.axisTick}
                fontWeight="600"
                fill={ACCENT_DARK}
                stroke="white"
                strokeWidth="3"
                paintOrder="stroke"
              >
                x̄ ± s
              </text>
            </g>
          ) : (
            // Left-aligned so it stays clear of the μ line in the middle.
            <text x={PLOT_X0} y={STRIP_AXIS - 10} fontSize={VIZ_TEXT.caption} fill="var(--color-ink-400)">
              Press {preset.drawOne(n)} to take one
            </text>
          )}
          {/* The true mean the runs sample from: black and dashed, as every mean marker. */}
          <line
            x1={sxOf(preset.mu)}
            y1={STRIP_TOP}
            x2={sxOf(preset.mu)}
            y2={STRIP_AXIS}
            stroke={MEAN_C}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={sxOf(preset.mu) + 4}
            y={STRIP_TOP + 4}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={MEAN_C}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            μ = {trim(preset.mu)}
          </text>
          <line x1={PLOT_X0} y1={STRIP_AXIS} x2={PLOT_X1} y2={STRIP_AXIS} stroke="var(--color-ink-900)" />
          {stripTicks.map((v) => (
            <text
              key={v}
              x={sxOf(v)}
              y={STRIP_AXIS + 12}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-500)"
              className="tabular-nums"
            >
              {trim(v)}
            </text>
          ))}

          {/* ---- Main chart ---- */}
          <text x={PLOT_X0} y={CHART_CAPTION_Y} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
            t = (x̄ − μ)/(s/√n) from every run, against{" "}
            <tspan fill={ACCENT_DARK}>t{sub(df)}</tspan> and{" "}
            <tspan fill={GREY}>N(0, 1)</tspan>
          </text>

          {/* Simulated t values as pale bars, under everything else */}
          {tally.counts.map((k, i) => {
            // A single run's bar waits for its dot to land.
            const shown = k - (last && drop < 1 && i === lastBin ? 1 : 0);
            if (shown <= 0) return null;
            const x0 = xOf(T_LO + i * BIN_W);
            const y = yOf(density(shown));
            return (
              <rect
                key={i}
                x={x0}
                y={y}
                width={Math.max(0.5, xOf(T_LO + BIN_W) - xOf(T_LO) - 0.5)}
                height={AXIS_Y - y}
                fill={ACCENT}
                fillOpacity={0.2}
              />
            );
          })}

          {/* The t cut-off region */}
          {/* At tiny n a cut-off can lie past the edge of the chart, and then
              there is no visible tail to shade. */}
          {lowerShaded && -c > T_LO && <path d={area(T_LO, -c)} fill={ACCENT} fillOpacity={0.35} />}
          {upperShaded && c < T_HI && <path d={area(c, T_HI)} fill={ACCENT} fillOpacity={0.35} />}

          <path d={zPath} fill="none" stroke={GREY} strokeWidth="1.5" />
          <path d={tPath} fill="none" stroke={ACCENT_DARK} strokeWidth="2" />

          {/* The example's own t, for the hypothesis-test examples */}
          {showObserved && (
            <g>
              <line x1={clampX(tObs)} y1={PLOT_Y0 + 4} x2={clampX(tObs)} y2={AXIS_Y} stroke={INK} strokeWidth="2" />
              <text
                x={clampX(tObs)}
                y={PLOT_Y0}
                textAnchor="middle"
                fontSize={VIZ_TEXT.axisTick}
                fontWeight="600"
                fill={INK}
                stroke="white"
                strokeWidth="3"
                paintOrder="stroke"
              >
                example: t = {fmt(tObs, 2)}
              </text>
            </g>
          )}

          {/* Cut-off lines. Drawn after the observed t so their halo keeps
              the labels legible where they cross it. */}
          {[side * c, ...(tail === "two" ? [-c] : [])].filter(cOnChart).map((x) => (
            <line key={`t${x}`} x1={xOf(x)} y1={AXIS_Y} x2={xOf(x)} y2={PLOT_Y0 + 34} stroke={ACCENT_DARK} strokeDasharray="3 3" />
          ))}
          {[side * zc, ...(tail === "two" ? [-zc] : [])].map((x) => (
            <line key={`z${x}`} x1={xOf(x)} y1={AXIS_Y} x2={xOf(x)} y2={PLOT_Y0 + 50} stroke={GREY} strokeDasharray="3 3" />
          ))}
          <text
            x={tLabelPos.x}
            y={PLOT_Y0 + 32}
            textAnchor={tLabelPos.anchor}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={ACCENT_DARK}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            {tLabelPos.text}
          </text>
          <text
            x={xOf(side * zc) - side * 4}
            y={PLOT_Y0 + 48}
            textAnchor={side > 0 ? "end" : "start"}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill="var(--color-ink-500)"
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            {zLabel}
          </text>

          {/* A single run's t dropping onto the axis */}
          {last && (
            <circle cx={lastX} cy={drop < 1 ? dotY : AXIS_Y - 4} r={4} fill={ACCENT_DARK} stroke="white" strokeWidth="1" />
          )}

          <line x1={PLOT_X0} y1={AXIS_Y} x2={PLOT_X1} y2={AXIS_Y} stroke="var(--color-ink-900)" />
          {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((t) => (
            <text
              key={t}
              x={xOf(t)}
              y={AXIS_Y + 13}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-700)"
              className="tabular-nums"
            >
              {fmt(t, 0)}
            </text>
          ))}
          <text x={(PLOT_X0 + PLOT_X1) / 2} y={AXIS_Y + 30} textAnchor="middle" fontSize={VIZ_TEXT.label} fill="var(--color-ink-700)">
            test statistic t
          </text>
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
              "Pick a worked example along the top. The blue curve is the t-distribution with n − 1 degrees of freedom; the grey curve is N(0, 1) for comparison.",
              "The shaded tail is the example's cut-off, worked out with Excel. The grey dashed line is the z cut-off you would use if σ were known.",
              "Press the first run button to take one sample. The strip at the top shows its values, x̄ and x̄ ± s, and its t drops onto the chart. Run it a few times and watch s change.",
              "Press Repeat 500 times. About α of the t values land beyond the t cut-off; more than α land beyond the z cut-off, because t has heavier tails.",
              "Drag n up. The blue curve closes in on the grey one, and the two cut-offs move together: with a big sample s is a good estimate of σ.",
            ]}
          />
        </div>
        {/* The working, then the answer. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          <span className="font-semibold text-blue-700">{excel}</span>, {excelMeaning}
        </p>
        {atExample && (
          <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
            {exampleWorking.working}
            <span className="font-semibold">{exampleWorking.answer}</span>
          </p>
        )}
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
          {runText}
          {tallyText}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{interpretation}</p>
      </div>
    </div>
  );
}
