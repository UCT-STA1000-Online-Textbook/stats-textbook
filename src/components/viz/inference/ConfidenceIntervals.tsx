/**
 * Confidence-interval coverage viz, used by Module 5, WU2
 * (`m5-confidence-intervals`).
 *
 * The hard idea in this unit is what "95% confidence" is a statement about.
 * It is not about one interval, which either contains μ or does not; it is
 * about the *method*, which catches μ in about 95 out of every 100 samples.
 * The viz lets the student check that claim by running the study:
 *
 *   - Before any run, the chart shows the worked example's own interval,
 *     x̄ ± z·σ/√n, against the true μ (red, dashed).
 *   - Each run takes a fresh sample of n, works out its interval and stacks
 *     it on top of the earlier ones. Intervals that catch μ are blue; the
 *     ones that miss it are red. The read-out keeps score and compares the
 *     hit rate with the confidence level.
 *   - The level chips and the n slider change the width of every interval.
 *     The axis never rescales, so a wider or narrower interval is *seen* to
 *     be so, and the tally is cleared because hits counted at one setting say
 *     nothing about another.
 *
 * The true μ is something no real study knows. Each preset sets one close to
 * the example's x̄ (and says so) purely so the simulation can score hits.
 *
 * Default tier: hand-rolled SVG. The only animation is a single run's new
 * interval opening out from its x̄, via `useReplayTween`.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { Slider, VIZ_TEXT, VizHint } from "../shared";
import { sampleNormal } from "../sampling";
import { useReplayTween } from "../useReplayTween";
import { CI_PRESETS, type CiPreset } from "../data/inferenceData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
/** Mean marker colour, shared with every other viz that marks a mean. */
const MEAN_C = "rgb(220, 38, 38)"; // red-600
/** An interval that misses μ. Red reads as "wrong" without a legend. */
const MISS_C = "rgb(220, 38, 38)"; // red-600

/**
 * The z multipliers from the textbook's box, rounded to two decimals as the
 * worked examples use them. Excel's =NORM.S.INV gives the unrounded values;
 * the unit's text explains the difference.
 */
const Z_FOR_LEVEL: Record<number, number> = { 90: 1.64, 95: 1.96, 98: 2.33, 99: 2.58 };
const LEVELS = [90, 95, 98, 99];

// SVG geometry (viewBox units).
const W = 440;
const PLOT_X0 = 24;
const PLOT_X1 = 424;
/** Top of the stack of intervals; the μ label sits just above it. */
const STACK_Y0 = 30;
/** Vertical room per interval. 40 rows at 7 units fill the chart. */
const ROW_H = 7;
/** Intervals kept on screen. Older ones drop off the bottom but stay in the tally. */
const ROWS = 40;
const AXIS_Y = STACK_Y0 + ROWS * ROW_H + 8;
const H = AXIS_Y + 44;

/** Sample sizes offered. 147 (the second half of Example 2B) must fit. */
const MIN_N = 10;
const MAX_N = 200;

/** One interval from one sample. */
interface Interval {
  xbar: number;
  lo: number;
  hi: number;
  /** Whether the interval contains the true μ. */
  hit: boolean;
}

/** Number of decimal places in a step such as 0.5 or 10. */
function decimalsOf(step: number): number {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

/**
 * Run the confidence-interval method on sample after sample and count how
 * often its interval catches the true μ.
 *
 * @param params.preset — id of the worked example to open with, from
 *   `CI_PRESETS`; defaults to the travel times of Example 1A. The starting n
 *   comes from the preset: MDX only forwards quoted string attributes, so a
 *   numeric param could never reach here.
 */
export default function ConfidenceIntervals({ params }: { params: VizParams }) {
  const initial = CI_PRESETS.find((p) => p.id === params.preset) ?? CI_PRESETS[0];

  const [preset, setPreset] = useState<CiPreset>(initial);
  const [n, setN] = useState(initial.startN);
  const [level, setLevel] = useState(95);
  /** The most recent intervals, newest first, capped at `ROWS`. */
  const [shown, setShown] = useState<Interval[]>([]);
  /** Every interval since the last reset: how many there were and how many caught μ. */
  const [tally, setTally] = useState({ total: 0, hits: 0 });
  /** Counts single runs, so each one replays the opening-out animation. */
  const [runId, setRunId] = useState(0);
  const [lastWasSingle, setLastWasSingle] = useState(false);
  const open = useReplayTween([runId], 380);

  const { sigma, trueMu } = preset;
  const z = Z_FOR_LEVEL[level];
  const halfWidth = (z * sigma) / Math.sqrt(n);
  const [viewLo, viewHi] = preset.view;
  const xOf = (v: number) =>
    PLOT_X0 + ((v - viewLo) / (viewHi - viewLo)) * (PLOT_X1 - PLOT_X0);
  const clampX = (v: number) => Math.min(PLOT_X1, Math.max(PLOT_X0, xOf(v)));

  // Before any run the example's own interval is the one on show, so the
  // read-out's working matches the text from the moment the panel opens.
  const exampleInterval: Interval = {
    xbar: preset.exampleMean,
    lo: preset.exampleMean - halfWidth,
    hi: preset.exampleMean + halfWidth,
    hit: Math.abs(preset.exampleMean - trueMu) <= halfWidth,
  };
  const latest = shown[0] ?? exampleInterval;
  const isExample = shown.length === 0;

  /** Forget every interval so far. Called whenever the question on screen changes. */
  function clearTally() {
    setShown([]);
    setTally({ total: 0, hits: 0 });
    setLastWasSingle(false);
  }

  /** Take `times` samples of size n, build each one's interval and score it. */
  function run(times: number) {
    const fresh: Interval[] = [];
    let hits = 0;
    for (let t = 0; t < times; t++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += sampleNormal(trueMu, sigma);
      const xbar = sum / n;
      const hit = Math.abs(xbar - trueMu) <= halfWidth;
      if (hit) hits += 1;
      fresh.push({ xbar, lo: xbar - halfWidth, hi: xbar + halfWidth, hit });
    }
    // Newest first, so the latest interval is always the top row.
    setShown((old) => [...fresh.reverse(), ...old].slice(0, ROWS));
    setTally((old) => ({ total: old.total + times, hits: old.hits + hits }));
    setLastWasSingle(times === 1);
    if (times === 1) setRunId((k) => k + 1);
  }

  function loadPreset(p: CiPreset) {
    setPreset(p);
    setN(p.startN);
    // Every worked example is introduced at 95%, so a new one opens there.
    setLevel(95);
    clearTally();
  }

  const ticks: number[] = [];
  for (
    let t = Math.ceil(viewLo / preset.tickStep) * preset.tickStep;
    t <= viewHi + 1e-9;
    t += preset.tickStep
  ) {
    ticks.push(t);
  }
  const tickDp = decimalsOf(preset.tickStep);

  const pct = tally.total > 0 ? (100 * tally.hits) / tally.total : 0;
  const misses = tally.total - tally.hits;

  /** One plain sentence on what the picture currently means. */
  const interpretation =
    tally.total === 0
      ? `This one interval either contains μ or it does not. The ${level}% describes the method: use it on sample after sample and about ${level} intervals in 100 catch μ.`
      : tally.total < 100
        ? `Each red interval came from a sample whose x̄ landed too far from μ. Press Repeat 500 times to see the long-run hit rate.`
        : `The method caught μ ${pct.toFixed(1)}% of the time, close to the ${level}% it promises. A higher level gives wider intervals and fewer misses; a bigger n gives narrower ones at the same hit rate.`;

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
      {/* Worked-example selector */}
      <div className="flex flex-wrap gap-1.5">
        {CI_PRESETS.map((p) => (
          <button key={p.id} onClick={() => loadPreset(p)} className={chip(preset.id === p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <VizHint>
        Press <strong className="font-semibold">Repeat 500 times</strong> and count how many
        intervals miss the true μ.
      </VizHint>

      {/* Confidence level, sample size and the run buttons */}
      <div className="rounded-lg border border-[color:var(--color-line)] px-3 py-2 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-[color:var(--color-ink-700)] mr-1">Confidence</span>
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLevel(l);
                clearTally();
              }}
              className={chip(level === l)}
            >
              {l}%
            </button>
          ))}
        </div>
        <Slider
          label="n, the sample size"
          mono={false}
          value={n}
          min={MIN_N}
          max={MAX_N}
          step={1}
          format={(v) => String(v)}
          onChange={(v) => {
            setN(v);
            clearTally();
          }}
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
            {isExample
              ? `The worked example's ${level}% confidence interval, from ${latest.lo.toFixed(2)} to ${latest.hi.toFixed(2)}, against the true mean ${trueMu}.`
              : `The latest ${shown.length} of ${tally.total} ${level}% confidence intervals, each from a sample of ${n}. ${tally.hits} caught the true mean ${trueMu}.`}
          </title>

          {/* True mean μ: red, dashed, through the whole stack */}
          <line
            x1={xOf(trueMu)}
            y1={STACK_Y0 - 12}
            x2={xOf(trueMu)}
            y2={AXIS_Y}
            stroke={MEAN_C}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={xOf(trueMu) + 4}
            y={STACK_Y0 - 8}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={MEAN_C}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            true &#956; = {trueMu}
          </text>

          {(isExample ? [exampleInterval] : shown).map((iv, row) => {
            const y = STACK_Y0 + row * ROW_H + ROW_H / 2;
            const newest = row === 0;
            const colour = iv.hit ? (newest ? ACCENT_DARK : ACCENT) : MISS_C;
            // The newest single-run interval opens out from its x̄; batches
            // and the example appear at full width straight away.
            const grow = newest && lastWasSingle ? open : 1;
            const lo = iv.xbar - (iv.xbar - iv.lo) * grow;
            const hi = iv.xbar + (iv.hi - iv.xbar) * grow;
            const x0 = clampX(lo);
            const x1 = clampX(hi);
            return (
              <g key={row} opacity={newest ? 1 : 0.75}>
                <line
                  x1={x0}
                  y1={y}
                  x2={x1}
                  y2={y}
                  stroke={colour}
                  strokeWidth={newest ? 3 : 2}
                  strokeLinecap="round"
                />
                {/* An interval running off the chart gets an arrowhead at
                    the edge, so it is not mistaken for one that stops there. */}
                {lo < viewLo && (
                  <path d={`M ${PLOT_X0} ${y} l 4 -2.5 l 0 5 Z`} fill={colour} />
                )}
                {hi > viewHi && (
                  <path d={`M ${PLOT_X1} ${y} l -4 -2.5 l 0 5 Z`} fill={colour} />
                )}
                {iv.xbar >= viewLo && iv.xbar <= viewHi && (
                  <circle cx={xOf(iv.xbar)} cy={y} r={newest ? 2.6 : 1.8} fill="white" stroke={colour} strokeWidth="1.2" />
                )}
              </g>
            );
          })}

          {isExample && (
            <text
              x={xOf(latest.xbar)}
              y={STACK_Y0 + ROW_H + 14}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-500)"
              stroke="white"
              strokeWidth="3"
              paintOrder="stroke"
            >
              the example&apos;s interval, centred on x̄ = {latest.xbar}
            </text>
          )}

          <line x1={PLOT_X0} y1={AXIS_Y} x2={PLOT_X1} y2={AXIS_Y} stroke="var(--color-ink-900)" />
          {ticks.map((t) => (
            <text
              key={t}
              x={xOf(t)}
              y={AXIS_Y + 13}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-500)"
              className="tabular-nums"
            >
              {t.toFixed(tickDp)}
            </text>
          ))}
          <text
            x={(PLOT_X0 + PLOT_X1) / 2}
            y={AXIS_Y + 34}
            textAnchor="middle"
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
          >
            {preset.axisLabel}
          </text>
        </svg>
      </div>

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            {isExample ? preset.source : `Latest sample, true mean ${trueMu}`}
          </p>
          <VizGuide
            steps={[
              "Pick a worked example along the top. The blue bar is its confidence interval, x̄ ± z × σ/√n, and the red dashed line is the true mean μ.",
              "In real life nobody knows μ. Here it is fixed so the simulation can check each interval.",
              "Press the first run button to take a fresh sample of n and draw its interval on top of the stack. Blue intervals contain μ; red ones miss it.",
              "Press Repeat 500 times and read the hit rate below the chart: it settles close to the confidence level.",
              "Change the confidence level or n and run again. A higher level widens every interval; a bigger n narrows them. Both clear the count, because each setting is a new question.",
            ]}
          />
        </div>
        {/* The working, then the answer: substituting into x̄ ± z·σ/√n is
            the calculation this unit teaches. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          x̄ ± z × σ/√n = {latest.xbar.toFixed(2)} ± {z.toFixed(2)} × {sigma}/√{n} ={" "}
          <span className="font-semibold" style={{ color: latest.hit ? ACCENT_DARK : MISS_C }}>
            ({latest.lo.toFixed(2)}, {latest.hi.toFixed(2)})
          </span>
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
          Width {(2 * halfWidth).toFixed(2)}
          {tally.total > 0 && (
            <>
              {" "}&nbsp;·&nbsp; {tally.hits.toLocaleString()} of {tally.total.toLocaleString()}{" "}
              caught μ ({pct.toFixed(1)}%), {misses.toLocaleString()} missed
            </>
          )}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{interpretation}</p>
      </div>
    </div>
  );
}
