/**
 * Two-sample t-test viz, used by Module 5, WU6 (`m5-two-independent-samples`).
 *
 * The unit compares the means of two independent samples when neither
 * population variance is known. The two sample variances are pooled into one
 * estimate s², and t = (x̄₁ − x̄₂ − (μ₁ − μ₂))/(s√(1/n₁ + 1/n₂)) has the
 * t-distribution with n₁ + n₂ − 2 degrees of freedom. The viz lets the
 * student run that test over and over with H₀ true:
 *
 *   - A strip at the top shows one pair of samples, each as a rug on its own
 *     row with its mean marked, against the shared true mean.
 *   - The chart below piles up the t of every run as pale bars under the
 *     t-curve, with the example's rejection region (from Excel) shaded and
 *     the example's own t drawn as a dark line.
 *   - The read-out shows the pooled variance and t worked out for the
 *     example, then counts how many runs land beyond the cut-off (about α)
 *     and how many land at least as far out as the example (about its
 *     p-value), so the p-value is seen to be a long-run proportion.
 *   - For the managers' ages of Example 17B, it also prints Excel's
 *     "unequal variances" t-test beside the pooled one, as the lecturer
 *     asked: the two p-values barely differ.
 *
 * Every run draws both samples from Normal populations with the same σ (the
 * example's pooled s) and means that make H₀ true.
 *
 * Default tier: hand-rolled SVG. The only animation is a single run's t
 * dropping onto the axis, via `useReplayTween`.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { VIZ_TEXT, VizHint } from "../shared";
import { sampleNormal } from "../sampling";
import { tCdf, tInv, tPdf } from "../tdist";
import { useReplayTween } from "../useReplayTween";
import { TWO_SAMPLE_PRESETS, type Tail, type TwoSamplePreset } from "../data/inferenceData";
import { fmt, pct, sub, trim } from "./format";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const INK = "rgb(15, 23, 42)"; // slate-900, the example's observed t
const MEAN_C = "rgb(0, 0, 0)"; // black, the book-wide mean colour

// SVG geometry (viewBox units).
const W = 440;
const PLOT_X0 = 20;
const PLOT_X1 = 420;
/** Sample strip: one rug per group, sharing one axis. */
const ROW_Y: [number, number] = [40, 74];
const STRIP_AXIS = 88;
/** Main chart: the pile of t values under the t-curve. */
const CHART_CAPTION_Y = 128;
const PLOT_Y0 = 146;
const AXIS_Y = 296;
const H = AXIS_Y + 36;
/** Visible stretch of the t-axis. Values beyond it still count in the tally. */
const T_LO = -5;
const T_HI = 5;
const BIN_W = 0.25;
const BINS = Math.round((T_HI - T_LO) / BIN_W);
/** Runs needed before the bars, not just the curve, set the chart's height. */
const MIN_FOR_SCALE = 50;
/** Runs needed before the read-out quotes percentages. */
const MIN_FOR_PERCENT = 20;
const CURVE_STEPS = 200;

/** Prints a variance or standard deviation: 4 decimals when small, else 2. */
function fig(v: number): string {
  return fmt(v, Math.abs(v) < 10 ? 4 : 2);
}

/** Pooled variance s² = ((n₁ − 1)s₁² + (n₂ − 1)s₂²)/(n₁ + n₂ − 2). */
function pooledVar(n1: number, n2: number, s1: number, s2: number): number {
  return ((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2);
}

/** Whether a t lies beyond cut-off c, in the direction(s) the tail names. */
function beyond(t: number, tail: Tail, c: number): boolean {
  if (tail === "lower") return t < -c;
  if (tail === "upper") return t > c;
  return Math.abs(t) > c;
}

/** Whether a t is at least as far out as the example's, in H₁'s direction. */
function asExtreme(t: number, tail: Tail, tObs: number): boolean {
  if (tail === "lower") return t <= tObs;
  if (tail === "upper") return t >= tObs;
  return Math.abs(t) >= Math.abs(tObs);
}

/** p-value of an observed t, as Excel's T.DIST.RT or T.DIST.2T gives it. */
function pValue(tObs: number, tail: Tail, df: number): number {
  if (tail === "lower") return tCdf(tObs, df);
  if (tail === "upper") return 1 - tCdf(tObs, df);
  return 2 * (1 - tCdf(Math.abs(tObs), df));
}

/** One pair of samples, kept so the strip and the read-out can show it. */
interface Pair {
  values: [number[], number[]];
  means: [number, number];
  /** Pooled standard deviation of the pair. */
  s: number;
  t: number;
}

/** Running tally of simulated t values. */
interface Tally {
  /** How many t values fell in each bin, from `T_LO`. */
  counts: number[];
  /** Every run, including any whose t fell off the chart. */
  total: number;
  /** Runs beyond the example's cut-off. */
  beyondCut: number;
  /** Runs at least as far out as the example's own t. */
  asExtreme: number;
}

function emptyTally(): Tally {
  return { counts: new Array<number>(BINS).fill(0), total: 0, beyondCut: 0, asExtreme: 0 };
}

/** Mean and sample variance of a list of values. */
function meanVar(values: number[]): [number, number] {
  const n = values.length;
  const mean = values.reduce((a, v) => a + v, 0) / n;
  return [mean, values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)];
}

/**
 * Take pair after pair of independent samples with H₀ true, work out each
 * pair's pooled two-sample t, and compare where they land with the t-curve.
 *
 * @param params.preset — id of the worked example to open with, from
 *   `TWO_SAMPLE_PRESETS`; defaults to the wheat of Example 11A.
 */
export default function TwoSampleT({ params }: { params: VizParams }) {
  const initial = TWO_SAMPLE_PRESETS.find((p) => p.id === params.preset) ?? TWO_SAMPLE_PRESETS[0];

  const [preset, setPreset] = useState<TwoSamplePreset>(initial);
  const [tally, setTally] = useState<Tally>(emptyTally);
  /** The most recent single run; null after a batch or a reset. */
  const [last, setLast] = useState<Pair | null>(null);
  const [runId, setRunId] = useState(0);
  const drop = useReplayTween([runId], 420);

  const { n1, n2, xbar1, xbar2, s1, s2, tail, alpha, delta0, names } = preset;
  const df = n1 + n2 - 2;
  const s2p = pooledVar(n1, n2, s1, s2);
  const sp = Math.sqrt(s2p);
  const root = Math.sqrt(1 / n1 + 1 / n2);
  const tExact = (xbar1 - xbar2 - delta0) / (sp * root);
  // The example's t, rounded to two decimals as the text prints it. The
  // p-value and the tally use the unrounded value, as Excel would.
  const tObs = Number(tExact.toFixed(2));
  // Cut-off magnitude. A lower-tail cut-off sits at −c.
  const c = tail === "two" ? -tInv(alpha / 2, df) : tInv(1 - alpha, df);
  const p = pValue(tExact, tail, df);
  const rejects = beyond(tObs, tail, c);
  // H₀ is true in every run: group 2 sits at its example mean and group 1 is
  // exactly δ₀ above it.
  const mu: [number, number] = [xbar2 + delta0, xbar2];

  const xOf = (t: number) => PLOT_X0 + ((t - T_LO) / (T_HI - T_LO)) * (PLOT_X1 - PLOT_X0);
  const clampX = (t: number) => Math.min(PLOT_X1, Math.max(PLOT_X0, xOf(t)));

  function clearTally() {
    setTally(emptyTally());
    setLast(null);
  }

  /** Take `times` fresh pairs of samples, work out each t and score it. */
  function run(times: number) {
    const counts = tally.counts.slice();
    let { total, beyondCut, asExtreme: extreme } = tally;
    let pair: Pair | null = null;
    for (let k = 0; k < times; k++) {
      const a = Array.from({ length: n1 }, () => sampleNormal(mu[0], sp));
      const b = Array.from({ length: n2 }, () => sampleNormal(mu[1], sp));
      const [m1, v1] = meanVar(a);
      const [m2, v2] = meanVar(b);
      const s = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / df);
      const t = (m1 - m2 - delta0) / (s * root);
      pair = { values: [a, b], means: [m1, m2], s, t };
      const bin = Math.floor((t - T_LO) / BIN_W);
      if (bin >= 0 && bin < BINS) counts[bin] += 1;
      total += 1;
      if (beyond(t, tail, c)) beyondCut += 1;
      if (asExtreme(t, tail, tExact)) extreme += 1;
    }
    setTally({ counts, total, beyondCut, asExtreme: extreme });
    if (times === 1) {
      setLast(pair);
      setRunId((k) => k + 1);
    } else {
      setLast(null);
    }
  }

  function loadPreset(next: TwoSamplePreset) {
    setPreset(next);
    clearTally();
  }

  // --- Main chart scale ---
  const density = (count: number) => (tally.total > 0 ? count / (tally.total * BIN_W) : 0);
  const maxObserved = tally.counts.reduce((m, k) => Math.max(m, density(k)), 0);
  const top = Math.max(tPdf(0, df), tally.total >= MIN_FOR_SCALE ? maxObserved : 0) * 1.12;
  const yOf = (f: number) => AXIS_Y - Math.min(1, f / top) * (AXIS_Y - PLOT_Y0);
  const tPoints = (from: number, to: number) =>
    Array.from({ length: CURVE_STEPS + 1 }, (_, k) => {
      const t = from + (k / CURVE_STEPS) * (to - from);
      return `${xOf(t).toFixed(1)} ${yOf(tPdf(t, df)).toFixed(1)}`;
    });
  const tPath = `M ${tPoints(T_LO, T_HI).join(" L ")}`;
  const area = (from: number, to: number) =>
    `M ${xOf(from)} ${AXIS_Y} L ${tPoints(from, to).join(" L ")} L ${xOf(to)} ${AXIS_Y} Z`;
  const lowerShaded = tail === "lower" || tail === "two";
  const upperShaded = tail === "upper" || tail === "two";
  const side = tail === "lower" ? -1 : 1;
  const cutLabel = `${tail === "two" ? "±" : ""}${fmt(side * c, 4)}`;
  // The cut-off label sits outside its line unless that would run off the
  // chart; ~5.5 units a character.
  const cutX = xOf(side * c);
  const cutLabelOutside = side > 0 ? cutX + 4 + cutLabel.length * 5.5 <= W : cutX - 4 - cutLabel.length * 5.5 >= 0;
  const cutAnchor: "start" | "end" = (side > 0) === cutLabelOutside ? "start" : "end";
  const cutLabelX = cutAnchor === "start" ? cutX + 4 : cutX - 4;

  // --- Sample strip, on the examples' own scale ---
  const sLo = Math.min(...mu) - 3.2 * sp;
  const sHi = Math.max(...mu) + 3.2 * sp;
  const sxOf = (v: number) =>
    Math.min(PLOT_X1, Math.max(PLOT_X0, PLOT_X0 + ((v - sLo) / (sHi - sLo)) * (PLOT_X1 - PLOT_X0)));
  const stripTicks = [-3, -1.5, 0, 1.5, 3].map((k) => (mu[0] + mu[1]) / 2 + k * sp);
  const tickDp = sp < 1 ? 2 : sp < 10 ? 1 : 0;

  // --- Read-out ---
  const excel =
    tail === "two"
      ? `=T.INV.2T(${alpha}, ${df}) = ${fmt(c, 4)}`
      : tail === "upper"
        ? `=T.INV(${Number((1 - alpha).toFixed(2))}, ${df}) = ${fmt(c, 4)}`
        : `=T.INV(${alpha}, ${df}) = ${fmt(-c, 4)}`;
  const pooledWorking = `s² = (${n1 - 1} × ${trim(s1)}² + ${n2 - 1} × ${trim(s2)}²)/${df} = ${fig(s2p)}, so s = ${fig(sp)}`;
  const tWorking = `t${sub(df)} = (${fmt(xbar1, preset.dp)} − ${fmt(xbar2, preset.dp)} − ${trim(delta0)})/(${fig(sp)} × √(1/${n1} + 1/${n2})) = ${fmt(tObs, 2)}`;
  const compare =
    tail === "two" ? (rejects ? "beyond" : "within") : tail === "upper" ? (rejects ? ">" : "≤") : rejects ? "<" : "≥";
  const decision = `${compare} ${cutLabel}: ${rejects ? "reject" : "do not reject"} H₀`;

  // Excel's "unequal variances" test: no pooling, Welch's degrees of freedom.
  const v1 = (s1 * s1) / n1;
  const v2 = (s2 * s2) / n2;
  const tUnequal = (xbar1 - xbar2 - delta0) / Math.sqrt(v1 + v2);
  const dfUnequal = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1));
  const pUnequal = pValue(tUnequal, tail, dfUnequal);

  const runText = last
    ? `This pair: x̄₁ = ${fmt(last.means[0], preset.dp + 1)}, x̄₂ = ${fmt(last.means[1], preset.dp + 1)}, pooled s = ${fig(last.s)}, so t = ${fmt(last.t, 2)}. `
    : "";
  const extremeWord = tail === "two" ? "as far from 0 as" : tail === "upper" ? "at or above" : "at or below";
  const tallyText =
    tally.total >= MIN_FOR_PERCENT
      ? `${tally.total.toLocaleString()} runs with H₀ true: ${pct(tally.beyondCut / tally.total)} beyond ${cutLabel} (should be ${Math.round(alpha * 100)}%), ${pct(tally.asExtreme / tally.total)} ${extremeWord} the example's ${fmt(tObs, 2)} (its p-value, ${pct(p)}).`
      : `Pooling gives s ${n1 - 1} + ${n2 - 1} = ${df} degrees of freedom.`;

  /** One plain sentence on what the picture currently means. */
  const interpretation = rejects
    ? `When H₀ is true, a t as far out as ${fmt(tObs, 2)} turns up in only ${pct(p)} of runs, so the example's difference is too big to put down to chance.`
    : `When H₀ is true, a t as far out as ${fmt(tObs, 2)} turns up in ${pct(p)} of runs, so the example's difference is easily explained by chance.`;

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
    }`;
  const runButton =
    "px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700";

  const dotY = PLOT_Y0 + (AXIS_Y - 4 - PLOT_Y0) * drop;
  const lastBin = last ? Math.floor((last.t - T_LO) / BIN_W) : -1;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="flex flex-wrap gap-1.5">
        {TWO_SAMPLE_PRESETS.map((q) => (
          <button key={q.id} onClick={() => loadPreset(q)} className={chip(preset.id === q.id)}>
            {q.label}
          </button>
        ))}
      </div>

      <VizHint>
        Press <strong className="font-semibold">Repeat 500 times</strong>{" "}
        and see how often H₀ alone gives a t as far out as the example&apos;s.
      </VizHint>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mr-0.5">
          Run it
        </span>
        <button onClick={() => run(1)} className={runButton}>
          {preset.drawOne}
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

      <div className="shrink-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[520px] select-none">
          <title>
            {`Top: one pair of samples, ${n1} from ${names[0]} and ${n2} from ${names[1]}. Bottom: ${tally.total} simulated two-sample t values against the t-distribution with ${df} degrees of freedom, with the cut-off ${excel} shaded and the example's t = ${fmt(tObs, 2)} marked.`}
          </title>

          {/* ---- Sample strip ---- */}
          <text x={PLOT_X0} y={12} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
            One pair of samples, in {preset.units}
          </text>
          {names.map((name, g) => (
            <g key={name}>
              <text x={PLOT_X0} y={ROW_Y[g] - 14} fontSize={VIZ_TEXT.axisTick} fill="var(--color-ink-500)">
                {name}, n = {g === 0 ? n1 : n2}
              </text>
              {/* This group's true mean: black and dashed, as every mean marker. */}
              <line
                x1={sxOf(mu[g])}
                y1={ROW_Y[g] - 12}
                x2={sxOf(mu[g])}
                y2={ROW_Y[g] + 2}
                stroke={MEAN_C}
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              {last ? (
                <g>
                  {/* Values as a rug: only their position along the axis means anything. */}
                  {last.values[g].map((v, i) => (
                    <line
                      key={i}
                      x1={sxOf(v)}
                      y1={ROW_Y[g]}
                      x2={sxOf(v)}
                      y2={ROW_Y[g] - 9}
                      stroke={ACCENT}
                      strokeWidth="1.5"
                      strokeOpacity={0.6}
                    />
                  ))}
                  <line
                    x1={sxOf(last.means[g])}
                    y1={ROW_Y[g] - 12}
                    x2={sxOf(last.means[g])}
                    y2={ROW_Y[g] + 2}
                    stroke={ACCENT_DARK}
                    strokeWidth="2.5"
                  />
                  <text
                    x={sxOf(last.means[g]) + 4}
                    y={ROW_Y[g] + 1}
                    fontSize={VIZ_TEXT.axisTick}
                    fontWeight="600"
                    fill={ACCENT_DARK}
                    stroke="white"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    x̄{g === 0 ? "₁" : "₂"}
                  </text>
                </g>
              ) : null}
              <line x1={PLOT_X0} y1={ROW_Y[g] + 2} x2={PLOT_X1} y2={ROW_Y[g] + 2} stroke="var(--color-line-strong)" />
            </g>
          ))}
          {!last && (
            // A white halo, so the text stays legible where it crosses μ.
            <text
              x={PLOT_X1}
              y={ROW_Y[1] - 14}
              textAnchor="end"
              fontSize={VIZ_TEXT.caption}
              fill="var(--color-ink-400)"
              stroke="white"
              strokeWidth="3"
              paintOrder="stroke"
            >
              Press {preset.drawOne} to take one pair
            </text>
          )}
          <text
            x={PLOT_X1}
            y={12}
            textAnchor="end"
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={MEAN_C}
          >
            {delta0 === 0 ? `dashed: μ₁ = μ₂ = ${trim(mu[1])}` : `dashed: μ₁ = ${trim(mu[0])}, μ₂ = ${trim(mu[1])}`}
          </text>
          {stripTicks.map((v) => (
            <text
              key={v}
              x={sxOf(v)}
              y={STRIP_AXIS + 4}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-500)"
              className="tabular-nums"
            >
              {fmt(v, tickDp)}
            </text>
          ))}

          {/* ---- Main chart ---- */}
          <text x={PLOT_X0} y={CHART_CAPTION_Y} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
            Pooled t from every run, against <tspan fill={ACCENT_DARK}>t{sub(df)}</tspan>
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

          {lowerShaded && <path d={area(T_LO, -c)} fill={ACCENT} fillOpacity={0.35} />}
          {upperShaded && <path d={area(c, T_HI)} fill={ACCENT} fillOpacity={0.35} />}
          <path d={tPath} fill="none" stroke={ACCENT_DARK} strokeWidth="2" />

          {/* The example's own t */}
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

          {/* Cut-off lines, drawn after the observed t so their label's halo
              keeps it legible where the two cross. */}
          {[side * c, ...(tail === "two" ? [-c] : [])].map((x) => (
            <line key={x} x1={xOf(x)} y1={AXIS_Y} x2={xOf(x)} y2={PLOT_Y0 + 34} stroke={ACCENT_DARK} strokeDasharray="3 3" />
          ))}
          <text
            x={cutLabelX}
            y={PLOT_Y0 + 32}
            textAnchor={cutAnchor}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={ACCENT_DARK}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            {cutLabel}
          </text>

          {/* A single run's t dropping onto the axis */}
          {last && (
            <circle cx={clampX(last.t)} cy={drop < 1 ? dotY : AXIS_Y - 4} r={4} fill={ACCENT_DARK} stroke="white" strokeWidth="1" />
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">{preset.source}</p>
          <VizGuide
            steps={[
              "Pick a worked example along the top. The read-out pools the two sample variances and works out the example's t, then compares it with the cut-off from Excel.",
              "The blue curve is the t-distribution with n₁ + n₂ − 2 degrees of freedom. The shaded tail is the rejection region; the dark line is the example's t.",
              "Press the first run button to take one pair of samples with H₀ true. The strip shows both samples and their means, and the pair's t drops onto the chart.",
              "Press Repeat 500 times. About α of the t values land in the shaded region, and the share at least as far out as the example's t comes close to its p-value.",
            ]}
          />
        </div>
        {/* The working, then the answer. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">{pooledWorking}</p>
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          {tWorking}, <span className="font-semibold text-blue-700">{excel}</span>, so t is{" "}
          <span className="font-semibold">{decision}</span>
        </p>
        {preset.showUnequal && (
          <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
            Pooled: t = {fmt(tObs, 2)}, df = {df}, p = {fmt(p, 4)}. Unequal variances, no pooling: t ={" "}
            {fmt(tUnequal, 2)}, df ={" "}
            {fmt(dfUnequal, 1)}, p = {fmt(pUnequal, 4)}.
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
