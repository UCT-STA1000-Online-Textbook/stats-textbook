/**
 * Bar-graph explorer for the Binomial distribution, used by Module 4, WU2
 * (`m4-binomial`).
 *
 * The chapter shows three static bar graphs of B(15, p) for p = 0.5, 0.3 and
 * 0.8 and asks the reader to "gain some feeling for the shape". Sliders do
 * that far better than three printed pictures: with n and p under the
 * student's hand the shape stops being three special cases and becomes
 * something they can steer. In particular p = 0.5 is visibly the only
 * symmetric case, and raising n visibly pulls the shape toward a bell.
 *
 * Selecting a run of bars gives Pr[a ≤ X ≤ b], which is how every worked
 * example in the unit is actually answered: "two or more sales", "at least 2
 * chipped pills", "one or more defectives".
 *
 * It also runs the experiment for real. "Run" performs n actual Bernoulli
 * trials, lights up which of them succeeded, and adds the result to a tally
 * drawn over the theoretical bars. Run it enough times and the tally settles
 * onto the theory, which is the law of large numbers doing its work on the
 * distribution the student has just been reading about. The mouse-maze preset
 * can also load the lecturer's 1500 recorded Tutorial 6 experiments straight
 * into that tally, so the class data and the live runs are the same object.
 *
 * The tally is cleared whenever n or p changes, since counts gathered under
 * one pair of parameters say nothing about another.
 *
 * Probabilities come from a recurrence rather than from factorials, so no
 * intermediate value ever overflows and the bars stay exact at the top of the
 * n range.
 *
 * Default tier: hand-rolled SVG with range inputs. Bar heights grow in via
 * the shared `useReplayTween` on mount and whenever a preset is loaded, the
 * same entrance the Module 2 charts use. Dragging a slider deliberately does
 * not replay it: the bars would restart from zero on every tick of the drag.
 */

"use client";

import { useMemo, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { useReplayTween } from "../useReplayTween";
import { sampleBinomialTrials } from "../sampling";
import { Slider, VIZ_TEXT, VizHint } from "../shared";
import { BINOMIAL_PRESETS } from "../data/distributionData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
/** Mean marker colour, shared with every other viz that marks a mean. */
const MEAN_C = "rgb(220, 38, 38)"; // red-600

// SVG geometry (viewBox units).
const W = 440;
const H = 380;
const PLOT_X0 = 44;
const PLOT_X1 = 430;
const PLOT_Y0 = 16;
const AXIS_Y = 334;

/** Largest number of trials the slider allows. Beyond ~20 the bars get too thin to click. */
const MAX_N = 20;

/**
 * Probability mass function of B(n, p) for every x from 0 to n.
 *
 * Built with the recurrence p(x) = p(x−1) · (n−x+1)/x · p/(1−p) starting from
 * p(0) = (1−p)^n. Computing C(n, x) directly would overflow for larger n, and
 * this also costs one multiply per bar instead of a factorial each.
 */
function binomialPmf(n: number, p: number): number[] {
  const q = 1 - p;
  const out = new Array<number>(n + 1);
  out[0] = Math.pow(q, n);
  for (let x = 1; x <= n; x++) {
    out[x] = (out[x - 1] * ((n - x + 1) / x) * p) / q;
  }
  return out;
}

/**
 * Interactive Binomial bar graph: set n and p, then select a run of bars to
 * read off a probability.
 *
 * @param params.preset — id of the example to open at, from
 *   `BINOMIAL_PRESETS`; defaults to the mouse-in-the-maze simulation.
 */
export default function BinomialExplorer({ params }: { params: VizParams }) {
  const initial =
    BINOMIAL_PRESETS.find((b) => b.id === params.preset) ?? BINOMIAL_PRESETS[0];

  const [presetId, setPresetId] = useState(initial.id);
  const [n, setN] = useState(initial.n);
  const [p, setP] = useState(initial.p);
  // Inclusive range of selected bars. Both ends are clamped against n on
  // every render rather than in the setters, because lowering n with the
  // slider can strand either end past the last bar. Clamping only the upper
  // end is not enough: the two are swapped below, so a stranded lower end
  // becomes the upper one and the read-out would claim a range like
  // "1 ≤ X ≤ 20" on a chart with 5 trials.
  const [lo, setLo] = useState(initial.select[0]);
  const [rawHi, setRawHi] = useState(initial.select[1]);
  /**
   * Bumped whenever a preset is loaded, purely to restart the entrance tween.
   * The tween keys off this rather than off n and p directly, so dragging a
   * slider does not send the bars back to zero on every step.
   */
  const [replayKey, setReplayKey] = useState(0);
  const progress = useReplayTween([replayKey]);

  /** Counts of how many runs produced each number of successes, indexed by x. */
  const [tally, setTally] = useState<number[]>(() => new Array(initial.n + 1).fill(0));
  /** Outcomes of the most recent single run, shown as a row of markers. */
  const [lastRun, setLastRun] = useState<boolean[] | null>(null);

  const preset = BINOMIAL_PRESETS.find((b) => b.id === presetId);
  const hi = Math.min(rawHi, n);
  const loClamped = Math.min(lo, n);
  const selLo = Math.min(loClamped, hi);
  const selHi = Math.max(loClamped, hi);

  const pmf = useMemo(() => binomialPmf(n, p), [n, p]);

  /** Total probability of the selected bars. */
  const selected = pmf.slice(selLo, selHi + 1).reduce((s, v) => s + v, 0);
  const mean = n * p;
  const variance = n * p * (1 - p);

  /**
   * The selected probability written out as a sum, the way `PmfBarExplorer`
   * presents its result: seeing the terms is most of the teaching.
   *
   * A long run of bars is given as the complement instead of a dozen terms,
   * which is both shorter and the technique the unit actually teaches for
   * "at least two" style questions.
   */
  const working = (() => {
    const terms = selHi - selLo + 1;
    if (terms === 1) return null;
    if (terms <= 4) {
      return pmf
        .slice(selLo, selHi + 1)
        .map((v) => v.toFixed(4))
        .join(" + ");
    }
    const outside = [...pmf.slice(0, selLo), ...pmf.slice(selHi + 1)];
    if (outside.length > 0 && outside.length <= 4) {
      return `1 − ${outside.map((v) => v.toFixed(4)).join(" − ")}`;
    }
    return null;
  })();

  const runs = tally.reduce((a, b) => a + b, 0);

  /** Observed proportions from the runs done so far, or null before any run. */
  const observed = useMemo(
    () => (runs > 0 ? tally.map((c) => c / runs) : null),
    [tally, runs],
  );

  /** Mean number of successes actually observed, for comparison with np. */
  const observedMean =
    runs > 0 ? tally.reduce((sum, c, x) => sum + c * x, 0) / runs : 0;

  const pmfMax = Math.max(...pmf);
  /**
   * Top of the y-axis.
   *
   * Observed results may exceed the theory, so the axis grows to fit them,
   * but only up to twice the tallest theoretical value. Without that ceiling
   * the very first run (which puts 100% of its results on one value) would
   * rescale the axis to 1.0 and flatten every bar into the floor, so a
   * student's first click would appear to break the chart.
   */
  const pMax = Math.min(Math.max(pmfMax, ...(observed ?? [])), pmfMax * 2);
  /** Round the axis top up so the tallest bar is not flush with the frame. */
  const yTop = pMax * 1.12;
  /** True while some observed ring sits above the axis and cannot be drawn. */
  const ringsOffScale = (observed ?? []).some((v) => v > pMax);

  const slot = (PLOT_X1 - PLOT_X0) / (n + 1);
  const barW = Math.min(slot * 0.68, 34);
  const cx = (x: number) => PLOT_X0 + slot * (x + 0.5);
  const yOf = (v: number) => AXIS_Y - (v / yTop) * (AXIS_Y - PLOT_Y0);

  /**
   * Label every bar when they are few, otherwise every other one. Below about
   * 22 units of slot width the numbers collide and the axis turns to mush.
   */
  const tickEvery = slot < 22 ? 2 : 1;
  /** Bar-top values need roughly 30 units of slot to avoid running together. */
  const showBarValues = slot >= 30;

  /** Load a preset, taking its parameters and its selected range together. */
  function loadPreset(id: string) {
    const b = BINOMIAL_PRESETS.find((q) => q.id === id);
    if (!b) return;
    setPresetId(id);
    setN(b.n);
    setP(b.p);
    setLo(b.select[0]);
    setRawHi(b.select[1]);
    setReplayKey((k) => k + 1);
    clearRuns(b.n);
  }

  /** Empty the tally, sized for `size` trials per run. */
  function clearRuns(size: number) {
    setTally(new Array(size + 1).fill(0));
    setLastRun(null);
  }

  /**
   * Run the experiment `times` times and add the results to the tally.
   *
   * A single run keeps its individual trial outcomes so the markers can show
   * which ones succeeded; a batch does not, since only the last run is shown
   * and rendering thousands of markers would be pointless.
   */
  function run(times: number) {
    const next = [...tally];
    let last: boolean[] = [];
    for (let i = 0; i < times; i++) {
      last = sampleBinomialTrials(n, p);
      next[last.filter(Boolean).length] += 1;
    }
    setTally(next);
    setLastRun(last);
  }

  /** Seed the tally with the lecturer's recorded experiments for this preset. */
  function loadRecorded() {
    if (!preset?.observed) return;
    setTally(preset.observed.map((c, i) => c + (tally[i] ?? 0)));
    setLastRun(null);
  }

  /**
   * Clicking a bar moves the nearer end of the selection to it, so a range can
   * be built up with two clicks and adjusted with one.
   *
   * This deliberately keeps the preset loaded. Selecting a different range is
   * not a change of parameters, so the worked example it came from is still
   * the right label, and the simulation overlay is still comparing like with
   * like.
   */
  function pickBar(x: number) {
    if (Math.abs(x - selLo) <= Math.abs(x - selHi)) setLo(x);
    else setRawHi(x);
  }

  /**
   * Changing a parameter by hand means the chart no longer matches any preset,
   * and the runs gathered so far came from a different distribution, so they
   * are discarded rather than left to mislead.
   */
  function setParam(setter: (v: number) => void, value: number, nextN: number) {
    setPresetId("");
    setter(value);
    clearRuns(nextN);
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      {/* Preset selector */}
      <div className="flex flex-wrap gap-1.5">
        {BINOMIAL_PRESETS.map((b) => (
          <button
            key={b.id}
            onClick={() => loadPreset(b.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              presetId === b.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <VizHint>
        {preset
          ? `Press Run to perform ${n} trials for real: one ${preset.trial}, a success if it ${preset.success}. Each run adds a ring above the bars.`
          : `Press Run to perform ${n} trials for real. Each run adds a ring above the bars.`}
      </VizHint>

      {/* Run the experiment for real */}
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
              {times === 1 ? `Run ${n} trials` : "Run 500"}
            </button>
          ))}
          {preset?.observed && (
            <button
              onClick={loadRecorded}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-700)] transition-colors hover:border-blue-400"
            >
              Add the 1500 recorded
            </button>
          )}
          <button
            onClick={() => clearRuns(n)}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-500)] transition-colors hover:border-blue-400"
          >
            Reset
          </button>
        </div>

        {/* The individual trials of the most recent run. For the maze preset
            these are the 8 mice, filled if they found their way out. */}
        {lastRun && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {lastRun.map((ok, i) => (
              <span
                key={i}
                title={ok ? "success" : "failure"}
                className={`grid place-items-center w-5 h-5 rounded-full text-[10px] font-bold ${
                  ok
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-[color:var(--color-ink-500)]"
                }`}
              >
                {ok ? "✓" : "·"}
              </span>
            ))}
            <span className="ml-1 text-[11px] text-[color:var(--color-ink-500)]">
              {lastRun.filter(Boolean).length} of {n} succeeded on the last run
            </span>
          </div>
        )}
      </div>

      {/* Bar graph */}
      {/* shrink-0 so the chart is exactly as tall as it wants to be. Letting
          it flex meant its height was pinned by its width and it floated in a
          taller box, wasting a third of the panel. Overflow scrolls instead,
          which the root allows. */}
      <div className="shrink-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[520px] select-none">
          <title>
            Bar graph of the Binomial distribution with n = {n} and p = {p.toFixed(2)}, with
            bars {selLo} to {selHi} selected, totalling {selected.toFixed(4)}
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
                  {v.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* y-axis caption */}
          <text
            x={11}
            y={(PLOT_Y0 + AXIS_Y) / 2}
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
            textAnchor="middle"
            transform={`rotate(-90 11 ${(PLOT_Y0 + AXIS_Y) / 2})`}
          >
            p(x)
          </text>

          {/* One bar per value of x, selected ones filled solid */}
          {pmf.map((prob, x) => {
            const inRange = x >= selLo && x <= selHi;
            return (
              <g
                key={x}
                className="cursor-pointer"
                onClick={() => pickBar(x)}
                style={{ touchAction: "none" }}
              >
                {/* Invisible full-height hit area: a short bar is a tiny target. */}
                <rect
                  x={cx(x) - slot / 2}
                  y={PLOT_Y0}
                  width={slot}
                  height={AXIS_Y - PLOT_Y0}
                  fill="transparent"
                />
                <rect
                  x={cx(x) - barW / 2}
                  y={AXIS_Y - (AXIS_Y - yOf(prob)) * progress}
                  width={barW}
                  height={(AXIS_Y - yOf(prob)) * progress}
                  rx="2"
                  fill={ACCENT}
                  fillOpacity={inRange ? 0.85 : 0.22}
                />
                {x % tickEvery === 0 && (
                  <text
                    x={cx(x)}
                    y={AXIS_Y + 14}
                    textAnchor="middle"
                    fontSize={VIZ_TEXT.axisTick}
                    fill={inRange ? ACCENT_DARK : "var(--color-ink-500)"}
                    className="tabular-nums"
                  >
                    {x}
                  </text>
                )}
                {/* The value on top of each bar, as the Module 3 bar explorer
                    does it. Dropped once the bars are too narrow to carry a
                    four-character number without colliding. */}
                {showBarValues && prob >= 0.001 && (
                  <text
                    x={cx(x)}
                    y={yOf(prob) * progress + AXIS_Y * (1 - progress) - 5}
                    textAnchor="middle"
                    fontSize={VIZ_TEXT.axisTick}
                    fontWeight="600"
                    fill={inRange ? ACCENT_DARK : "var(--color-ink-500)"}
                    className="tabular-nums"
                  >
                    {prob.toFixed(3)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Simulation overlay: one hollow marker per observed proportion */}
          {observed?.map((prop, x) =>
            x <= n ? (
              <circle
                key={`obs-${x}`}
                cx={cx(x)}
                cy={AXIS_Y - (AXIS_Y - yOf(prop)) * progress}
                r={3.5}
                fill="white"
                stroke={ACCENT_DARK}
                strokeWidth="1.6"
              />
            ) : null,
          )}

          {/* Axis */}
          <line
            x1={PLOT_X0}
            y1={AXIS_Y}
            x2={PLOT_X1}
            y2={AXIS_Y}
            stroke="var(--color-ink-900)"
            strokeWidth="1"
          />
          <text
            x={(PLOT_X0 + PLOT_X1) / 2}
            y={AXIS_Y + 32}
            textAnchor="middle"
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
          >
            x = number of successes in {n} trials
          </text>

          {/* Mean marker at np, which need not land on a bar. Red, dashed and
              labelled, matching how every other viz in the book marks a mean.
              The label is stroked white underneath so it stays readable where
              it crosses a tall bar. */}
          <g>
            <line
              x1={cx(mean)}
              y1={PLOT_Y0 + 4}
              x2={cx(mean)}
              y2={AXIS_Y}
              stroke={MEAN_C}
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text
              x={cx(mean)}
              y={PLOT_Y0 - 2}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fontWeight="600"
              fill={MEAN_C}
              stroke="white"
              strokeWidth="3"
              paintOrder="stroke"
            >
              &#956; = {mean.toFixed(2)}
            </text>
          </g>
        </svg>
      </div>

      {/* Parameter sliders */}
      <div className="grid grid-cols-2 gap-3">
        <Slider
          label="n (trials)"
          value={n}
          onChange={(v) => setParam(setN, v, v)}
          min={1}
          max={MAX_N}
          step={1}
          format={(v) => v.toFixed(0)}
        />
        <Slider
          label="p (success)"
          value={p}
          onChange={(v) => setParam(setP, v, n)}
          min={0.05}
          max={0.95}
          step={0.01}
        />
      </div>

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            {preset ? preset.source : "Your own parameters"}
          </p>
          <VizGuide
            steps={[
              "Pick an example along the top, or set n and p yourself with the sliders.",
              "Press Run to perform the trials for real. The markers show which ones succeeded.",
              "Run it again and again: the rings are your results, and they drift onto the bars.",
              "Click a bar to move the nearer end of the selection to it; click a second bar for a range.",
              "The selected bars add up to Pr[a ≤ X ≤ b], shown below.",
              "Slide p to 0.5 and back: that is the only value where the shape is symmetric.",
            ]}
          />
        </div>
        {/* The answer to the question the unit just asked, given room to be
            read at a glance. Everything else is supporting detail. */}
        <p className="mt-1 text-[15px] leading-snug text-[color:var(--color-ink-900)]">
          Pr[{selLo === selHi ? `X = ${selLo}` : `${selLo} ≤ X ≤ ${selHi}`}] ={" "}
          {working && <span className="tabular-nums">{working} = </span>}
          <span className="font-semibold tabular-nums">{selected.toFixed(4)}</span>
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
          X ~ B({n}, {p.toFixed(2)}) &nbsp;·&nbsp;{" "}
          {/* Coloured to match the marker on the chart. */}
          <span style={{ color: MEAN_C }}>E[X] = np = {mean.toFixed(2)}</span>{" "}
          &nbsp;·&nbsp; Var[X] = {variance.toFixed(2)}
        </p>
        {/* An always-present line saying what the picture means, the way the
            Module 1 to 3 viz do. Without it the panel reports numbers but
            never interprets them. */}
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          {selLo === 0 && selHi === n
            ? "Every bar is selected, so they add to 1. That is Example 3B: the binomial probabilities always sum to one."
            : working?.startsWith("1 −")
              ? "Quicker as the complement: subtract the few outcomes you do not want from 1, rather than adding the many you do."
              : `Add the selected bars together. The ones left out hold the remaining ${(1 - selected).toFixed(4)}.`}
        </p>
        {runs > 0 && (
          <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
            {runs.toLocaleString()} run{runs === 1 ? "" : "s"} so far, averaging{" "}
            <span className="tabular-nums">{observedMean.toFixed(2)}</span> successes
            against {mean.toFixed(2)} predicted.
            {ringsOffScale ? " Some early results are above the top of the axis." : ""}
          </p>
        )}
      </div>
    </div>
  );
}
