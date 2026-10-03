/**
 * Hypothesis-test viz for the z-test, used by Module 5, WU3 (`m5-testing-mu`)
 * and WU4 (`m5-comparing-two-means`).
 *
 * The chart is the distribution of the test statistic Z when H₀ is true: the
 * standard Normal curve. On it sit the worked example's observed z (a dark
 * line) and, depending on how the example reaches its decision, either
 *
 *   - the rejection region for the chosen significance level α ("critical"
 *     presets, the six-step plan of WU3 and the two-sample tests of WU4), or
 *   - the tail at or beyond the observed z, whose area is the p-value
 *     ("p-value" presets, the modified procedure of WU4).
 *
 * The student runs the study. Each run takes fresh samples, works out their
 * z and drops it on the axis; the runs pile up as pale bars under the curve.
 * With the critical approach the student also picks what is really true:
 * with H₀ true every rejection is a Type I error and they come up about α of
 * the time; with H₀ false (the true mean set to the example's x̄) every
 * failure to reject is a Type II error. With the p-value approach every run
 * assumes H₀, because that is how a p-value is defined, and the share of
 * runs as extreme as the example's z settles on p.
 *
 * Under the z-axis a second row of ticks gives the matching value of x̄ (or
 * x̄₁ − x̄₂), so the cut-off can be read in the units of the example.
 *
 * Default tier: hand-rolled SVG. The only animation is a single run's z
 * dropping onto the axis, via `useReplayTween`.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { VIZ_TEXT, VizHint } from "../shared";
import { sampleNormal } from "../sampling";
import { normalCdf, normalPdf } from "../normal";
import { useReplayTween } from "../useReplayTween";
import { ZTEST_PRESETS, type Tail, type ZTestPreset } from "../data/inferenceData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const INK = "rgb(15, 23, 42)"; // slate-900, the observed z

/**
 * Critical values from the textbook, rounded to two decimals as its examples
 * use them, keyed by α. A two-sided test splits α between the two tails, so
 * its cut-off is the one-sided value for α/2.
 */
const CRITICAL: Record<"one" | "two", Record<number, number>> = {
  one: { 0.1: 1.28, 0.05: 1.64, 0.01: 2.33 },
  two: { 0.1: 1.64, 0.05: 1.96, 0.01: 2.58 },
};
const ALPHAS = [0.1, 0.05, 0.01];

// SVG geometry (viewBox units).
const W = 440;
const PLOT_X0 = 20;
const PLOT_X1 = 420;
const PLOT_Y0 = 34;
const AXIS_Y = 196;
const H = AXIS_Y + 58;
/** Visible stretch of the z-axis. Draws beyond it still count in the tally. */
const Z_LO = -4.5;
const Z_HI = 4.5;
const BIN_W = 0.25;
const BINS = Math.round((Z_HI - Z_LO) / BIN_W);
/** Runs needed before the bars, not just the curve, set the chart's height. */
const MIN_FOR_SCALE = 50;
const CURVE_STEPS = 180;
/** Room, in viewBox units, the "p = 0.0708" label needs beside the observed z. */
const P_LABEL_W = 64;

/** Formats a number with a true minus sign, as the text prints it. */
function fmt(v: number, dp: number): string {
  const s = v.toFixed(dp);
  return s.startsWith("-") ? `−${s.slice(1)}` : s;
}

/** Rounds to two decimals, as the text does to z before deciding or finding p. */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Standard error of the statistic: σ/√n, or √(σ₁²/n₁ + σ₂²/n₂). */
function standardError(p: ZTestPreset): number {
  const d = p.design;
  return d.kind === "one"
    ? d.sigma / Math.sqrt(d.n)
    : Math.sqrt((d.sigma1 * d.sigma1) / d.n1 + (d.sigma2 * d.sigma2) / d.n2);
}

/** The example's observed statistic: x̄, or x̄₁ − x̄₂. */
function observedStat(p: ZTestPreset): number {
  const d = p.design;
  return d.kind === "one" ? d.xbar : d.xbar1 - d.xbar2;
}

/** The statistic's value under H₀: μ₀, or 0 for a difference of means. */
function nullStat(p: ZTestPreset): number {
  return p.design.kind === "one" ? p.design.mu0 : 0;
}

/** Whether a z lies in the rejection region with cut-off c. */
function rejects(z: number, tail: Tail, c: number): boolean {
  if (tail === "lower") return z < -c;
  if (tail === "upper") return z > c;
  return Math.abs(z) > c;
}

/** Whether a z is at least as extreme as the observed z, in the direction of H₁. */
function asExtreme(z: number, tail: Tail, zObs: number): boolean {
  if (tail === "lower") return z <= zObs;
  if (tail === "upper") return z >= zObs;
  return Math.abs(z) >= Math.abs(zObs);
}

/** Running tally of simulated z values. */
interface Tally {
  /** How many z values fell in each bin, from `Z_LO`. */
  counts: number[];
  /** Every run, including any whose z fell off the chart. */
  total: number;
  /** Runs that rejected H₀ (critical) or were as extreme as the example (p-value). */
  flagged: number;
}

function emptyTally(): Tally {
  return { counts: new Array<number>(BINS).fill(0), total: 0, flagged: 0 };
}

/**
 * Run a z-test's study over and over and watch where the test statistic
 * lands, against the rejection region or the p-value tail.
 *
 * @param params.preset — id of the worked example to open with, from
 *   `ZTEST_PRESETS`; defaults to the batteries of Example 6A. The picker then
 *   offers the other examples from the same unit only.
 */
export default function ZTest({ params }: { params: VizParams }) {
  const initial = ZTEST_PRESETS.find((p) => p.id === params.preset) ?? ZTEST_PRESETS[0];
  const siblings = ZTEST_PRESETS.filter((p) => p.unit === initial.unit);

  const [preset, setPreset] = useState<ZTestPreset>(initial);
  const [alpha, setAlpha] = useState(initial.alpha);
  /** What is really true in the simulation. Only the critical approach offers a choice. */
  const [h0True, setH0True] = useState(true);
  const [tally, setTally] = useState<Tally>(emptyTally);
  /** The statistic and z of the most recent single run; null after a batch or reset. */
  const [last, setLast] = useState<{ stat: number; z: number } | null>(null);
  const [runId, setRunId] = useState(0);
  const drop = useReplayTween([runId], 420);

  const d = preset.design;
  const tail = preset.tail;
  const isCritical = preset.approach === "critical";
  // Every run under the p-value approach assumes H₀, whatever the chip said.
  const simH0 = isCritical ? h0True : true;
  const se = standardError(preset);
  const stat0 = nullStat(preset);
  const statObs = observedStat(preset);
  const zObs = round2((statObs - stat0) / se);
  const c = CRITICAL[tail === "two" ? "two" : "one"][alpha];
  const exampleRejects = rejects(zObs, tail, c);

  // p-value from the rounded z, as the text works it with =NORM.S.DIST.
  const tailArea = tail === "upper" || (tail === "two" && zObs > 0)
    ? 1 - normalCdf(zObs)
    : normalCdf(zObs);
  const pValue = tail === "two" ? 2 * tailArea : tailArea;

  const dp = preset.dp;
  /**
   * Prints one of the example's figures as the text does: trailing zeros
   * dropped (100, not 100.0) except for rand amounts, which keep their cents.
   */
  const fmtData = (v: number) => {
    const t = fmt(v, dp);
    return preset.keepZeros || !t.includes(".") ? t : t.replace(/\.?0+$/, "");
  };
  const statName = d.kind === "one" ? "x̄" : "x̄₁ − x̄₂";
  const nullText = d.kind === "one" ? `μ = ${fmtData(d.mu0)}` : "μ₁ = μ₂";
  const altText =
    d.kind === "one" ? `μ = ${fmtData(d.xbar)}` : `μ₁ − μ₂ = ${fmtData(statObs)}`;
  const sym = d.kind === "one" ? "μ" : "μ₁ − μ₂";
  const nullValue = d.kind === "one" ? fmtData(d.mu0) : "0";
  const h1Sign = tail === "lower" ? "<" : tail === "upper" ? ">" : "≠";

  const xOf = (z: number) => PLOT_X0 + ((z - Z_LO) / (Z_HI - Z_LO)) * (PLOT_X1 - PLOT_X0);
  const clampX = (z: number) => Math.min(PLOT_X1, Math.max(PLOT_X0, xOf(z)));

  /** Forget every run so far. Called whenever the question on screen changes. */
  function clearTally() {
    setTally(emptyTally());
    setLast(null);
  }

  /** The mean of n draws from N(μ, σ²): one sample, actually taken. */
  function sampleMean(mu: number, sigma: number, n: number): number {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sampleNormal(mu, sigma);
    return sum / n;
  }

  /** Take `times` fresh samples (or pairs), work out each z and score it. */
  function run(times: number) {
    const counts = tally.counts.slice();
    let { total, flagged } = tally;
    let stat = 0;
    let z = 0;
    for (let t = 0; t < times; t++) {
      if (d.kind === "one") {
        stat = sampleMean(simH0 ? d.mu0 : d.xbar, d.sigma, d.n);
      } else {
        // Under H₀ both groups share one mean; which value does not matter,
        // since only the difference enters z.
        const mu2 = simH0 ? d.xbar1 : d.xbar2;
        stat = sampleMean(d.xbar1, d.sigma1, d.n1) - sampleMean(mu2, d.sigma2, d.n2);
      }
      z = (stat - stat0) / se;
      const bin = Math.floor((z - Z_LO) / BIN_W);
      if (bin >= 0 && bin < BINS) counts[bin] += 1;
      total += 1;
      if (isCritical ? rejects(z, tail, c) : asExtreme(z, tail, zObs)) flagged += 1;
    }
    setTally({ counts, total, flagged });
    if (times === 1) {
      setLast({ stat, z });
      setRunId((k) => k + 1);
    } else {
      setLast(null);
    }
  }

  function loadPreset(p: ZTestPreset) {
    setPreset(p);
    setAlpha(p.alpha);
    setH0True(true);
    clearTally();
  }

  // --- Chart scale: the N(0, 1) curve against the pile of simulated z ---
  const density = (count: number) => (tally.total > 0 ? count / (tally.total * BIN_W) : 0);
  const maxObserved = tally.counts.reduce((m, k) => Math.max(m, density(k)), 0);
  // As in `SamplingDistribution`, the bars only set the scale once there are
  // enough of them to have a shape; until then a tall bar is clipped.
  const top = Math.max(normalPdf(0, 0, 1), tally.total >= MIN_FOR_SCALE ? maxObserved : 0) * 1.12;
  const yOf = (f: number) => AXIS_Y - Math.min(1, f / top) * (AXIS_Y - PLOT_Y0);

  const curvePoints = (from: number, to: number) =>
    Array.from({ length: CURVE_STEPS + 1 }, (_, k) => {
      const z = from + (k / CURVE_STEPS) * (to - from);
      return `${xOf(z).toFixed(1)} ${yOf(normalPdf(z, 0, 1)).toFixed(1)}`;
    });
  const curvePath = `M ${curvePoints(Z_LO, Z_HI).join(" L ")}`;
  /** A filled area under the curve between two z values. */
  const area = (from: number, to: number) =>
    `M ${xOf(from)} ${AXIS_Y} L ${curvePoints(from, to).join(" L ")} L ${xOf(to)} ${AXIS_Y} Z`;

  // The shaded regions: the rejection region, or the p-value tail(s).
  const edge = isCritical ? c : Math.abs(zObs);
  const lowerShaded = tail === "lower" || tail === "two";
  const upperShaded = tail === "upper" || tail === "two";
  // A one-sided p-value tail follows the sign of z itself.
  const lowerEdge = isCritical || tail === "two" ? -edge : zObs;
  const upperEdge = isCritical || tail === "two" ? edge : zObs;

  // The p-value label goes inside the shaded tail on the side of the
  // observed z. When that tail is too close to the edge of the chart to hold
  // it, the label moves to the other side of the line with an arrow pointing
  // back at the tail, so it never seems to describe the unshaded area.
  const pText = `p = ${pValue.toFixed(4)}`;
  const tailOnLeft = zObs < 0;
  const roomInTail = tailOnLeft ? clampX(zObs) - PLOT_X0 : PLOT_X1 - clampX(zObs);
  const fitsInTail = roomInTail >= P_LABEL_W;
  const pLabel: { x: number; anchor: "start" | "end"; text: string } = tailOnLeft
    ? fitsInTail
      ? { x: clampX(zObs) - 6, anchor: "end", text: pText }
      : { x: clampX(zObs) + 6, anchor: "start", text: `← ${pText}` }
    : fitsInTail
      ? { x: clampX(zObs) + 6, anchor: "start", text: pText }
      : { x: clampX(zObs) - 6, anchor: "end", text: `${pText} →` };

  const zTicks = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  const lastX = last ? clampX(last.z) : 0;
  const dotY = PLOT_Y0 + (AXIS_Y - 4 - PLOT_Y0) * drop;
  const flaggedPct = tally.total > 0 ? (100 * tally.flagged) / tally.total : 0;
  const alphaPct = `${Math.round(alpha * 100)}%`;

  // --- Read-out lines ---
  const working =
    d.kind === "one"
      ? `z = (x̄ − μ₀)/(σ/√n) = (${fmtData(d.xbar)} − ${fmtData(d.mu0)})/(${d.sigma}/√${d.n}) = `
      : `z = (x̄₁ − x̄₂)/√(σ₁²/n₁ + σ₂²/n₂) = (${fmtData(d.xbar1)} − ${fmtData(d.xbar2)})/√(${d.sigma1}²/${d.n1} + ${d.sigma2}²/${d.n2}) = `;

  const cutText = tail === "lower" ? fmt(-c, 2) : fmt(c, 2);
  const decision = isCritical
    ? tail === "two"
      ? `|${fmt(zObs, 2)}| ${exampleRejects ? ">" : "<"} ${fmt(c, 2)}, so ${exampleRejects ? "reject" : "do not reject"} H₀ at the ${alphaPct} level`
      : `${fmt(zObs, 2)} ${(tail === "lower") === exampleRejects ? "<" : ">"} ${cutText}, so ${exampleRejects ? "reject" : "do not reject"} H₀ at the ${alphaPct} level`
    : null;

  const pProb =
    tail === "lower"
      ? `Pr(Z ≤ ${fmt(zObs, 2)})`
      : tail === "upper"
        ? `Pr(Z ≥ ${fmt(zObs, 2)})`
        : `2 × Pr(Z ${zObs > 0 ? "≥" : "≤"} ${fmt(zObs, 2)})`;
  const pWorking =
    tail === "two"
      ? `p = ${pProb} = 2 × ${tailArea.toFixed(4)} = `
      : `p = ${pProb} = `;
  const pSmall = pValue < 0.05;

  const extremeText =
    tail === "lower"
      ? `z ≤ ${fmt(zObs, 2)}`
      : tail === "upper"
        ? `z ≥ ${fmt(zObs, 2)}`
        : `|z| ≥ ${fmt(Math.abs(zObs), 2)}`;

  const truthText = simH0 ? nullText : altText;
  const tallyText = isCritical
    ? simH0
      ? `${tally.total.toLocaleString()} runs with ${truthText}: H₀ rejected in ${tally.flagged.toLocaleString()} (${flaggedPct.toFixed(1)}%), each a Type I error`
      : `${tally.total.toLocaleString()} runs with ${truthText}: H₀ not rejected in ${(tally.total - tally.flagged).toLocaleString()} (${(100 - flaggedPct).toFixed(1)}%), each a Type II error`
    : `${tally.total.toLocaleString()} runs with ${truthText}: ${tally.flagged.toLocaleString()} gave ${extremeText} (${flaggedPct.toFixed(flaggedPct < 1 ? 2 : 1)}%)`;

  /** One plain sentence on what the picture currently means. */
  const interpretation = isCritical
    ? tally.total === 0
      ? exampleRejects
        ? `The example's z lies in the rejection region: if H₀ were true, a z this far out would turn up less than ${alphaPct} of the time.`
        : `The example's z falls short of the rejection region, so the evidence is not strong enough to reject H₀ at the ${alphaPct} level.`
      : simH0
        ? `With H₀ true, every rejection is a Type I error, and they turn up about ${alphaPct} of the time: that is what the significance level means.`
        : `With H₀ false, every run that misses the rejection region is a Type II error. Pick a smaller α and these become more common.`
    : tally.total === 0
      ? `p is the chance, if H₀ were true, of a z at least as extreme as ${fmt(zObs, 2)}. It is ${pSmall ? "below" : "above"} 0.05, so we ${pSmall ? "reject" : "do not reject"} H₀.`
      : `With H₀ true, ${flaggedPct.toFixed(flaggedPct < 1 ? 2 : 1)}% of runs gave a z this extreme, close to p = ${pValue.toFixed(4)}. ${pSmall ? "Results like the example's are rare if H₀ holds: evidence against it." : "Results like the example's are not unusual if H₀ holds."}`;

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
      {/* Worked-example selector: this unit's examples only */}
      <div className="flex flex-wrap gap-1.5">
        {siblings.map((p) => (
          <button key={p.id} onClick={() => loadPreset(p)} className={chip(preset.id === p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <VizHint>
        {isCritical ? (
          <>
            Press <strong className="font-semibold">Repeat 500 times</strong> and count how
            often the test rejects H₀ when H₀ is true.
          </>
        ) : (
          <>
            Press <strong className="font-semibold">Repeat 500 times</strong>: the share of
            runs landing in the shaded tail is the p-value.
          </>
        )}
      </VizHint>

      <div className="rounded-lg border border-[color:var(--color-line)] px-3 py-2 space-y-2">
        {isCritical && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-[color:var(--color-ink-700)] mr-1">
                Significance α
              </span>
              {ALPHAS.map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    setAlpha(a);
                    clearTally();
                  }}
                  className={chip(alpha === a)}
                >
                  {Math.round(a * 100)}%
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-[color:var(--color-ink-700)] mr-1">
                In truth
              </span>
              <button
                onClick={() => {
                  setH0True(true);
                  clearTally();
                }}
                className={chip(h0True)}
              >
                {nullText}
              </button>
              <button
                onClick={() => {
                  setH0True(false);
                  clearTally();
                }}
                className={chip(!h0True)}
              >
                {altText}
              </button>
            </div>
          </>
        )}
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
      </div>

      <div className="shrink-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[440px] select-none">
          <title>
            The distribution of Z if H₀ is true, the standard Normal curve, with the
            example&apos;s z = {fmt(zObs, 2)} marked and{" "}
            {isCritical
              ? `the ${alphaPct} rejection region shaded`
              : `the tail beyond it shaded, area p = ${pValue.toFixed(4)}`}
            . {tally.total} simulated z values are piled under the curve.
          </title>

          <text x={PLOT_X0} y={14} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
            Z if H₀ is true: N(0, 1)
          </text>

          {/* Simulated z values as pale bars, under everything else */}
          {tally.counts.map((k, i) => {
            // A single run's bar waits for its dot to land.
            const shown = k - (last && drop < 1 && i === Math.floor((last.z - Z_LO) / BIN_W) ? 1 : 0);
            if (shown <= 0) return null;
            const x0 = xOf(Z_LO + i * BIN_W);
            const y = yOf(density(shown));
            return (
              <rect
                key={i}
                x={x0}
                y={y}
                width={Math.max(0.5, xOf(Z_LO + BIN_W) - xOf(Z_LO) - 0.5)}
                height={AXIS_Y - y}
                fill={ACCENT}
                fillOpacity={0.2}
              />
            );
          })}

          {/* Rejection region, or p-value tail(s) */}
          {lowerShaded && lowerEdge > Z_LO && (
            <path d={area(Z_LO, lowerEdge)} fill={ACCENT} fillOpacity={0.35} />
          )}
          {upperShaded && upperEdge < Z_HI && (
            <path d={area(upperEdge, Z_HI)} fill={ACCENT} fillOpacity={0.35} />
          )}

          <path d={curvePath} fill="none" stroke={ACCENT_DARK} strokeWidth="2" />

          {/* The example's observed z */}
          <line x1={clampX(zObs)} y1={PLOT_Y0 + 4} x2={clampX(zObs)} y2={AXIS_Y} stroke={INK} strokeWidth="2" />
          <text
            x={clampX(zObs)}
            y={PLOT_Y0}
            textAnchor="middle"
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={INK}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            example: z = {fmt(zObs, 2)}
          </text>

          {/* Cut-off labels: the critical values, or the p-value. Drawn after the
              observed z so their white halo keeps them legible where it crosses. */}
          {isCritical ? (
            <>
              {lowerShaded && (
                <g>
                  <line x1={xOf(-c)} y1={AXIS_Y} x2={xOf(-c)} y2={PLOT_Y0 + 38} stroke={ACCENT_DARK} strokeDasharray="3 3" />
                  <text x={xOf(-c) - 4} y={PLOT_Y0 + 34} textAnchor="end" fontSize={VIZ_TEXT.axisTick} fontWeight="600" fill={ACCENT_DARK} stroke="white" strokeWidth="3" paintOrder="stroke">
                    reject if z &lt; {fmt(-c, 2)}
                  </text>
                </g>
              )}
              {upperShaded && (
                <g>
                  <line x1={xOf(c)} y1={AXIS_Y} x2={xOf(c)} y2={PLOT_Y0 + 38} stroke={ACCENT_DARK} strokeDasharray="3 3" />
                  <text x={xOf(c) + 4} y={PLOT_Y0 + 34} fontSize={VIZ_TEXT.axisTick} fontWeight="600" fill={ACCENT_DARK} stroke="white" strokeWidth="3" paintOrder="stroke">
                    reject if z &gt; {fmt(c, 2)}
                  </text>
                </g>
              )}
            </>
          ) : (
            <text
              x={pLabel.x}
              y={AXIS_Y - 30}
              textAnchor={pLabel.anchor}
              fontSize={VIZ_TEXT.axisTick}
              fontWeight="600"
              fill={ACCENT_DARK}
              stroke="white"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {pLabel.text}
            </text>
          )}

          {/* A single run's z dropping onto the axis */}
          {last && (
            <circle cx={lastX} cy={drop < 1 ? dotY : AXIS_Y - 4} r={4} fill={ACCENT_DARK} stroke="white" strokeWidth="1" />
          )}

          <line x1={PLOT_X0} y1={AXIS_Y} x2={PLOT_X1} y2={AXIS_Y} stroke="var(--color-ink-900)" />
          {zTicks.map((t) => (
            <g key={t}>
              <text x={xOf(t)} y={AXIS_Y + 13} textAnchor="middle" fontSize={VIZ_TEXT.axisTick} fill="var(--color-ink-700)" className="tabular-nums">
                {fmt(t, 0)}
              </text>
              {/* The matching value of the statistic, so the cut-off can be
                  read in the example's own units. Left off at ±4, where the
                  wider numbers would crowd the row's "x̄" caption. */}
              {Math.abs(t) < 4 && (
                <text x={xOf(t)} y={AXIS_Y + 26} textAnchor="middle" fontSize={9} fill="var(--color-ink-500)" className="tabular-nums">
                  {fmtData(stat0 + t * se)}
                </text>
              )}
            </g>
          ))}
          <text x={PLOT_X0} y={AXIS_Y + 13} textAnchor="start" fontSize={VIZ_TEXT.axisTick} fontWeight="600" fill="var(--color-ink-700)">
            z
          </text>
          <text x={PLOT_X0} y={AXIS_Y + 26} textAnchor="start" fontSize={9} fill="var(--color-ink-500)">
            {statName}
          </text>
          <text x={(PLOT_X0 + PLOT_X1) / 2} y={AXIS_Y + 46} textAnchor="middle" fontSize={VIZ_TEXT.label} fill="var(--color-ink-700)">
            test statistic z, with the matching {statName} underneath
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
            steps={
              isCritical
                ? [
                    "Pick a worked example along the top. The curve is the distribution of Z if H₀ is true; the dark line is the example's own z.",
                    "The shaded tail is the rejection region for the chosen significance level α. Change α and watch the cut-off move.",
                    "With H₀ true, press Repeat 500 times. Each run is a fresh sample, and every z that lands in the shaded region is a Type I error: about α of them.",
                    "Switch In truth to the other value, where H₀ is false, and repeat. Now every z outside the region is a Type II error.",
                    "Under the z-axis, the grey row gives the matching value of the sample statistic, so the cut-off can be read in the example's units.",
                  ]
                : [
                    "Pick a worked example along the top. The curve is the distribution of Z if H₀ is true; the dark line is the example's own z.",
                    "The shaded tail holds every z at least as extreme as the example's, in the direction of H₁. Its area is the p-value.",
                    "Press Repeat 500 times. Every run assumes H₀ is true, and the share of runs landing in the shaded tail settles close to p.",
                    "A small p means results like the example's would be rare if H₀ were true, which is evidence against H₀.",
                  ]
            }
          />
        </div>
        <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-700)]">
          H₀: {sym} = {nullValue} &nbsp;·&nbsp; H₁: {sym} {h1Sign} {nullValue}
        </p>
        {/* The working, then the answer, then the decision. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          {working}
          <span className="font-semibold">{fmt(zObs, 2)}</span>
        </p>
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          {isCritical ? (
            <span className="font-semibold text-blue-700">{decision}</span>
          ) : (
            <>
              {pWorking}
              <span className="font-semibold text-blue-700">{pValue.toFixed(4)}</span>
            </>
          )}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
          {last
            ? `This run: ${statName} = ${fmt(last.stat, dp + 1)}, z = ${fmt(last.z, 2)}. `
            : ""}
          {tally.total > 0 ? tallyText : `Runs will assume ${truthText}.`}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{interpretation}</p>
      </div>
    </div>
  );
}
