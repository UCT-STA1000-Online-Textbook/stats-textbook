/**
 * Sampling distribution of the regression slope, used by Module 5, WU10
 * (`m5-regression`).
 *
 * The slides make two points about the slope b: it is a random variable,
 * because it changes from sample to sample, and its sampling distribution is
 * Normal; and the test of H₀: β = 0 asks whether a sample slope as far from 0
 * as ours is believable when there is no relationship in the population.
 * This viz runs that experiment on the assembly-line example:
 *
 *   - The scatterplot at the top shows the population line α + βx (dashed)
 *     and one sample of 12 workers at the slides' assembly times, with the
 *     sample's own least-squares line in blue. It opens on the slides' data.
 *   - Each run monitors 12 new workers: every defect rate is the population
 *     line plus a Normal error. The run's slope b drops onto the chart below,
 *     where the slopes pile up over their theoretical Normal curve, centred
 *     on β with standard deviation σ / √Σ(x − x̄)².
 *   - The read-out works out t = b / se(b) for the latest sample and, under
 *     the β = 0 preset, counts how often chance alone gives a t as far out as
 *     the slides' −2.666, which is the p-value 0.0237 seen happening.
 *
 * Default tier: two hand-rolled SVGs. The only animation is a single run's b
 * dropping onto the axis, via `useReplayTween`.
 */

"use client";

import { useId, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { VIZ_TEXT, VizHint } from "../shared";
import { sampleNormal } from "../sampling";
import { normalPdf } from "../normal";
import { tCdf, tInv } from "../tdist";
import { useReplayTween } from "../useReplayTween";
import { fitLine, type Fit, type Point } from "../regression";
import { ASSEMBLY_POINTS, SLOPE_PRESETS, type SlopePreset } from "../data/inferenceData";
import { fmt, pct, sub, trim } from "./format";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const MEAN_C = "rgb(0, 0, 0)"; // black, the book-wide mean colour: b averages out at β
const INK = "rgb(15, 23, 42)"; // slate-900, the slides' own slope

const W = 440;
const PLOT_X0 = 40;
const PLOT_X1 = 426;

// Scatterplot geometry (viewBox units).
const SC_Y0 = 10;
const SC_AXIS = 120;
const SC_H = SC_AXIS + 32;
const X_VIEW: [number, number] = [15, 35];
// Runs below 0 so the occasional negative simulated defect rate (a Normal
// error can push y under 0 at the long assembly times) is shown, not hidden.
const Y_VIEW: [number, number] = [-4, 16];

// Slope chart geometry. The b-axis is fixed for both presets, so switching
// between β = −0.398 and β = 0 is seen as the whole pile sliding across.
const B_VIEW: [number, number] = [-1, 0.6];
const B_Y0 = 30;
const B_AXIS = 140;
const B_H = B_AXIS + 34;
const BINS = 40;
const BIN_W = (B_VIEW[1] - B_VIEW[0]) / BINS;
/** Runs needed before the bars, not just the curve, set the chart's height. */
const MIN_FOR_SCALE = 50;
/** Runs needed before the read-out quotes percentages. */
const MIN_FOR_PERCENT = 20;

const N = ASSEMBLY_POINTS.length;
const DF = N - 2;
/** =T.INV.2T(0.05, 10): reject H₀ when |t| is bigger than this. */
const T_CRIT = -tInv(0.025, DF);
const EXAMPLE_FIT = fitLine(ASSEMBLY_POINTS);
const EXAMPLE_T = EXAMPLE_FIT.b / EXAMPLE_FIT.seB;
const EXAMPLE_P = 2 * tCdf(-Math.abs(EXAMPLE_T), DF);
const MEAN_X = ASSEMBLY_POINTS.reduce((s, p) => s + p.x, 0) / N;
const SXX = ASSEMBLY_POINTS.reduce((s, p) => s + (p.x - MEAN_X) ** 2, 0);

/** Running tally of simulated slopes. */
interface Tally {
  /** How many slopes fell in each bin of the b-axis. */
  counts: number[];
  /** Every run, including any whose b fell off the chart. */
  total: number;
  sumB: number;
  /** Runs whose |t| is past the 5% critical value: H₀ rejected. */
  rejected: number;
  /** Runs whose |t| is at least the slides' 2.666. */
  asFar: number;
}

function emptyTally(): Tally {
  return { counts: new Array<number>(BINS).fill(0), total: 0, sumB: 0, rejected: 0, asFar: 0 };
}

/** Monitors 12 new workers: same assembly times, defect rates drawn about the population line. */
function takeSample(pop: SlopePreset): Point[] {
  return ASSEMBLY_POINTS.map((p) => ({ x: p.x, y: pop.alpha + pop.beta * p.x + sampleNormal(0, pop.sigma) }));
}

/**
 * Take sample after sample of 12 workers from a population with a known
 * slope β, and pile up the sample slopes b over their Normal sampling
 * distribution.
 *
 * @param params.preset — id of the population to open with, from
 *   `SLOPE_PRESETS`; defaults to β = −0.398, the slides' fitted line.
 */
export default function SlopeSampling({ params }: { params: VizParams }) {
  const initial = SLOPE_PRESETS.find((p) => p.id === params.preset) ?? SLOPE_PRESETS[0];

  const [pop, setPop] = useState<SlopePreset>(initial);
  const [tally, setTally] = useState<Tally>(emptyTally);
  /** The most recent single run; null after a batch, a reset, or at the start. */
  const [last, setLast] = useState<{ points: Point[]; fit: Fit } | null>(null);
  const [runId, setRunId] = useState(0);
  const drop = useReplayTween([runId], 420);
  const clipId = useId();

  const sdB = pop.sigma / Math.sqrt(SXX);
  const isNull = pop.beta === 0;

  function clearTally() {
    setTally(emptyTally());
    setLast(null);
  }

  function loadPreset(next: SlopePreset) {
    setPop(next);
    clearTally();
  }

  function run(times: number) {
    const counts = tally.counts.slice();
    let { total, sumB, rejected, asFar } = tally;
    let sample: { points: Point[]; fit: Fit } | null = null;
    for (let k = 0; k < times; k++) {
      const points = takeSample(pop);
      const fit = fitLine(points);
      const t = fit.b / fit.seB;
      const bin = Math.floor((fit.b - B_VIEW[0]) / BIN_W);
      if (bin >= 0 && bin < BINS) counts[bin] += 1;
      total += 1;
      sumB += fit.b;
      if (Math.abs(t) > T_CRIT) rejected += 1;
      if (Math.abs(t) >= Math.abs(EXAMPLE_T)) asFar += 1;
      sample = { points, fit };
    }
    setTally({ counts, total, sumB, rejected, asFar });
    if (times === 1) {
      setLast(sample);
      setRunId((id) => id + 1);
    } else {
      setLast(null);
    }
  }

  // --- Scatterplot: the latest run, or the slides' own 12 workers ---
  const shown = last ?? { points: ASSEMBLY_POINTS, fit: EXAMPLE_FIT };
  const sxOf = (x: number) => PLOT_X0 + ((x - X_VIEW[0]) / (X_VIEW[1] - X_VIEW[0])) * (PLOT_X1 - PLOT_X0);
  const syOf = (y: number) => SC_AXIS - ((y - Y_VIEW[0]) / (Y_VIEW[1] - Y_VIEW[0])) * (SC_AXIS - SC_Y0);
  const lineAt = (a: number, b: number) => ({
    x1: sxOf(X_VIEW[0]),
    y1: syOf(a + b * X_VIEW[0]),
    x2: sxOf(X_VIEW[1]),
    y2: syOf(a + b * X_VIEW[1]),
  });

  // --- Slope chart ---
  const bxOf = (b: number) => PLOT_X0 + ((b - B_VIEW[0]) / (B_VIEW[1] - B_VIEW[0])) * (PLOT_X1 - PLOT_X0);
  const density = (count: number) => (tally.total > 0 ? count / (tally.total * BIN_W) : 0);
  const maxObserved = tally.counts.reduce((m, v) => Math.max(m, density(v)), 0);
  const curveTop = normalPdf(pop.beta, pop.beta, sdB);
  const top = Math.max(curveTop, tally.total >= MIN_FOR_SCALE ? Math.min(maxObserved, 1.5 * curveTop) : 0) * 1.12;
  const byOf = (f: number) => B_AXIS - Math.min(1, f / top) * (B_AXIS - B_Y0);
  const curve = Array.from({ length: 201 }, (_, i) => {
    const b = B_VIEW[0] + (i / 200) * (B_VIEW[1] - B_VIEW[0]);
    return `${bxOf(b).toFixed(1)} ${byOf(normalPdf(b, pop.beta, sdB)).toFixed(1)}`;
  });
  const lastBin = last ? Math.floor((last.fit.b - B_VIEW[0]) / BIN_W) : -1;
  const clampB = (b: number) => Math.min(PLOT_X1, Math.max(PLOT_X0, bxOf(b)));
  const bTicks = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6];

  // --- Read-out ---
  const t = shown.fit.b / shown.fit.seB;
  const tWorking = `b = ${fmt(shown.fit.b, 3)}, t = b / se(b) = ${fmt(shown.fit.b, 3)} / ${fmt(shown.fit.seB, 3)} = `;
  const rejects = Math.abs(t) > T_CRIT;
  const decision = `|t| ${rejects ? ">" : "<"} ${fmt(T_CRIT, 3)}: ${rejects ? "reject" : "do not reject"} H₀`;
  const tallyText =
    tally.total < MIN_FOR_PERCENT
      ? `Population: defect rate = ${fmt(pop.alpha, 3)} ${pop.beta < 0 ? "−" : "+"} ${fmt(Math.abs(pop.beta), 3)}x, give or take σ = ${fmt(pop.sigma, 3)}.`
      : isNull
        ? `${tally.total.toLocaleString()} samples with no relationship: ${pct(tally.rejected / tally.total)} had |t| > ${fmt(T_CRIT, 3)} (should be 5%), and ${pct(tally.asFar / tally.total)} had |t| ≥ ${fmt(Math.abs(EXAMPLE_T), 3)} like the example's (p-value = ${fmt(EXAMPLE_P, 4)}).`
        : `${tally.total.toLocaleString()} samples: the slopes average ${fmt(tally.sumB / tally.total, 3)} (β = ${trim(pop.beta)}), and ${pct(tally.rejected / tally.total)} of them reject H₀: β = 0.`;
  /** One plain sentence on what the picture currently means. */
  const interpretation =
    tally.total >= MIN_FOR_PERCENT
      ? isNull
        ? `With no relationship at all, a t as far from 0 as the example's ${fmt(EXAMPLE_T, 3)}, in either direction, is rare, which is why the test rejects H₀.`
        : "The sample slopes pile up in a Normal curve centred on the true slope β: b is a random variable, and β is what it estimates."
      : last
        ? "A new sample of 12 workers gives a new line and a new slope, even though the population has not changed."
        : "These are the 12 workers in the example. Press the run button to see what a different 12 would have given.";

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
    }`;
  const runButton =
    "px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700";

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="flex flex-wrap gap-1.5">
        {SLOPE_PRESETS.map((q) => (
          <button key={q.id} onClick={() => loadPreset(q)} className={chip(pop.id === q.id)}>
            {q.label}
          </button>
        ))}
      </div>

      <VizHint>
        Press <strong className="font-semibold">Monitor 12 workers</strong> to take a new sample and see how much its slope changes.
      </VizHint>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mr-0.5">Run it</span>
        <button onClick={() => run(1)} className={runButton}>
          Monitor 12 workers
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

      {/* ---- Scatterplot of one sample ---- */}
      <svg viewBox={`0 0 ${W} ${SC_H}`} className="w-full h-auto max-h-[200px] select-none" role="img">
        <title>
          {`${last ? "One simulated sample" : "The example's sample"} of 12 workers, with the population line and the sample's least-squares line of slope ${fmt(shown.fit.b, 3)}.`}
        </title>
        {[-4, 0, 4, 8, 12, 16].map((v) => (
          <g key={v}>
            <line x1={PLOT_X0} y1={syOf(v)} x2={PLOT_X1} y2={syOf(v)} stroke="var(--color-line)" strokeWidth="0.6" />
            <text x={PLOT_X0 - 6} y={syOf(v) + 3.5} textAnchor="end" fontSize={VIZ_TEXT.axisTick} fill="var(--color-ink-700)">
              {v}
            </text>
          </g>
        ))}
        {[15, 20, 25, 30, 35].map((v) => (
          <text key={v} x={sxOf(v)} y={SC_AXIS + 13} textAnchor="middle" fontSize={VIZ_TEXT.axisTick} fill="var(--color-ink-700)">
            {v}
          </text>
        ))}
        <line x1={PLOT_X0} y1={SC_AXIS} x2={PLOT_X1} y2={SC_AXIS} stroke="var(--color-ink-900)" />
        <text x={(PLOT_X0 + PLOT_X1) / 2} y={SC_AXIS + 27} textAnchor="middle" fontSize={VIZ_TEXT.label} fill="var(--color-ink-700)">
          Assembly time, minutes (x)
        </text>
        <text x={10} y={(SC_Y0 + SC_AXIS) / 2} textAnchor="middle" fontSize={VIZ_TEXT.label} fill="var(--color-ink-700)" transform={`rotate(-90 10 ${(SC_Y0 + SC_AXIS) / 2})`}>
          Defect rate, %
        </text>

        <defs>
          <clipPath id={clipId}>
            <rect x={PLOT_X0} y={SC_Y0} width={PLOT_X1 - PLOT_X0} height={SC_AXIS - SC_Y0} />
          </clipPath>
        </defs>
        {/* Clipped rather than clamped, so a steep line keeps its true slope. */}
        <g clipPath={`url(#${clipId})`}>
          <line {...lineAt(pop.alpha, pop.beta)} stroke={MEAN_C} strokeWidth="1.5" strokeDasharray="6 4" />
          <line {...lineAt(shown.fit.a, shown.fit.b)} stroke={ACCENT} strokeWidth="2.2" />
          {shown.points.map((p, i) => (
            <circle key={i} cx={sxOf(p.x)} cy={syOf(p.y)} r={3.5} fill={ACCENT_DARK} stroke="white" strokeWidth="1" />
          ))}
        </g>
        {/* Legend: a short swatch of each line, then its name. */}
        <line x1={PLOT_X1 - 222} y1={SC_Y0 + 5} x2={PLOT_X1 - 204} y2={SC_Y0 + 5} stroke={MEAN_C} strokeWidth="1.5" strokeDasharray="4 3" />
        <text x={PLOT_X1 - 200} y={SC_Y0 + 8} fontSize={VIZ_TEXT.axisTick} fontWeight="600" fill={MEAN_C}>
          population line
        </text>
        <line x1={PLOT_X1 - 116} y1={SC_Y0 + 5} x2={PLOT_X1 - 98} y2={SC_Y0 + 5} stroke={ACCENT} strokeWidth="2.2" />
        <text x={PLOT_X1 - 94} y={SC_Y0 + 8} fontSize={VIZ_TEXT.axisTick} fontWeight="600" fill={ACCENT_DARK}>
          this sample&apos;s line
        </text>
      </svg>

      {/* ---- Slopes from every run ---- */}
      <svg viewBox={`0 0 ${W} ${B_H}`} className="w-full h-auto max-h-[240px] select-none" role="img">
        <title>
          {`${tally.total} sample slopes against their Normal sampling distribution, centred on β = ${trim(pop.beta)}.`}
        </title>
        <text x={PLOT_X0} y={12} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
          Slope b from every sample, against its Normal sampling distribution
        </text>

        {tally.counts.map((count, i) => {
          // A single run's bar waits for its dot to land.
          const h = count - (last && drop < 1 && i === lastBin ? 1 : 0);
          if (h <= 0) return null;
          const y = byOf(density(h));
          return (
            <rect
              key={i}
              x={bxOf(B_VIEW[0] + i * BIN_W)}
              y={y}
              width={Math.max(0.5, bxOf(BIN_W) - bxOf(0) - 0.5)}
              height={B_AXIS - y}
              fill={ACCENT}
              fillOpacity={0.2}
            />
          );
        })}
        <path d={`M ${curve.join(" L ")}`} fill="none" stroke={ACCENT_DARK} strokeWidth="2" />

        {/* The true slope β, which the sample slopes average out at. */}
        <line x1={bxOf(pop.beta)} y1={B_Y0 - 4} x2={bxOf(pop.beta)} y2={B_AXIS} stroke={MEAN_C} strokeWidth="1.5" strokeDasharray="4 3" />
        <text
          x={bxOf(pop.beta)}
          y={B_Y0 - 7}
          textAnchor="middle"
          fontSize={VIZ_TEXT.axisTick}
          fontWeight="600"
          fill={MEAN_C}
          stroke="white"
          strokeWidth="3"
          paintOrder="stroke"
        >
          β = {trim(pop.beta)}
        </text>

        {/* With β = 0, mark the example's own slope to show how far out it is,
            and its mirror image, since the test is two-sided. */}
        {isNull && (
          <>
            <line
              x1={bxOf(-EXAMPLE_FIT.b)}
              y1={B_Y0 + 14}
              x2={bxOf(-EXAMPLE_FIT.b)}
              y2={B_AXIS}
              stroke={INK}
              strokeOpacity={0.35}
              strokeWidth="2"
            />
            <line x1={bxOf(EXAMPLE_FIT.b)} y1={B_Y0 + 14} x2={bxOf(EXAMPLE_FIT.b)} y2={B_AXIS} stroke={INK} strokeWidth="2" />
            <text
              x={bxOf(EXAMPLE_FIT.b)}
              y={B_Y0 + 10}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fontWeight="600"
              fill={INK}
              stroke="white"
              strokeWidth="3"
              paintOrder="stroke"
            >
              example: b = {fmt(EXAMPLE_FIT.b, 3)}
            </text>
          </>
        )}

        {last && (
          <circle
            cx={clampB(last.fit.b)}
            cy={drop < 1 ? B_Y0 + (B_AXIS - 4 - B_Y0) * drop : B_AXIS - 4}
            r={4}
            fill={ACCENT_DARK}
            stroke="white"
            strokeWidth="1"
          />
        )}

        <line x1={PLOT_X0} y1={B_AXIS} x2={PLOT_X1} y2={B_AXIS} stroke="var(--color-ink-900)" />
        {bTicks.map((v) => (
          <text key={v} x={bxOf(v)} y={B_AXIS + 13} textAnchor="middle" fontSize={VIZ_TEXT.axisTick} fill="var(--color-ink-700)" className="tabular-nums">
            {fmt(v, 1)}
          </text>
        ))}
        <text x={(PLOT_X0 + PLOT_X1) / 2} y={B_AXIS + 29} textAnchor="middle" fontSize={VIZ_TEXT.label} fill="var(--color-ink-700)">
          sample slope b
        </text>
      </svg>

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            {last ? "This sample of 12 workers" : "The example's 12 workers"}
          </p>
          <VizGuide
            steps={[
              "Pick a population along the top. β = −0.398 takes the example's fitted line as the truth; β = 0 is a population with no relationship between assembly time and defect rate, which is what H₀ says.",
              "The top chart opens on the example's 12 workers, with the population line dashed and the sample's least-squares line in blue.",
              "Press Monitor 12 workers. New defect rates are drawn at the same assembly times, a new line is fitted, and its slope b drops onto the chart below.",
              "Press Repeat 500 times. The slopes pile up in a Normal curve centred on β: b is a random variable with a Normal sampling distribution.",
              "Switch to β = 0 and repeat. Count how often chance alone gives a t as far from 0 as the example's −2.666, in either direction: about 2.4% of samples, the p-value in the Excel output.",
            ]}
          />
        </div>
        {/* The working, then the answer. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          {tWorking}
          <span className="font-semibold">{fmt(t, 3)}</span>
        </p>
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          <span className="text-blue-700 font-semibold">=T.INV.2T(0.05, {DF}) = {fmt(T_CRIT, 3)}</span>, so{" "}
          <span className="font-semibold">{decision}</span>{" "}
          <span className="text-[12px] text-[color:var(--color-ink-500)]">(t{sub(DF)})</span>
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">{tallyText}</p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{interpretation}</p>
      </div>
    </div>
  );
}
