/**
 * Paired t-test viz, used by Module 5, WU7 (`m5-two-dependent-samples`).
 *
 * When each "before" reading belongs to the same person as an "after"
 * reading, the two samples collapse into one sample of differences d, and
 * the test is a one-sample t-test of H₀: μd = 0 with n − 1 degrees of
 * freedom. The viz shows that and, as the lecturer asked, pictures how
 * Excel's p-value commands work:
 *
 *   - A strip at the top shows the differences as a rug, with d̄ ± s_d and
 *     the μd = 0 that H₀ claims. It opens on the example's own differences
 *     (where the book prints them all) and shows each simulated run's after.
 *   - The chart below shades the example's p-value under the t-curve. For a
 *     two-sided test it first shades the right-hand tail beyond |t|, which is
 *     what T.DIST.RT works out, then mirrors it onto the left: T.DIST.2T is
 *     that right-hand tail doubled. "Replay" runs the picture again.
 *   - Every run draws a fresh sample of differences with H₀ true and piles
 *     its t up as a pale bar. The read-out counts how many runs land at
 *     least as far out as the example's t, which settles on the p-value.
 *
 * Default tier: hand-rolled SVG. Animations: the p-value shading builds up on
 * preset load and on Replay, and a single run's t drops onto the axis, both
 * via `useReplayTween`.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { VIZ_TEXT, VizHint } from "../shared";
import { sampleNormal } from "../sampling";
import { tCdf, tPdf } from "../tdist";
import { useReplayTween } from "../useReplayTween";
import { PAIRED_PRESETS, type PairedPreset, type PairedTail } from "../data/inferenceData";
import { fmt, pct, sub, trim } from "./format";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const INK = "rgb(15, 23, 42)"; // slate-900, the example's observed t
const MEAN_C = "rgb(0, 0, 0)"; // black, the book-wide mean colour

// SVG geometry (viewBox units).
const W = 440;
const PLOT_X0 = 20;
const PLOT_X1 = 420;
/** Differences strip. */
const STRIP_TOP = 22;
const STRIP_AXIS = 62;
/** Main chart: the t-curve, the shaded p-value and the pile of runs. */
const CHART_CAPTION_Y = 100;
const PLOT_Y0 = 128;
const AXIS_Y = 284;
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
/** How long the p-value picture takes to build: right tail, then its mirror. */
const SHADE_MS = 2200;

/** Whether a t is at least as far out as the example's, in H₁'s direction. */
function asExtreme(t: number, tail: PairedTail, tObs: number): boolean {
  return tail === "upper" ? t >= tObs : Math.abs(t) >= Math.abs(tObs);
}

/**
 * Widens the strip's reach either side of 0 (the axis runs from −reach to
 * +reach) so that its ticks, at 0, ±reach/2 and ±reach, are tidy whole
 * numbers: reach/2 is rounded up to 1, 2, 3, 4, 5, 6 or 8 times a power of
 * ten. Assumes reach/2 is at least 1, which every preset's s_d gives.
 */
function niceHalfSpan(reach: number): number {
  const half = reach / 2;
  const step = 10 ** Math.floor(Math.log10(half));
  const tidy = [1, 2, 3, 4, 5, 6, 8, 10].find((m) => m * step >= half) ?? 10;
  return 2 * tidy * step;
}

/** One sample of differences, kept so the strip and read-out can show it. */
interface Run {
  d: number[];
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
  /** Runs at least as far out as the example's own t. */
  asExtreme: number;
}

function emptyTally(): Tally {
  return { counts: new Array<number>(BINS).fill(0), total: 0, asExtreme: 0 };
}

/**
 * Picture the p-value of a paired t-test as a tail area, and check it by
 * running the experiment over and over with H₀ true.
 *
 * @param params.preset — id of the worked example to open with, from
 *   `PAIRED_PRESETS`; defaults to the dizzy spells of Example 8A.
 */
export default function PairedT({ params }: { params: VizParams }) {
  const initial = PAIRED_PRESETS.find((p) => p.id === params.preset) ?? PAIRED_PRESETS[0];

  const [preset, setPreset] = useState<PairedPreset>(initial);
  const [tally, setTally] = useState<Tally>(emptyTally);
  /** The most recent single run; null after a batch or a reset. */
  const [last, setLast] = useState<Run | null>(null);
  const [runId, setRunId] = useState(0);
  /** Bumped by Replay, to build the p-value picture again. */
  const [replay, setReplay] = useState(0);
  const drop = useReplayTween([runId], 420);
  // Keyed off the preset and Replay only, never off a run, so pressing Run
  // does not restart the shading.
  const shade = useReplayTween([preset.id, replay], SHADE_MS);

  const { n, dbar, sd, tail, alpha } = preset;
  const df = n - 1;
  // The example's t, rounded to two decimals as the text prints it and as the
  // brief enters it into Excel.
  const tObs = Number((dbar / (sd / Math.sqrt(n))).toFixed(2));
  const rightTail = 1 - tCdf(Math.abs(tObs), df);
  const p = tail === "two" ? 2 * rightTail : 1 - tCdf(tObs, df);
  const rejects = p < alpha;

  const xOf = (t: number) => PLOT_X0 + ((t - T_LO) / (T_HI - T_LO)) * (PLOT_X1 - PLOT_X0);
  const clampX = (t: number) => Math.min(PLOT_X1, Math.max(PLOT_X0, xOf(t)));

  function clearTally() {
    setTally(emptyTally());
    setLast(null);
  }

  /** Take `times` fresh samples of differences with H₀ true and score each t. */
  function run(times: number) {
    const counts = tally.counts.slice();
    let { total, asExtreme: extreme } = tally;
    let latest: Run | null = null;
    for (let k = 0; k < times; k++) {
      const d = Array.from({ length: n }, () => sampleNormal(0, sd));
      const mean = d.reduce((a, v) => a + v, 0) / n;
      const s = Math.sqrt(d.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1));
      const t = mean / (s / Math.sqrt(n));
      latest = { d, mean, sd: s, t };
      const bin = Math.floor((t - T_LO) / BIN_W);
      if (bin >= 0 && bin < BINS) counts[bin] += 1;
      total += 1;
      if (asExtreme(t, tail, tObs)) extreme += 1;
    }
    setTally({ counts, total, asExtreme: extreme });
    if (times === 1) {
      setLast(latest);
      setRunId((k) => k + 1);
    } else {
      setLast(null);
    }
  }

  function loadPreset(next: PairedPreset) {
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

  // The p-value as shaded area. Two-sided: the right tail fades in first,
  // then, after a short pause, its mirror. The tween eases out, so the
  // thresholds on `shade` (0.5 and 0.8) fall at about 20% and 40% of its run.
  const absT = Math.min(Math.abs(tObs), T_HI);
  const rightIn = Math.min(1, shade / 0.5);
  const leftIn = Math.max(0, (shade - 0.8) / 0.2);
  const rightOpacity = 0.4 * rightIn;
  const leftOpacity = 0.4 * leftIn;
  const shaded =
    tail === "two"
      ? [
          { d: area(absT, T_HI), opacity: rightOpacity },
          { d: area(T_LO, -absT), opacity: leftOpacity },
        ]
      : [{ d: area(Math.max(T_LO, tObs), T_HI), opacity: 0.4 * shade }];

  // Labels for the shaded areas, placed in the middle of each tail.
  const labelY = PLOT_Y0 + 60;
  // The right tail is printed to five decimals so that doubling it visibly
  // gives the four-decimal T.DIST.2T: 2 × 0.05525 = 0.1105, where 2 × 0.0553
  // would not.
  const rtText = `T.DIST.RT(${fmt(Math.abs(tObs), 2)}, ${df}) = ${fmt(rightTail, 5)}`;

  // --- Differences strip ---
  const shown = last
    ? { d: last.d as number[] | null, mean: last.mean, sd: last.sd }
    : { d: preset.differences ?? null, mean: dbar, sd };
  const span = niceHalfSpan(Math.max(3.5 * sd, Math.abs(dbar) + 1.5 * sd));
  const sxOf = (v: number) =>
    Math.min(PLOT_X1, Math.max(PLOT_X0, PLOT_X0 + ((v + span) / (2 * span)) * (PLOT_X1 - PLOT_X0)));
  const stripTicks = [-1, -0.5, 0, 0.5, 1].map((k) => k * span);

  // --- Read-out ---
  const tWorking = `, so t${sub(df)} = (${trim(dbar)} − 0)/(${trim(sd)}/√${n}) = ${fmt(tObs, 2)}`;
  const pWorking =
    tail === "two"
      ? `p = T.DIST.2T(${fmt(Math.abs(tObs), 2)}, ${df}) = 2 × ${fmt(rightTail, 5)} = `
      : `p = T.DIST.RT(${fmt(tObs, 2)}, ${df}) = `;
  const decision = `${fmt(p, 4)} ${rejects ? "<" : ">"} ${alpha}: ${rejects ? "reject" : "do not reject"} H₀`;

  const runText = last
    ? `This run: d̄ = ${fmt(last.mean, preset.dp)}, s = ${fmt(last.sd, preset.dp)}, so t = ${fmt(last.t, 2)}. `
    : "";
  const extremeWord = tail === "two" ? "as far from 0 as" : "at or above";
  const tallyText =
    tally.total >= MIN_FOR_PERCENT
      ? `${tally.total.toLocaleString()} runs with H₀ true: ${pct(tally.asExtreme / tally.total)} ${extremeWord} the example's ${fmt(tObs, 2)} (p-value ${pct(p)}).`
      : `${n} pairs give ${n} differences, so t has n − 1 = ${df} degrees of freedom.`;

  /** One plain sentence on what the picture currently means. */
  const interpretation =
    tail === "two"
      ? `T.DIST.2T only takes a positive t: it finds the right-hand tail beyond |t| and doubles it, because the left-hand tail is its mirror image.`
      : tail === "upper" && tObs < 0
        ? `H₁ expects a positive mean difference, but the example's t is negative, so almost all of the curve lies above it: the data give no support to H₁.`
        : `The shaded area is the chance, with H₀ true, of a t at least as far out as the example's.`;

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
    }`;
  const runButton =
    "px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700";
  const quietButton =
    "px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-500)] transition-colors hover:border-blue-400";

  const dotY = PLOT_Y0 + (AXIS_Y - 4 - PLOT_Y0) * drop;
  const lastBin = last ? Math.floor((last.t - T_LO) / BIN_W) : -1;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="flex flex-wrap gap-1.5">
        {PAIRED_PRESETS.map((q) => (
          <button key={q.id} onClick={() => loadPreset(q)} className={chip(preset.id === q.id)}>
            {q.label}
          </button>
        ))}
      </div>

      <VizHint>
        The shaded area is the p-value. Press{" "}
        <strong className="font-semibold">Repeat 500 times</strong> to see it come true.
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
        <button onClick={clearTally} className={quietButton}>
          Reset
        </button>
        {tail === "two" && (
          <button onClick={() => setReplay((k) => k + 1)} className={quietButton}>
            Replay the doubling
          </button>
        )}
      </div>

      <div className="shrink-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[520px] select-none">
          <title>
            {`Top: ${last ? "one simulated sample" : "the example's sample"} of ${n} differences ${preset.dName}. Bottom: the t-distribution with ${df} degrees of freedom, with the example's p-value shaded and ${tally.total} simulated t values piled underneath.`}
          </title>

          {/* ---- Differences strip ---- */}
          <text x={PLOT_X0} y={12} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
            {last ? "One run's" : "The example's"} differences, d = {preset.dName}
          </text>
          {shown.d ? (
            // Values as a rug: only their position along the axis means anything.
            shown.d.map((v, i) => (
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
            ))
          ) : (
            // Top left, clear of the bracket and the μd = 0 line.
            <text x={PLOT_X0} y={STRIP_TOP + 4} fontSize={VIZ_TEXT.axisTick} fill="var(--color-ink-400)">
              (the book prints only some of the pairs)
            </text>
          )}
          {/* d̄ ± s_d as a bracket */}
          <line
            x1={sxOf(shown.mean - shown.sd)}
            y1={STRIP_AXIS - 18}
            x2={sxOf(shown.mean + shown.sd)}
            y2={STRIP_AXIS - 18}
            stroke={ACCENT_DARK}
            strokeWidth="1.5"
          />
          {[shown.mean - shown.sd, shown.mean + shown.sd].map((v) => (
            <line key={v} x1={sxOf(v)} y1={STRIP_AXIS - 22} x2={sxOf(v)} y2={STRIP_AXIS - 14} stroke={ACCENT_DARK} strokeWidth="1.5" />
          ))}
          <line x1={sxOf(shown.mean)} y1={STRIP_AXIS - 26} x2={sxOf(shown.mean)} y2={STRIP_AXIS} stroke={ACCENT_DARK} strokeWidth="2" />
          <text
            x={sxOf(shown.mean + shown.sd) + 4}
            y={STRIP_AXIS - 15}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={ACCENT_DARK}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            d̄ ± s
            <tspan fontSize={VIZ_TEXT.axisTick - 2} dy="2">
              d
            </tspan>
          </text>
          {/* The μd = 0 that H₀ claims: black and dashed, as every mean marker. */}
          <line x1={sxOf(0)} y1={STRIP_TOP} x2={sxOf(0)} y2={STRIP_AXIS} stroke={MEAN_C} strokeWidth="1.5" strokeDasharray="4 3" />
          <text
            x={sxOf(0) + 4}
            y={STRIP_TOP + 4}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={MEAN_C}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            H₀: μ
            <tspan fontSize={VIZ_TEXT.axisTick - 2} dy="2">
              d
            </tspan>
            <tspan dy="-2"> = 0</tspan>
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
              {fmt(v, 0)}
            </text>
          ))}

          {/* ---- Main chart ---- */}
          <text x={PLOT_X0} y={CHART_CAPTION_Y} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
            The p-value under <tspan fill={ACCENT_DARK}>t{sub(df)}</tspan>, with t from every run
          </text>

          {/* Simulated t values as pale bars, under everything else */}
          {tally.counts.map((k, i) => {
            // A single run's bar waits for its dot to land.
            const count = k - (last && drop < 1 && i === lastBin ? 1 : 0);
            if (count <= 0) return null;
            const x0 = xOf(T_LO + i * BIN_W);
            const y = yOf(density(count));
            return (
              <rect
                key={i}
                x={x0}
                y={y}
                width={Math.max(0.5, xOf(T_LO + BIN_W) - xOf(T_LO) - 0.5)}
                height={AXIS_Y - y}
                fill={ACCENT}
                fillOpacity={0.15}
              />
            );
          })}

          {shaded.map((s, i) => (
            <path key={i} d={s.d} fill={ACCENT} fillOpacity={s.opacity} />
          ))}
          <path d={tPath} fill="none" stroke={ACCENT_DARK} strokeWidth="2" />

          {/* Tail labels: what each shaded area is, in Excel's terms. */}
          {tail === "two" ? (
            <g fontSize={VIZ_TEXT.axisTick} fontWeight="600" stroke="white" strokeWidth="3" paintOrder="stroke">
              <text x={PLOT_X1} y={labelY} textAnchor="end" fill={ACCENT_DARK} opacity={rightIn}>
                {rtText}
              </text>
              <text x={PLOT_X0} y={labelY} textAnchor="start" fill={ACCENT_DARK} opacity={leftIn}>
                mirror image: {fmt(rightTail, 5)}
              </text>
              {/* Under the right-hand label, where the curve is already low. */}
              <text x={PLOT_X1} y={labelY + 16} textAnchor="end" fill={INK} opacity={leftIn}>
                × 2 = T.DIST.2T = {fmt(p, 4)}
              </text>
            </g>
          ) : (
            <text
              x={PLOT_X1}
              y={labelY}
              textAnchor="end"
              fontSize={VIZ_TEXT.axisTick}
              fontWeight="600"
              fill={ACCENT_DARK}
              stroke="white"
              strokeWidth="3"
              paintOrder="stroke"
              opacity={shade}
            >
              shaded: p = {fmt(p, 4)}
            </text>
          )}

          {/* The example's own t, and its mirror for a two-sided test */}
          <line x1={clampX(tObs)} y1={PLOT_Y0 + 4} x2={clampX(tObs)} y2={AXIS_Y} stroke={INK} strokeWidth="2" />
          {tail === "two" && (
            <line
              x1={clampX(-tObs)}
              y1={PLOT_Y0 + 24}
              x2={clampX(-tObs)}
              y2={AXIS_Y}
              stroke={INK}
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity={leftIn}
            />
          )}
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
              "Pick a worked example along the top. The strip shows its differences d, with d̄ ± s (s is the standard deviation of the differences) and the μd = 0 that H₀ claims.",
              "The shaded area under the t-curve is the example's p-value. For a two-sided test, watch it build: T.DIST.2T finds the right-hand tail beyond |t|, then doubles it. Press Replay the doubling to see it again.",
              "Press the first run button to take a fresh sample of differences with H₀ true. Its d values replace the example's in the strip, and its t drops onto the chart.",
              "Press Repeat 500 times. The share of runs at least as far out as the example's t comes close to the p-value.",
            ]}
          />
        </div>
        {/* The working, then the answer. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          d̄ = {trim(dbar)}, s<sub>d</sub> = {trim(sd)}
          {tWorking}
        </p>
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          {pWorking}
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
