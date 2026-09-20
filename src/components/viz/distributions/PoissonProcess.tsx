/**
 * Two-view explorer for a Poisson process, used by Module 4, WU3
 * (`m4-poisson-exponential`).
 *
 * The unit's central claim is that the Poisson and the Exponential
 * distributions are not two topics but two questions asked of one process:
 * "how many events fall in this stretch?" and "how far apart are they?". So
 * this is one component with one rate λ and two views, rather than two
 * separate visualisations that would quietly hide the connection.
 *
 *   - Counts view: the Poisson bar graph, with λ on a slider, and a run of
 *     bars selectable to read off Pr[a ≤ X ≤ b].
 *   - Gaps view: the Exponential density, with a draggable threshold t, and
 *     the tail area Pr[X > t] read off directly.
 *
 * The two views are tied together in the read-out. Example 13C asks the
 * student to show that the Poisson probability of no events in t equals the
 * Exponential probability of a gap longer than t; both are e^(−λt), and the
 * gaps view prints the two side by side so the equality is visible rather
 * than merely proved.
 *
 * It also runs the process for real. "Drive" walks along one unit of road,
 * placing the next event an Exponential gap further on until the unit runs
 * out. That single loop feeds both views at once: the number of events it
 * placed goes into the Poisson tally, and the gaps it stepped go into the
 * Exponential histogram. So the equivalence in Example 13C is not just
 * asserted, it is the mechanism generating both pictures. The strip of road
 * above the chart shows where the events of the latest drive actually fell.
 *
 * The pothole preset can also load the lecturer's 5000 recorded Tutorial 7
 * kilometres into the same tally. Both tallies are cleared when λ changes,
 * since counts gathered at one rate say nothing about another.
 *
 * Default tier: hand-rolled SVG, pointer drag via the shared `useSvgDrag`
 * hook. Nothing animates, so no loop runs.
 */

"use client";

import { useMemo, useRef, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { useSvgDrag, clampN } from "../useDrag";
import { Slider, VIZ_TEXT, VizHint } from "../shared";
import { sampleExponential } from "../sampling";
import { POISSON_PRESETS } from "../data/distributionData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
/** Mean marker colour, shared with every other viz that marks a mean. */
const MEAN_C = "rgb(220, 38, 38)"; // red-600

// SVG geometry (viewBox units).
const W = 440;
// Taller than the other distribution viz: the gaps view stacks an axis, the
// draggable t handle and a caption below the plot, and they need the room.
const H = 380;
const PLOT_X0 = 46;
const PLOT_X1 = 430;
const PLOT_Y0 = 16;
const AXIS_Y = 312;
/** Row below the axis holding the draggable threshold handle, gaps view only. */
const HANDLE_Y = 344;

/** Slider bounds for the rate. Below 0.2 the bar graph is a single spike; above 10 it runs off the axis. */
const MIN_LAMBDA = 0.2;
const MAX_LAMBDA = 10;
/** Hard cap on how many bars the counts view will draw. */
const MAX_BARS = 22;
/** Sample count for drawing the exponential curve. */
const SAMPLES = 180;
/** Number of bins the observed gaps are collected into, across [0, xMax]. */
const GAP_BINS = 18;
/** Geometry of the strip of road drawn above the chart. */
const ROAD_H = 26;

/**
 * Probability mass function of the Poisson distribution with rate λ, for
 * every x from 0 up to `upTo`.
 *
 * Built with the recurrence p(x) = p(x−1) · λ/x from p(0) = e^(−λ). Going via
 * x! directly would overflow for the larger counts and costs more per bar.
 */
function poissonPmf(lambda: number, upTo: number): number[] {
  const out = new Array<number>(upTo + 1);
  out[0] = Math.exp(-lambda);
  for (let x = 1; x <= upTo; x++) out[x] = (out[x - 1] * lambda) / x;
  return out;
}

/**
 * How many bars to draw for a given rate: far enough past the mean to carry
 * essentially all the probability (λ + 4 standard deviations), with a couple
 * of spare bars at small λ so the graph never looks clipped.
 */
function barCount(lambda: number): number {
  return Math.min(MAX_BARS, Math.ceil(lambda + 4 * Math.sqrt(lambda)) + 2);
}

/** Every whole number from `from` to `to`, inclusive. */
function rangeOf(from: number, to: number): number[] {
  const out: number[] = [];
  for (let x = from; x <= to; x++) out.push(x);
  return out;
}

/**
 * Interactive Poisson process: count the events, or measure the gaps between
 * them, at one shared rate.
 *
 * @param params.preset — id of the example to open at, from
 *   `POISSON_PRESETS`; defaults to the pothole simulation.
 * @param params.mode — "gaps" opens the Exponential view; anything else (or
 *   nothing) opens the Poisson counting view.
 */
export default function PoissonProcess({ params }: { params: VizParams }) {
  const initial =
    POISSON_PRESETS.find((q) => q.id === params.preset) ?? POISSON_PRESETS[0];

  const [presetId, setPresetId] = useState(initial.id);
  const [lambda, setLambda] = useState(initial.lambda);
  const [gaps, setGaps] = useState(params.mode === "gaps");
  /**
   * Which bars are currently chosen, as a set of x values.
   *
   * A set rather than a range because clicking a bar simply turns that bar
   * on or off. A range forced every click to move whichever end was nearer,
   * so clicking inside the range moved an end the student was not pointing
   * at. The presets still declare a range; it is expanded here.
   */
  const [chosen, setChosen] = useState<Set<number>>(
    () => new Set(rangeOf(initial.select[0], initial.select[1])),
  );

  const preset = POISSON_PRESETS.find((q) => q.id === presetId);
  /** Unit λ is quoted per, for the axis and read-out. Falls back when a slider has left every preset. */
  const unit = preset?.unit ?? "unit";
  const event = preset?.event ?? "events";
  /** How to name a length of that unit in the gaps view, e.g. "km of road". */
  const span = preset?.span ?? "units";

  /**
   * Width of the gaps view's x-axis, in units of the rate that was loaded.
   *
   * Pinned to the *preset's* rate rather than the live one: if it tracked the
   * slider, the exponential curve would look identical at every λ, because
   * stretching the axis by exactly 1/λ is the one change that hides λ
   * completely. Held fixed, moving the slider visibly steepens the curve.
   */
  const [xMax, setXMax] = useState(4 / initial.lambda);

  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = useSvgDrag(svgRef);
  const dragOrigin = useRef(0);
  /** Threshold in the gaps view: the gap length the tail probability is measured beyond. */
  const [t, setT] = useState(1 / initial.lambda);

  /** Counts of how many drives produced each number of events, indexed by x. */
  const [tally, setTally] = useState<number[]>(() => new Array(MAX_BARS + 1).fill(0));
  /** Observed gaps, collected into `GAP_BINS` bins across [0, xMax]. */
  const [gapBins, setGapBins] = useState<number[]>(() => new Array(GAP_BINS).fill(0));
  /** Every gap seen, including those past xMax, so the histogram scales correctly. */
  const [gapTotal, setGapTotal] = useState(0);
  /** Positions, within one unit, of the events placed on the latest drive. */
  const [lastDrive, setLastDrive] = useState<number[] | null>(null);

  // ---- Counting view -------------------------------------------------
  const nBars = barCount(lambda);
  const pmf = useMemo(() => poissonPmf(lambda, nBars), [lambda, nBars]);
  /**
   * The chosen bars that still exist, in order. Filtered against the current
   * bar count rather than pruned: lowering λ shortens the graph, and a
   * choice past the last bar must not be named in the read-out, but it comes
   * back if λ rises again.
   */
  const picked = useMemo(
    () => [...chosen].filter((x) => x <= nBars).sort((a, b) => a - b),
    [chosen, nBars],
  );
  const selected = picked.reduce((sum, x) => sum + pmf[x], 0);

  /** True when the chosen bars form one unbroken run, which reads better as a range. */
  const isRun =
    picked.length > 1 && picked[picked.length - 1] - picked[0] === picked.length - 1;

  /** How to name the chosen set in the read-out. */
  const pickedLabel =
    picked.length === 0
      ? null
      : picked.length === 1
        ? `X = ${picked[0]}`
        : isRun
          ? `${picked[0]} ≤ X ≤ ${picked[picked.length - 1]}`
          : `X ∈ {${picked.join(", ")}}`;

  /**
   * The selected probability written out as a sum, matching how the Module 3
   * bar explorer presents its result. A long run is given as the complement
   * instead, which is the technique the worked examples actually use.
   */
  const working = (() => {
    if (picked.length <= 1) return null;
    if (picked.length <= 4) {
      return picked.map((x) => pmf[x].toFixed(4)).join(" + ");
    }
    const left = rangeOf(0, nBars).filter((x) => !chosen.has(x) && pmf[x] >= 0.0001);
    if (left.length > 0 && left.length <= 4) {
      return `1 − ${left.map((x) => pmf[x].toFixed(4)).join(" − ")}`;
    }
    return null;
  })();

  const drives = tally.reduce((a, b) => a + b, 0);

  /** Observed proportions from the drives done so far, or null before any. */
  const observed = useMemo(
    () => (drives > 0 ? tally.map((c) => c / drives) : null),
    [tally, drives],
  );

  /** Mean number of events actually observed, for comparison with λ. */
  const observedMean =
    drives > 0 ? tally.reduce((sum, c, x) => sum + c * x, 0) / drives : 0;

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
  const yTopBars = pMax * 1.12;
  /** True while some observed ring sits above the axis and cannot be drawn. */
  const ringsOffScale = (observed ?? []).some((v) => v > pMax);
  const slot = (PLOT_X1 - PLOT_X0) / (nBars + 1);
  const barW = Math.min(slot * 0.68, 32);
  const cxBar = (x: number) => PLOT_X0 + slot * (x + 0.5);
  const yBar = (v: number) => AXIS_Y - (v / yTopBars) * (AXIS_Y - PLOT_Y0);
  const tickEvery = slot < 22 ? 2 : 1;
  /** Bar-top values need roughly 30 units of slot to avoid running together. */
  const showBarValues = slot >= 30;

  // ---- Gaps view -----------------------------------------------------
  /**
   * The observed gaps as a density, so they sit on the same scale as the
   * curve: a bin's height is its share of all gaps divided by the bin width.
   * Gaps longer than xMax are counted in `gapTotal` but have no bin, which is
   * correct — they are simply off the right of the picture.
   */
  const gapDensity = useMemo(() => {
    if (gapTotal === 0) return null;
    const binWidth = xMax / GAP_BINS;
    return gapBins.map((c) => c / (gapTotal * binWidth));
  }, [gapBins, gapTotal, xMax]);

  /**
   * Top of the gaps y-axis. The curve peaks at λ, where x = 0, but an
   * observed bin can overshoot that on a small sample, so the taller of the
   * two sets the scale, capped at twice λ for the same reason the bar chart
   * caps its own axis: one early drive must not flatten the curve.
   */
  const yTopCurve =
    Math.min(Math.max(lambda, ...(gapDensity ?? [0])), lambda * 2) * 1.12;
  const xOf = (v: number) => PLOT_X0 + (v / xMax) * (PLOT_X1 - PLOT_X0);
  const yCurve = (v: number) => AXIS_Y - (v / yTopCurve) * (AXIS_Y - PLOT_Y0);
  const toData = (dx: number) => (dx / (PLOT_X1 - PLOT_X0)) * xMax;
  /** Pr[X > t] for the Exponential, which is also Pr[no events in t] for the Poisson. */
  const tailProb = Math.exp(-lambda * t);

  const curvePath = useMemo(() => {
    const seg: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = (xMax * i) / SAMPLES;
      seg.push(`${i ? "L" : "M"} ${xOf(x)} ${yCurve(lambda * Math.exp(-lambda * x))}`);
    }
    return seg.join(" ");
    // `xOf`/`yCurve` are pure functions of xMax and yTopCurve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lambda, xMax, yTopCurve]);

  /** The tail beyond t, filled to show Pr[X > t] as an area. */
  const tailPath = useMemo(() => {
    if (t >= xMax) return "";
    const seg: string[] = [`M ${xOf(t)} ${AXIS_Y}`];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = t + ((xMax - t) * i) / SAMPLES;
      seg.push(`L ${xOf(x)} ${yCurve(lambda * Math.exp(-lambda * x))}`);
    }
    seg.push(`L ${xOf(xMax)} ${AXIS_Y}`, "Z");
    return seg.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lambda, t, xMax, yTopCurve]);

  /** Empty both tallies and the road. */
  function clearRuns() {
    setTally(new Array(MAX_BARS + 1).fill(0));
    setGapBins(new Array(GAP_BINS).fill(0));
    setGapTotal(0);
    setLastDrive(null);
  }

  /**
   * Drive `times` units of road, and record what happens.
   *
   * One drive walks from 0 to 1, stepping an Exponential gap at a time and
   * dropping an event wherever it lands. That one loop generates both
   * distributions at once: the number of events placed is a Poisson draw, and
   * the steps taken are Exponential draws. The final part-gap, from the last
   * event to the end of the unit, is not recorded: it was cut short by the
   * edge rather than ended by an event, so counting it would drag the
   * observed gaps below the truth.
   */
  function drive(times: number) {
    const nextTally = [...tally];
    const nextBins = [...gapBins];
    let nextTotal = gapTotal;
    let last: number[] = [];
    const binWidth = xMax / GAP_BINS;

    for (let i = 0; i < times; i++) {
      const positions: number[] = [];
      let at = 0;
      for (;;) {
        const gap = sampleExponential(lambda);
        at += gap;
        if (at >= 1) break;
        positions.push(at);
        nextTotal += 1;
        const bin = Math.floor(gap / binWidth);
        if (bin < GAP_BINS) nextBins[bin] += 1;
      }
      nextTally[Math.min(positions.length, MAX_BARS)] += 1;
      last = positions;
    }

    setTally(nextTally);
    setGapBins(nextBins);
    setGapTotal(nextTotal);
    setLastDrive(last);
  }

  /** Seed the count tally with the lecturer's recorded kilometres. */
  function loadRecorded() {
    if (!preset?.observed) return;
    setTally(tally.map((c, i) => c + (preset.observed?.[i] ?? 0)));
    setLastDrive(null);
  }

  /** Load a preset, resetting the rate, the selection, and the gaps-view scale. */
  function loadPreset(id: string) {
    const q = POISSON_PRESETS.find((z) => z.id === id);
    if (!q) return;
    setPresetId(id);
    setLambda(q.lambda);
    setChosen(new Set(rangeOf(q.select[0], q.select[1])));
    setXMax(4 / q.lambda);
    setT(1 / q.lambda);
    clearRuns();
  }

  /** Moving the rate by hand means the chart no longer matches any preset. */
  function changeLambda(v: number) {
    setPresetId("");
    setLambda(v);
    setT((prev) => Math.min(prev, xMax));
    // Runs gathered at the old rate describe a different process.
    clearRuns();
  }

  /** Clicking a bar turns that bar on or off, and nothing else moves. */
  function toggleBar(x: number) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(x)) next.delete(x);
      else next.add(x);
      return next;
    });
  }

  function dragThreshold(e: React.PointerEvent) {
    dragOrigin.current = t;
    startDrag(e, (dx) => setT(clampN(dragOrigin.current + toData(dx), 0, xMax)));
  }

  const fmtX = (v: number) => (xMax >= 20 ? v.toFixed(0) : v.toFixed(2));

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      {/* Preset selector */}
      <div className="flex flex-wrap gap-1.5">
        {POISSON_PRESETS.map((q) => (
          <button
            key={q.id}
            onClick={() => loadPreset(q.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              presetId === q.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* View switch: the same process, asked two different questions */}
      <div className="flex rounded-lg border border-[color:var(--color-line)] overflow-hidden text-[11px] font-medium">
        {([
          [false, "Count the events (Poisson)"],
          [true, "Measure the gaps (Exponential)"],
        ] as const).map(([isGaps, text]) => (
          <button
            key={text}
            onClick={() => setGaps(isGaps)}
            className={`flex-1 px-2 py-1.5 transition-colors ${
              gaps === isGaps
                ? "bg-blue-600 text-white"
                : "bg-white text-[color:var(--color-ink-700)] hover:bg-blue-50"
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <VizHint>
        {gaps
          ? `Press Run to cover 1 ${unit} for real, then drag t. The shaded tail is the chance of waiting longer than t for the next one.`
          : `Press Run to cover 1 ${unit} for real. Each one adds a ring above the bar for that many ${event}.`}
      </VizHint>

      {/* Run the process for real */}
      <div className="rounded-lg border border-[color:var(--color-line)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mr-0.5">
            Run it
          </span>
          {[1, 500].map((times) => (
            <button
              key={times}
              onClick={() => drive(times)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700"
            >
              {times === 1 ? `Cover 1 ${unit}` : "Cover 500"}
            </button>
          ))}
          {preset?.observed && (
            <button
              onClick={loadRecorded}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-700)] transition-colors hover:border-blue-400"
            >
              Add the 5000 recorded
            </button>
          )}
          <button
            onClick={clearRuns}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-500)] transition-colors hover:border-blue-400"
          >
            Reset
          </button>
        </div>

        {/* The latest unit of road, with the events where they actually fell.
            This is the same draw that fed both tallies, so the dots here are
            the counts in one view and the gaps in the other. */}
        {lastDrive && (
          <div className="mt-2">
            <svg
              viewBox={`0 0 ${W} ${ROAD_H}`}
              className="w-full h-auto select-none"
              aria-label={`One ${unit} of road holding ${lastDrive.length} ${event}`}
            >
              <rect
                x={0}
                y={4}
                width={W}
                height={ROAD_H - 8}
                rx="4"
                fill="var(--color-line)"
                fillOpacity={0.45}
              />
              <line
                x1={6}
                y1={ROAD_H / 2}
                x2={W - 6}
                y2={ROAD_H / 2}
                stroke="white"
                strokeWidth="1.5"
                strokeDasharray="10 8"
              />
              {lastDrive.map((pos, i) => (
                <circle
                  key={i}
                  cx={6 + pos * (W - 12)}
                  cy={ROAD_H / 2}
                  r={4.5}
                  fill={ACCENT}
                  stroke="white"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-500)]">
              {lastDrive.length} {event} in the last {unit}
            </p>
          </div>
        )}
      </div>

      {/* shrink-0 so the chart is exactly as tall as it wants to be. Letting
          it flex meant its height was pinned by its width and it floated in a
          taller box, wasting a third of the panel. Overflow scrolls instead,
          which the root allows. */}
      <div className="shrink-0 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto max-h-[520px] select-none"
        >
          <title>
            {gaps
              ? `Exponential density at rate ${lambda} per ${unit}, with the area beyond ${fmtX(
                  t,
                )} shaded, equal to ${tailProb.toFixed(4)}`
              : `Poisson bar graph at rate ${lambda} per ${unit}, with ${picked.length} bar(s) selected, totalling ${selected.toFixed(
                  4,
                )}`}
          </title>

          {/* Horizontal gridlines and y-axis ticks */}
          {[0, 0.5, 1].map((frac) => {
            const top = gaps ? yTopCurve : yTopBars;
            const y = gaps ? yCurve(top * frac) : yBar(top * frac);
            return (
              <g key={frac}>
                <line
                  x1={PLOT_X0}
                  y1={y}
                  x2={PLOT_X1}
                  y2={y}
                  stroke="var(--color-line)"
                  strokeWidth="1"
                  strokeDasharray={frac === 0 ? undefined : "3 3"}
                />
                <text
                  x={PLOT_X0 - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={VIZ_TEXT.axisTick}
                  fill="var(--color-ink-500)"
                  className="tabular-nums"
                >
                  {(top * frac).toFixed(2)}
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
            {gaps ? "f(x)" : "p(x)"}
          </text>

          {gaps ? (
            <>
              {/* Observed gaps, drawn behind the curve so the theory reads on
                  top of the data rather than the other way round. */}
              {gapDensity?.map((d, i) => {
                const binWidth = (PLOT_X1 - PLOT_X0) / GAP_BINS;
                return (
                  <rect
                    key={i}
                    x={PLOT_X0 + i * binWidth + 0.5}
                    y={yCurve(d)}
                    width={binWidth - 1}
                    height={AXIS_Y - yCurve(d)}
                    fill={ACCENT}
                    fillOpacity={0.16}
                  />
                );
              })}
              {tailPath && <path d={tailPath} fill={ACCENT} fillOpacity={0.3} />}
              <path d={curvePath} fill="none" stroke={ACCENT_DARK} strokeWidth="2" />
              {/* Mean gap, 1/λ */}
              <g>
                <line
                  x1={xOf(1 / lambda)}
                  y1={PLOT_Y0 + 4}
                  x2={xOf(1 / lambda)}
                  y2={AXIS_Y}
                  stroke={MEAN_C}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text
                  x={xOf(1 / lambda)}
                  y={PLOT_Y0 - 2}
                  textAnchor="middle"
                  fontSize={VIZ_TEXT.axisTick}
                  fontWeight="600"
                  fill={MEAN_C}
                  stroke="white"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  &#956; = {fmtX(1 / lambda)}
                </text>
              </g>
              {/* Draggable threshold t */}
              <g
                className="cursor-ew-resize"
                style={{ touchAction: "none" }}
                onPointerDown={dragThreshold}
              >
                {/* Invisible wider hit area: the visible pill is a small target. */}
                <rect
                  x={xOf(t) - 22}
                  y={PLOT_Y0}
                  width={44}
                  height={HANDLE_Y + 10 - PLOT_Y0}
                  fill="transparent"
                />
                <line
                  x1={xOf(t)}
                  y1={PLOT_Y0}
                  x2={xOf(t)}
                  y2={HANDLE_Y - 10}
                  stroke={ACCENT}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <rect
                  x={xOf(t) - 10}
                  y={HANDLE_Y - 10}
                  width={20}
                  height={17}
                  rx="5"
                  fill={ACCENT}
                />
                <text
                  x={xOf(t)}
                  y={HANDLE_Y + 3}
                  textAnchor="middle"
                  fontSize={VIZ_TEXT.caption}
                  fontWeight="700"
                  fill="white"
                >
                  t
                </text>
              </g>
            </>
          ) : (
            <>
              {pmf.map((prob, x) => {
                const isChosen = chosen.has(x);
                return (
                  <g key={x} className="cursor-pointer" onClick={() => toggleBar(x)}>
                    {/* Invisible full-height hit area: a short bar is a tiny target. */}
                    <rect
                      x={cxBar(x) - slot / 2}
                      y={PLOT_Y0}
                      width={slot}
                      height={AXIS_Y - PLOT_Y0}
                      fill="transparent"
                    />
                    <rect
                      x={cxBar(x) - barW / 2}
                      y={yBar(prob)}
                      width={barW}
                      height={AXIS_Y - yBar(prob)}
                      rx="2"
                      fill={ACCENT}
                      fillOpacity={isChosen ? 0.85 : 0.22}
                    />
                    {x % tickEvery === 0 && (
                      <text
                        x={cxBar(x)}
                        y={AXIS_Y + 14}
                        textAnchor="middle"
                        fontSize={VIZ_TEXT.axisTick}
                        fill={isChosen ? ACCENT_DARK : "var(--color-ink-500)"}
                        className="tabular-nums"
                      >
                        {x}
                      </text>
                    )}
                    {/* The value on top of each bar, as the Module 3 bar
                        explorer does it, while the bars are wide enough. */}
                    {showBarValues && prob >= 0.001 && (
                      <text
                        x={cxBar(x)}
                        y={yBar(prob) - 5}
                        textAnchor="middle"
                        fontSize={VIZ_TEXT.axisTick}
                        fontWeight="600"
                        fill={isChosen ? ACCENT_DARK : "var(--color-ink-500)"}
                        className="tabular-nums"
                      >
                        {prob.toFixed(3)}
                      </text>
                    )}
                  </g>
                );
              })}
              {/* Mean marker at λ, which need not land on a bar */}
              <g>
                <line
                  x1={cxBar(lambda)}
                  y1={PLOT_Y0 + 4}
                  x2={cxBar(lambda)}
                  y2={AXIS_Y}
                  stroke={MEAN_C}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text
                  x={cxBar(lambda)}
                  y={PLOT_Y0 - 2}
                  textAnchor="middle"
                  fontSize={VIZ_TEXT.axisTick}
                  fontWeight="600"
                  fill={MEAN_C}
                  stroke="white"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  &#956; = {lambda.toFixed(2)}
                </text>
              </g>

              {/* Simulation overlay: one hollow marker per observed proportion */}
              {observed?.map((prop, x) =>
                x <= nBars ? (
                  <circle
                    key={`obs-${x}`}
                    cx={cxBar(x)}
                    cy={yBar(prop)}
                    r={3.5}
                    fill="white"
                    stroke={ACCENT_DARK}
                    strokeWidth="1.6"
                  />
                ) : null,
              )}
            </>
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
          {gaps &&
            [0, xMax / 2, xMax].map((v) => (
              <text
                key={v}
                x={xOf(v)}
                y={AXIS_Y + 14}
                textAnchor="middle"
                fontSize={VIZ_TEXT.axisTick}
                fill="var(--color-ink-500)"
                className="tabular-nums"
              >
                {fmtX(v)}
              </text>
            ))}
          <text
            x={(PLOT_X0 + PLOT_X1) / 2}
            y={gaps ? HANDLE_Y + 26 : AXIS_Y + 32}
            textAnchor="middle"
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
          >
            {gaps
              ? `x = gap between ${event}, in ${span}`
              : `x = number of ${event} per ${unit}`}
          </text>
        </svg>
      </div>

      {/* Rate slider */}
      <Slider
        label={`λ (${event} per ${unit})`}
        value={lambda}
        onChange={changeLambda}
        min={MIN_LAMBDA}
        max={MAX_LAMBDA}
        step={0.1}
        format={(v) => v.toFixed(1)}
      />

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            {preset ? preset.source : "Your own rate"}
          </p>
          <VizGuide
            steps={[
              "Pick an example along the top, then switch between counting events and measuring the gaps.",
              "Press Run to cover a stretch for real. The strip shows where the events fell.",
              "One drive feeds both views: how many events it found, and how far apart they were.",
              "Counting: click a bar to select it, click again to unselect. Any set of bars works.",
              "Gaps: drag the handle t, and the shaded tail is Pr[X > t].",
              "Compare the two lines in the gaps read-out: they are always equal, which is Example 13C.",
            ]}
          />
        </div>
        {gaps ? (
          <>
            {/* The two readings sit together on purpose: seeing them carry
                the same number every time is the whole of Example 13C. */}
            <p className="mt-1 text-[15px] leading-snug text-[color:var(--color-ink-900)]">
              Pr[X &gt; {fmtX(t)}] = e<sup>−{lambda.toFixed(1)} × {fmtX(t)}</sup> ={" "}
              <span className="font-semibold tabular-nums">{tailProb.toFixed(4)}</span>
            </p>
            <p className="mt-0.5 text-[15px] text-[color:var(--color-ink-900)]">
              Pr[no {event} in {fmtX(t)} {span}] ={" "}
              <span className="font-semibold tabular-nums">{tailProb.toFixed(4)}</span>
            </p>
            <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
              X ~ E({lambda.toFixed(1)}) &nbsp;·&nbsp;{" "}
              <span style={{ color: MEAN_C }}>
                mean gap = 1/λ = {(1 / lambda).toFixed(2)}
              </span>
            </p>
            <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
              Same event, described twice.
              {gapTotal > 0
                ? ` The pale bars are ${gapTotal.toLocaleString()} gaps you have actually stepped.`
                : ""}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-[15px] leading-snug text-[color:var(--color-ink-900)]">
              {pickedLabel === null ? (
                "No bars selected."
              ) : (
                <>
                  Pr[{pickedLabel}] ={" "}
                  {working && <span className="tabular-nums">{working} = </span>}
                  <span className="font-semibold tabular-nums">{selected.toFixed(4)}</span>
                </>
              )}
            </p>
            <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
              X ~ P({lambda.toFixed(1)}) &nbsp;·&nbsp;{" "}
              {/* Coloured to match the marker on the chart. */}
              <span style={{ color: MEAN_C }}>E[X] = λ = {lambda.toFixed(2)}</span>{" "}
              &nbsp;·&nbsp; Var[X] = λ = {lambda.toFixed(2)}
            </p>
            {/* An always-present line saying what the picture means, the way
                the Module 1 to 3 viz do. */}
            <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
              {picked.length === 0
                ? "Click any bar to add it to the total. Click it again to take it out."
                : working?.startsWith("1 −")
                  ? "Quicker as the complement: subtract the few counts you do not want from 1."
                  : "Mean and variance are both λ, which is unusual and a quick way to check whether real counts are plausibly Poisson."}
            </p>
            {drives > 0 && (
              <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
                {drives.toLocaleString()} {unit} covered, averaging{" "}
                <span className="tabular-nums">{observedMean.toFixed(2)}</span> {event}{" "}
                against {lambda.toFixed(2)} predicted.
                {ringsOffScale ? " Some early results are above the top of the axis." : ""}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
