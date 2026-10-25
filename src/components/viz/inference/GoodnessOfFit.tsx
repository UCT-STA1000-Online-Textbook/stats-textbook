/**
 * Chi-squared goodness-of-fit viz, used by Module 5, WU8
 * (`m5-goodness-of-fit`).
 *
 * The test compares the observed frequencies Oᵢ in k cells with the
 * frequencies Eᵢ a model predicts, through D² = Σ(Oᵢ − Eᵢ)²/Eᵢ, which has
 * approximately the χ²-distribution with k − d − 1 degrees of freedom (d
 * parameters estimated from the data). The viz runs that test over and over
 * with the model true:
 *
 *   - The top chart shows the cells: expected frequencies as pale bars,
 *     observed frequencies as rings drawn over them, and each cell's share
 *     (O − E)²/E of D² printed above it. It opens on the example's own data
 *     and shows each single run's sample after.
 *   - The bottom chart piles up the D² of every run under the χ²-curve, with
 *     the 5% rejection region (from Excel's CHISQ.INV.RT) shaded and the
 *     example's D² drawn as a dark line. About 5% of runs land in the region.
 *   - Where the example estimates parameters from the data (λ for the
 *     misprints the second time, μ and σ for the I.Q. scores), every run
 *     re-estimates them from its own sample (μ and σ from the grouped
 *     counts: see `fitNormalToCells`). The fitted model hugs each
 *     sample a little, which is why each estimate costs a degree of freedom,
 *     and the pile is seen to follow the curve with the reduced df.
 *
 * Default tier: hand-rolled SVG. The only animation is a single run's D²
 * dropping onto the axis, via `useReplayTween`.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { VIZ_TEXT, VizHint } from "../shared";
import { sampleCategory, sampleNormal, samplePoisson } from "../sampling";
import { normalCdf } from "../normal";
import { chiSqInvRT, chiSqPdf, chiSqRightTail } from "../chisq";
import { useReplayTween } from "../useReplayTween";
import { GOF_PRESETS, type GofModel, type GofPreset } from "../data/inferenceData";
import { fmt, pct, sub } from "./format";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const INK = "rgb(15, 23, 42)"; // slate-900, observed rings and the example's D²

// SVG geometry (viewBox units).
const W = 440;
const PLOT_X0 = 20;
const PLOT_X1 = 420;
/** Cells chart: expected bars and observed rings. */
const CELLS_TOP = 50;
const CELLS_AXIS = 118;
/** D² chart: the pile of D² values under the χ²-curve. */
const CHART_CAPTION_Y = 160;
const PLOT_Y0 = 182;
const AXIS_Y = 304;
const H = AXIS_Y + 36;
const BINS = 40;
/** Runs needed before the bars, not just the curve, set the chart's height. */
const MIN_FOR_SCALE = 50;
/** Runs needed before the read-out quotes percentages. */
const MIN_FOR_PERCENT = 20;
const CURVE_STEPS = 200;
/**
 * The χ²₁ density is infinite at 0, so for one degree of freedom the
 * chart's height is set by the curve a little way in (at this fraction of
 * the axis) and the spike near 0 is clipped.
 */
const DF1_SCALE_AT = 0.04;

/** Cell probabilities under a model with the given parameters. */
function cellProbs(model: GofModel, est: { lambda?: number; mu?: number; sigma?: number }): number[] {
  if (model.kind === "fixed") return model.probs;
  if (model.kind === "poisson") {
    const lambda = est.lambda ?? model.lambda;
    const probs: number[] = [];
    let p = Math.exp(-lambda);
    for (let k = 0; k < model.top; k++) {
      probs.push(p);
      p *= lambda / (k + 1);
    }
    // The last cell is "top or more": whatever probability is left.
    probs.push(1 - probs.reduce((a, v) => a + v, 0));
    return probs;
  }
  const mu = est.mu ?? model.mu;
  const sigma = est.sigma ?? model.sigma;
  const cdf = [0, ...model.cuts.map((c) => normalCdf((c - mu) / sigma)), 1];
  return cdf.slice(1).map((v, i) => v - cdf[i]);
}

/**
 * Fits μ and σ to grouped counts by maximum likelihood: the values that make
 * the observed cell counts most probable.
 *
 * Why not simply use x̄ and s of the raw values, as Example 2B does? The rule
 * "lose one degree of freedom per estimated parameter" is exact (for large
 * samples) only when the parameters are estimated from the grouped counts.
 * Estimated from the raw values, D² over four cells lands beyond the χ²₁
 * 5% point in about 8% of samples instead of 5%, and the panel would seem to
 * contradict the rule it is there to illustrate. For samples the model
 * really produced the two estimates are close, so the raw ones make a good
 * starting point for the search. (They need not be close for real data: for
 * Example 2B's counts the grouped fit gives σ ≈ 14.5, not the book's 16.3.)
 *
 * The search is Nelder–Mead on (μ, log σ), which needs no derivatives and
 * converges in well under a hundred steps from such a good start.
 */
function fitNormalToCells(
  model: Extract<GofModel, { kind: "normal" }>,
  observed: number[],
  xbar: number,
  s: number,
): { mu: number; sigma: number } {
  /** Negative log-likelihood of the counts, at μ = v[0], σ = e^v[1]. */
  const cost = (v: number[]) =>
    -cellProbs(model, { mu: v[0], sigma: Math.exp(v[1]) }).reduce(
      (a, p, i) => a + observed[i] * Math.log(Math.max(p, 1e-12)),
      0,
    );
  // Starting triangle around the raw estimates.
  let simplex = [
    [xbar, Math.log(s)],
    [xbar + 0.1 * s, Math.log(s)],
    [xbar, Math.log(s) + 0.1],
  ].map((v) => ({ v, f: cost(v) }));
  for (let step = 0; step < 200; step++) {
    simplex.sort((a, b) => a.f - b.f);
    const [best, mid, worst] = simplex;
    if (worst.f - best.f < 1e-10) break;
    const centre = [(best.v[0] + mid.v[0]) / 2, (best.v[1] + mid.v[1]) / 2];
    const towards = (t: number) => centre.map((c, i) => c + t * (worst.v[i] - c));
    const reflected = towards(-1);
    const fr = cost(reflected);
    if (fr < best.f) {
      const expanded = towards(-2);
      const fe = cost(expanded);
      simplex[2] = fe < fr ? { v: expanded, f: fe } : { v: reflected, f: fr };
    } else if (fr < mid.f) {
      simplex[2] = { v: reflected, f: fr };
    } else {
      const contracted = towards(0.5);
      const fc = cost(contracted);
      if (fc < worst.f) {
        simplex[2] = { v: contracted, f: fc };
      } else {
        // Shrink the whole triangle towards the best point.
        simplex = simplex.map((p, i) =>
          i === 0 ? p : { v: p.v.map((x, j) => best.v[j] + 0.5 * (x - best.v[j])), f: 0 },
        );
        simplex = simplex.map((p, i) => (i === 0 ? p : { v: p.v, f: cost(p.v) }));
      }
    }
  }
  simplex.sort((a, b) => a.f - b.f);
  return { mu: simplex[0].v[0], sigma: Math.exp(simplex[0].v[1]) };
}

/** D² = Σ(O − E)²/E. */
function dSquared(observed: number[], expected: number[]): number {
  return observed.reduce((a, o, i) => a + (o - expected[i]) ** 2 / expected[i], 0);
}

/** One simulated sample, classified into the cells. */
interface Sample {
  observed: number[];
  expected: number[];
  d2: number;
  /** The parameters fitted to this sample, as text, if any were. */
  fitted: string | null;
}

/** Draws one sample of n items from the model and classifies it. */
function takeSample(preset: GofPreset): Sample {
  const { model, n } = preset;
  const k = preset.cells.length;
  const observed = new Array<number>(k).fill(0);
  let probs: number[];
  let fitted: string | null = null;
  if (model.kind === "fixed") {
    for (let i = 0; i < n; i++) observed[sampleCategory(model.probs)] += 1;
    probs = model.probs;
  } else if (model.kind === "poisson") {
    let total = 0;
    for (let i = 0; i < n; i++) {
      const x = samplePoisson(model.lambda);
      total += x;
      observed[Math.min(x, model.top)] += 1;
    }
    if (model.fit) {
      const lambda = total / n;
      probs = cellProbs(model, { lambda });
      fitted = `λ̂ = ${lambda.toFixed(2)}`;
    } else {
      probs = cellProbs(model, {});
    }
  } else {
    const xs = Array.from({ length: n }, () => sampleNormal(model.mu, model.sigma));
    const xbar = xs.reduce((a, v) => a + v, 0) / n;
    const s = Math.sqrt(xs.reduce((a, v) => a + (v - xbar) ** 2, 0) / (n - 1));
    for (const x of xs) {
      const cell = model.cuts.findIndex((c) => x < c);
      observed[cell === -1 ? model.cuts.length : cell] += 1;
    }
    const { mu, sigma } = fitNormalToCells(model, observed, xbar, s);
    probs = cellProbs(model, { mu, sigma });
    fitted = `fitted μ = ${mu.toFixed(1)}, σ = ${sigma.toFixed(1)}`;
  }
  const expected = probs.map((p) => n * p);
  return { observed, expected, d2: dSquared(observed, expected), fitted };
}

/** Running tally of simulated D² values. */
interface Tally {
  /** How many D² values fell in each bin, from 0. */
  counts: number[];
  /** Every run, including any whose D² fell off the chart. */
  total: number;
  /** Runs beyond the 5% point. */
  beyondCut: number;
  /** Runs with a D² at least as big as the example's. */
  asBig: number;
}

function emptyTally(): Tally {
  return { counts: new Array<number>(BINS).fill(0), total: 0, beyondCut: 0, asBig: 0 };
}

/**
 * Run a goodness-of-fit test over and over with the model true, and pile up
 * D² against the χ²-curve with k − d − 1 degrees of freedom.
 *
 * @param params.preset — id of the worked example to open with, from
 *   `GOF_PRESETS`; defaults to the misprints with λ = 1.2 given.
 */
export default function GoodnessOfFit({ params }: { params: VizParams }) {
  const initial = GOF_PRESETS.find((p) => p.id === params.preset) ?? GOF_PRESETS[0];

  const [preset, setPreset] = useState<GofPreset>(initial);
  const [tally, setTally] = useState<Tally>(emptyTally);
  /** The most recent single run; null after a batch or a reset. */
  const [last, setLast] = useState<Sample | null>(null);
  const [runId, setRunId] = useState(0);
  const drop = useReplayTween([runId], 420);

  const k = preset.cells.length;
  const df = k - preset.estimated - 1;
  const cut = chiSqInvRT(preset.alpha, df);
  const contributions = preset.observed.map((o, i) => (o - preset.expected[i]) ** 2 / preset.expected[i]);
  const d2 = contributions.reduce((a, v) => a + v, 0);
  const p = chiSqRightTail(d2, df);
  const rejects = d2 > cut;
  const binW = preset.maxD2 / BINS;

  function clearTally() {
    setTally(emptyTally());
    setLast(null);
  }

  /** Take `times` fresh samples with the model true and score each D². */
  function run(times: number) {
    const counts = tally.counts.slice();
    let { total, beyondCut, asBig } = tally;
    let sample: Sample | null = null;
    for (let r = 0; r < times; r++) {
      sample = takeSample(preset);
      const bin = Math.floor(sample.d2 / binW);
      if (bin < BINS) counts[bin] += 1;
      total += 1;
      if (sample.d2 > cut) beyondCut += 1;
      if (sample.d2 >= d2) asBig += 1;
    }
    setTally({ counts, total, beyondCut, asBig });
    if (times === 1) {
      setLast(sample);
      setRunId((id) => id + 1);
    } else {
      setLast(null);
    }
  }

  function loadPreset(next: GofPreset) {
    setPreset(next);
    clearTally();
  }

  // --- Cells chart: the example's data, or the latest single run ---
  const shownO = last ? last.observed : preset.observed;
  const shownE = last ? last.expected : preset.expected;
  const shownC = shownO.map((o, i) => (o - shownE[i]) ** 2 / shownE[i]);
  const cellTop = Math.max(...shownO, ...shownE) * 1.08;
  const cyOf = (v: number) => CELLS_AXIS - (v / cellTop) * (CELLS_AXIS - CELLS_TOP);
  const slot = (PLOT_X1 - PLOT_X0) / k;
  const cx = (i: number) => PLOT_X0 + (i + 0.5) * slot;
  const barW = Math.min(56, slot * 0.6);

  // --- D² chart ---
  const xOf = (v: number) => PLOT_X0 + (v / preset.maxD2) * (PLOT_X1 - PLOT_X0);
  const clampX = (v: number) => Math.min(PLOT_X1, xOf(v));
  const density = (count: number) => (tally.total > 0 ? count / (tally.total * binW) : 0);
  const maxObserved = tally.counts.reduce((m, c) => Math.max(m, density(c)), 0);
  // Highest point of the curve: at its mode, df − 2, from 2 df up; at 0 for
  // df = 2; clipped near 0 for df = 1 (see DF1_SCALE_AT).
  const curveTop =
    df === 1 ? chiSqPdf(DF1_SCALE_AT * preset.maxD2, 1) : df === 2 ? 0.5 : chiSqPdf(df - 2, df);
  const top = Math.max(curveTop, tally.total >= MIN_FOR_SCALE ? Math.min(maxObserved, 2 * curveTop) : 0) * 1.12;
  const yOf = (f: number) => AXIS_Y - Math.min(1, f / top) * (AXIS_Y - PLOT_Y0);
  // Start just right of 0: at 0 the χ²₁ density is infinite and χ²₂'s is 0.5.
  const curvePoints = (from: number, to: number) =>
    Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
      const x = Math.max(1e-6, from + (i / CURVE_STEPS) * (to - from));
      return `${xOf(x).toFixed(1)} ${yOf(chiSqPdf(x, df)).toFixed(1)}`;
    });
  const curvePath = `M ${curvePoints(0, preset.maxD2).join(" L ")}`;
  const tailPath =
    cut < preset.maxD2
      ? `M ${xOf(cut)} ${AXIS_Y} L ${curvePoints(cut, preset.maxD2).join(" L ")} L ${xOf(preset.maxD2)} ${AXIS_Y} Z`
      : null;
  const ticks = Array.from({ length: Math.floor(preset.maxD2 / 5) + 1 }, (_, i) => i * 5);

  // --- Read-out ---
  // Three decimals per term, so the terms visibly add up to the two-decimal D².
  const working = `D² = ${contributions.map((c) => fmt(c, 3)).join(" + ")} = `;
  const dfWorking = `k − d − 1 = ${k} − ${preset.estimated} − 1 = ${df}`;
  const excel = `=CHISQ.INV.RT(${preset.alpha}, ${df}) = ${fmt(cut, 3)}`;
  const decision = `${fmt(d2, 2)} ${rejects ? ">" : "<"} ${fmt(cut, 3)}: ${rejects ? "reject" : "do not reject"} H₀`;
  const runText = last
    ? `This run: ${last.fitted ? `${last.fitted}, ` : ""}D² = ${fmt(last.d2, 2)}. `
    : "";
  // The I.Q. runs fit μ and σ to the four bands (see `fitNormalToCells`),
  // but the example's D² uses the book's x̄ and s of the raw scores, so the
  // runs are not a fair yardstick for that one figure: for the Normal model
  // the read-out says how the runs are fitted instead of comparing.
  const comparable = preset.model.kind !== "normal";
  const pText = `p-value =CHISQ.DIST.RT(${fmt(d2, 2)}, ${df}) = ${fmt(p, 4)}`;
  const tallyText =
    tally.total >= MIN_FOR_PERCENT
      ? `${tally.total.toLocaleString()} runs with H₀ true: ${pct(tally.beyondCut / tally.total)} above ${fmt(cut, 3)} (should be ${Math.round(preset.alpha * 100)}%), ` +
        (comparable
          ? `${pct(tally.asBig / tally.total)} at or above the example's ${fmt(d2, 2)} (${pText}).`
          : `each fitting μ and σ to its four bands. The example's ${pText}.`)
      : `${pText}.`;
  /** One plain sentence on what the picture currently means. */
  const interpretation = rejects
    ? "The observed and expected frequencies are further apart than chance alone makes likely, so the model does not fit these data."
    : "The gaps between observed and expected frequencies are the size chance alone produces, so the model is consistent with these data.";

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
    }`;
  const runButton =
    "px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700";

  const dotY = PLOT_Y0 + (AXIS_Y - 4 - PLOT_Y0) * drop;
  const lastBin = last ? Math.floor(last.d2 / binW) : -1;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="flex flex-wrap gap-1.5">
        {GOF_PRESETS.map((q) => (
          <button key={q.id} onClick={() => loadPreset(q)} className={chip(preset.id === q.id)}>
            {q.label}
          </button>
        ))}
      </div>

      <VizHint>
        Press <strong className="font-semibold">{preset.drawOne}</strong>
        {" "}to take a sample the model really did produce, and see how far O and E still differ.
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
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[540px] select-none">
          <title>
            {`Top: observed and expected ${preset.counts}, ${last ? "for one simulated sample" : "for the example"}. Bottom: ${tally.total} simulated D² values against the chi-squared distribution with ${df} degrees of freedom, with the 5% point ${fmt(cut, 3)} shaded and the example's D² = ${fmt(d2, 2)} marked.`}
          </title>

          {/* ---- Cells chart ---- */}
          <text x={PLOT_X0} y={12} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
            {last ? "One run's" : "The example's"} {preset.counts}
          </text>
          <text x={PLOT_X0} y={26} fontSize={VIZ_TEXT.axisTick} fill="var(--color-ink-500)">
            <tspan fill={ACCENT_DARK}>bars: expected E</tspan> · <tspan fill={INK}>rings: observed O</tspan> ·
            numbers: (O − E)²/E
          </text>
          {shownE.map((e, i) => {
            const y = cyOf(e);
            return (
              <g key={i}>
                <rect
                  x={cx(i) - barW / 2}
                  y={y}
                  width={barW}
                  height={CELLS_AXIS - y}
                  fill={ACCENT}
                  fillOpacity={0.22}
                  stroke={ACCENT}
                  strokeOpacity={0.5}
                />
                {/* Observed frequency drawn over the theory, never instead of it. */}
                <circle cx={cx(i)} cy={cyOf(shownO[i])} r={4.5} fill="white" stroke={INK} strokeWidth="2" />
                <text
                  x={cx(i)}
                  y={Math.min(y, cyOf(shownO[i])) - 8}
                  textAnchor="middle"
                  fontSize={VIZ_TEXT.axisTick}
                  fontWeight="600"
                  fill={ACCENT_DARK}
                  className="tabular-nums"
                >
                  {fmt(shownC[i], 2)}
                </text>
                <text
                  x={cx(i)}
                  y={CELLS_AXIS + 12}
                  textAnchor="middle"
                  fontSize={VIZ_TEXT.axisTick}
                  fill="var(--color-ink-700)"
                >
                  {preset.cells[i]}
                </text>
                <text
                  x={cx(i)}
                  y={CELLS_AXIS + 24}
                  textAnchor="middle"
                  fontSize={VIZ_TEXT.axisTick - 1}
                  fill="var(--color-ink-500)"
                  className="tabular-nums"
                >
                  O {shownO[i]} · E {fmt(shownE[i], preset.dp)}
                </text>
              </g>
            );
          })}
          <line x1={PLOT_X0} y1={CELLS_AXIS} x2={PLOT_X1} y2={CELLS_AXIS} stroke="var(--color-ink-900)" />

          {/* ---- D² chart ---- */}
          <text x={PLOT_X0} y={CHART_CAPTION_Y} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
            D² from every run, against <tspan fill={ACCENT_DARK}>χ²{sub(df)}</tspan>
          </text>

          {/* Simulated D² values as pale bars, under everything else */}
          {tally.counts.map((c, i) => {
            // A single run's bar waits for its dot to land.
            const shown = c - (last && drop < 1 && i === lastBin ? 1 : 0);
            if (shown <= 0) return null;
            const y = yOf(density(shown));
            return (
              <rect
                key={i}
                x={xOf(i * binW)}
                y={y}
                width={Math.max(0.5, xOf(binW) - xOf(0) - 0.5)}
                height={AXIS_Y - y}
                fill={ACCENT}
                fillOpacity={0.2}
              />
            );
          })}

          {tailPath && <path d={tailPath} fill={ACCENT} fillOpacity={0.35} />}
          <path d={curvePath} fill="none" stroke={ACCENT_DARK} strokeWidth="2" />

          {/* The example's own D² */}
          <line x1={clampX(d2)} y1={PLOT_Y0 + 4} x2={clampX(d2)} y2={AXIS_Y} stroke={INK} strokeWidth="2" />
          <text
            x={clampX(d2)}
            y={PLOT_Y0}
            textAnchor={xOf(d2) > PLOT_X1 - 50 ? "end" : "middle"}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={INK}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            example: D² = {fmt(d2, 2)}
          </text>

          {/* The 5% point, drawn after the example's line so its halo keeps
              the label legible where the two cross. */}
          <line x1={xOf(cut)} y1={AXIS_Y} x2={xOf(cut)} y2={PLOT_Y0 + 34} stroke={ACCENT_DARK} strokeDasharray="3 3" />
          <text
            x={xOf(cut) + 4}
            y={PLOT_Y0 + 32}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={ACCENT_DARK}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            {Math.round(preset.alpha * 100)}%: {fmt(cut, 3)}
          </text>

          {/* A single run's D² dropping onto the axis */}
          {last && (
            <circle cx={clampX(last.d2)} cy={drop < 1 ? dotY : AXIS_Y - 4} r={4} fill={ACCENT_DARK} stroke="white" strokeWidth="1" />
          )}

          <line x1={PLOT_X0} y1={AXIS_Y} x2={PLOT_X1} y2={AXIS_Y} stroke="var(--color-ink-900)" />
          {ticks.map((v) => (
            <text
              key={v}
              x={xOf(v)}
              y={AXIS_Y + 13}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-700)"
              className="tabular-nums"
            >
              {v}
            </text>
          ))}
          <text x={(PLOT_X0 + PLOT_X1) / 2} y={AXIS_Y + 30} textAnchor="middle" fontSize={VIZ_TEXT.label} fill="var(--color-ink-700)">
            test statistic D²
          </text>
        </svg>
      </div>

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">{preset.source}</p>
          <VizGuide
            steps={[
              "Pick a worked example along the top. The top chart shows its cells: expected frequencies as bars, observed frequencies as rings, and each cell's share (O − E)²/E of D² above it.",
              "The bottom chart is the χ²-curve with k − d − 1 degrees of freedom. The shaded tail beyond the 5% point is the rejection region; the dark line is the example's D².",
              "Press the first run button to take a sample the model really did produce. Its cells replace the example's in the top chart, and its D² drops onto the bottom chart. O and E still differ: that is chance.",
              "Press Repeat 500 times. The D² values pile up under the curve, and about 5% land in the shaded region.",
              "Compare the two misprint examples. When λ is estimated, every run re-estimates it from its own sample, the expected frequencies follow each sample more closely, and D² comes out smaller: that is the lost degree of freedom.",
            ]}
          />
        </div>
        {/* The working, then the answer. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          {working}
          <span className="font-semibold">{fmt(d2, 2)}</span>
        </p>
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          df = {dfWorking}, <span className="font-semibold text-blue-700">{excel}</span>, so{" "}
          <span className="font-semibold">{decision}</span>
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
          {runText}
          {tallyText}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{interpretation}</p>
      </div>
    </div>
  );
}
