/**
 * Sampling distribution of the sample mean, used by Module 5, WU1
 * (`m5-sampling-distribution`). This is the central limit theorem viz.
 *
 * The unit's key idea is that a sample mean x̄ is itself a random variable:
 * take another sample and you get another x̄. That is easy to state and hard
 * to believe, so the viz makes the student do it. Two charts share one fixed
 * x-axis:
 *
 *   - The upper chart is the population. A single run takes n values from it,
 *     shows them as a rug on its axis, and marks their mean x̄.
 *   - The lower chart collects the x̄ from every run as a histogram, drawn
 *     under the Normal curve N(μ, σ²/n) that the theory predicts.
 *
 * Because the axis never rescales, raising n is *seen* to squeeze the sample
 * means towards μ (the σ/√n in the variance), and switching to the skewed
 * light-bulb population shows the central limit theorem at work: the means
 * lean right at small n and settle into the bell as n grows.
 *
 * The lower chart's height does rescale, to fit whichever is taller of the
 * curve and (after `MIN_FOR_SCALE` samples) the tallest bar. Its height is a
 * density, so only the shape and the fit to the curve carry meaning, and no
 * y-axis numbers are printed.
 *
 * Default tier: hand-rolled SVG. The only animation is the short fall of a
 * single run's x̄ into the lower chart, via `useReplayTween`, which stops
 * drawing frames as soon as it lands.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { Slider, VIZ_TEXT, VizHint } from "../shared";
import { sampleExponential, sampleNormal, sampleUniform } from "../sampling";
import { useReplayTween } from "../useReplayTween";
import {
  SAMPLE_MEAN_PRESETS,
  type Population,
  type SampleMeanPreset,
} from "../data/inferenceData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
/** Mean marker colour, shared with every other viz that marks a mean. */
const MEAN_C = "rgb(220, 38, 38)"; // red-600

// SVG geometry (viewBox units). Both charts use the same horizontal extent so
// a value sits at the same x in each.
const W = 440;
const H = 402;
const PLOT_X0 = 24;
const PLOT_X1 = 424;
/** Upper chart: the population. */
const POP_Y0 = 30;
const POP_AXIS = 118;
/** Lower chart: the sample means. */
const MEAN_Y0 = 186;
const MEAN_AXIS = 356;

/** Largest sample size on the slider. Past 50 the pile barely narrows further. */
const MAX_N = 50;
/**
 * Histogram bins per standard deviation of X̄. Tying the bin width to σ/√n,
 * rather than fixing it, keeps roughly the same number of bars across the
 * pile at every n, so a narrow pile at n = 50 is not just two or three bars.
 * This is safe because changing n already clears the tally.
 */
const BINS_PER_SD = 5;
/** Samples needed before the bars, not just the curve, set the lower chart's height. */
const MIN_FOR_SCALE = 50;
/** Points used to trace each density curve. */
const CURVE_STEPS = 160;

/** Population mean μ. */
function popMean(p: Population): number {
  if (p.kind === "normal") return p.mu;
  if (p.kind === "uniform") return (p.a + p.b) / 2;
  return 1 / p.lambda;
}

/** Population standard deviation σ. */
function popSd(p: Population): number {
  if (p.kind === "normal") return p.sigma;
  if (p.kind === "uniform") return (p.b - p.a) / Math.sqrt(12);
  return 1 / p.lambda;
}

/** Population density f(x). */
function popPdf(p: Population, x: number): number {
  if (p.kind === "normal") return normalPdf(x, p.mu, p.sigma);
  if (p.kind === "uniform") return x >= p.a && x <= p.b ? 1 / (p.b - p.a) : 0;
  return x >= 0 ? p.lambda * Math.exp(-p.lambda * x) : 0;
}

/** One value drawn from the population. */
function popDraw(p: Population): number {
  if (p.kind === "normal") return sampleNormal(p.mu, p.sigma);
  if (p.kind === "uniform") return sampleUniform(p.a, p.b);
  return sampleExponential(p.lambda);
}

function normalPdf(x: number, mu: number, sd: number): number {
  const z = (x - mu) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

/**
 * Prints a variance compactly: large ones as whole numbers, small ones to four
 * decimals, so N(1000, 500000) and N(18, 0.0490) both read naturally.
 */
function fmtVariance(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString("en-US").replace(/,/g, " ");
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

/**
 * Prints a standard deviation to about three significant figures, so the
 * light bulbs read 707 rather than 707.107 and the travel times read 0.221.
 */
function fmtSd(v: number): string {
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

/** Running tally of sample means, binned for the histogram. */
interface Tally {
  /** How many sample means fell in each bin, starting at the view's left edge. */
  counts: number[];
  /** Every sample mean taken, including any that fell off the chart. */
  total: number;
  sum: number;
  sumSq: number;
}

function emptyTally(bins: number): Tally {
  return { counts: new Array<number>(bins).fill(0), total: 0, sum: 0, sumSq: 0 };
}

/**
 * Take samples of size n from a population, see where their means land, and
 * compare the pile of means with N(μ, σ²/n).
 *
 * @param params.preset — id of the population to open with, from
 *   `SAMPLE_MEAN_PRESETS`; defaults to the travel times of Example 1A. The
 *   starting n comes from the preset rather than a param: MDX only forwards
 *   quoted string attributes, so a numeric one could never reach here.
 */
export default function SamplingDistribution({ params }: { params: VizParams }) {
  const initial =
    SAMPLE_MEAN_PRESETS.find((p) => p.id === params.preset) ?? SAMPLE_MEAN_PRESETS[0];

  const [preset, setPreset] = useState<SampleMeanPreset>(initial);
  const [n, setN] = useState(initial.startN);

  const pop = preset.population;
  const mu = popMean(pop);
  const sigma = popSd(pop);
  const se = sigma / Math.sqrt(n);
  const [viewLo, viewHi] = preset.view;
  const viewSpan = viewHi - viewLo;
  const binW = se / BINS_PER_SD;
  const bins = Math.ceil(viewSpan / binW);

  const [tally, setTally] = useState<Tally>(() => emptyTally(bins));
  /**
   * The values of the most recent single run, shown as a rug under the
   * population. Null after a batch or a reset: batches only add to the tally.
   */
  const [lastSample, setLastSample] = useState<number[] | null>(null);
  /** Counts single runs, so each one replays the falling-x̄ animation. */
  const [runId, setRunId] = useState(0);
  const fall = useReplayTween([runId], 480);

  const fmt = preset.format;
  const xOf = (v: number) => PLOT_X0 + ((v - viewLo) / viewSpan) * (PLOT_X1 - PLOT_X0);
  /** Bin a sample mean falls in, or -1 if it is off the chart. */
  const binOf = (v: number) => {
    const i = Math.floor((v - viewLo) / binW);
    return i >= 0 && i < bins ? i : -1;
  };

  const lastMean = lastSample ? lastSample.reduce((s, v) => s + v, 0) / n : null;
  const lastBin = lastMean === null ? -1 : binOf(lastMean);
  // While the latest x̄ is still falling it has not landed yet, so its bar is
  // drawn one short and grows the moment the dot arrives.
  const falling = lastMean !== null && fall < 1;
  const shownCount = (i: number) =>
    tally.counts[i] - (falling && i === lastBin ? 1 : 0);

  /** Forget every sample so far. Called whenever the question on screen changes. */
  function clearTally(nextBins = bins) {
    setTally(emptyTally(nextBins));
    setLastSample(null);
  }

  /** Take `times` samples of size n and add their means to the tally. */
  function run(times: number) {
    const counts = tally.counts.slice();
    let { total, sum, sumSq } = tally;
    let sample: number[] = [];
    for (let t = 0; t < times; t++) {
      sample = Array.from({ length: n }, () => popDraw(pop));
      const m = sample.reduce((s, v) => s + v, 0) / n;
      const i = binOf(m);
      if (i >= 0) counts[i] += 1;
      total += 1;
      sum += m;
      sumSq += m * m;
    }
    setTally({ counts, total, sum, sumSq });
    if (times === 1) {
      setLastSample(sample);
      setRunId((k) => k + 1);
    } else {
      setLastSample(null);
    }
  }

  function changeN(next: number) {
    setN(next);
    clearTally(Math.ceil(viewSpan / (sigma / Math.sqrt(next) / BINS_PER_SD)));
  }

  function loadPreset(p: SampleMeanPreset) {
    setPreset(p);
    setN(p.startN);
    const nextSe = popSd(p.population) / Math.sqrt(p.startN);
    clearTally(Math.ceil((p.view[1] - p.view[0]) / (nextSe / BINS_PER_SD)));
  }

  // --- Upper chart: the population density ---
  const popPeak =
    pop.kind === "normal"
      ? normalPdf(mu, mu, sigma)
      : pop.kind === "uniform"
        ? 1 / (pop.b - pop.a)
        : pop.lambda;
  const popY = (f: number) => POP_AXIS - (f / (popPeak * 1.12)) * (POP_AXIS - POP_Y0);
  // The Uniform density has vertical sides that a sampled curve would draw as
  // slopes, so it is traced exactly; the smooth shapes are sampled.
  const popPath =
    pop.kind === "uniform"
      ? `M ${xOf(pop.a)} ${POP_AXIS} L ${xOf(pop.a)} ${popY(popPeak)} L ${xOf(pop.b)} ${popY(
          popPeak,
        )} L ${xOf(pop.b)} ${POP_AXIS}`
      : Array.from({ length: CURVE_STEPS + 1 }, (_, k) => {
          const x = viewLo + (k / CURVE_STEPS) * viewSpan;
          return `${k === 0 ? "M" : "L"} ${xOf(x).toFixed(1)} ${popY(popPdf(pop, x)).toFixed(1)}`;
        }).join(" ");

  // --- Lower chart: the sample means against N(μ, σ²/n) ---
  const theoryPeak = normalPdf(mu, mu, se);
  const density = (count: number) => (tally.total > 0 ? count / (tally.total * binW) : 0);
  const maxObserved = tally.counts.reduce((m, c) => Math.max(m, density(c)), 0);
  // With only a handful of samples each bar is a big share of the total and
  // stands far above the curve; scaling to it would flatten the curve to a
  // line. So the bars only get a say in the scale once there are enough of
  // them to have a shape, and until then any taller bar is clipped at the top.
  const meanTop =
    Math.max(theoryPeak, tally.total >= MIN_FOR_SCALE ? maxObserved : 0) * 1.12;
  const meanY = (f: number) =>
    MEAN_AXIS - Math.min(1, f / meanTop) * (MEAN_AXIS - MEAN_Y0);
  const theoryPath = Array.from({ length: CURVE_STEPS + 1 }, (_, k) => {
    const x = viewLo + (k / CURVE_STEPS) * viewSpan;
    return `${k === 0 ? "M" : "L"} ${xOf(x).toFixed(1)} ${meanY(normalPdf(x, mu, se)).toFixed(1)}`;
  }).join(" ");

  // Where the falling x̄ starts (the population axis) and lands (the top of
  // its bar once counted). A mean off the chart has nowhere to land.
  const landY = lastBin >= 0 ? meanY(density(tally.counts[lastBin])) : MEAN_AXIS;
  const dotY = POP_AXIS + (landY - POP_AXIS) * fall;

  const obsMean = tally.total > 0 ? tally.sum / tally.total : 0;
  const obsSd =
    tally.total > 1
      ? Math.sqrt(Math.max(0, (tally.sumSq - tally.total * obsMean * obsMean) / (tally.total - 1)))
      : 0;

  const ticks = [viewLo, viewLo + viewSpan / 4, (viewLo + viewHi) / 2, viewLo + (3 * viewSpan) / 4, viewHi];
  const isNormal = pop.kind === "normal";
  /** σ to at most two decimals, without trailing zeros: 1.4, 4.33, 1000. */
  const fmtSigma = String(Number(sigma.toFixed(2)));
  /**
   * Where the latest x̄ is drawn. A mean beyond the chart (a long-lived bulb
   * at n = 1) is pinned to the edge, so a run never looks as if it did
   * nothing; its label still gives the true value and says it is off-chart.
   */
  const lastX = lastMean === null ? 0 : Math.min(PLOT_X1, Math.max(PLOT_X0, xOf(lastMean)));
  const lastOffChart = lastMean !== null && (lastMean < viewLo || lastMean > viewHi);

  /** One plain sentence on what the picture currently means. */
  const interpretation = isNormal
    ? `The population is Normal, so X̄ is exactly Normal for every n. A bigger n only makes it narrower.`
    : n === 1
      ? `With n = 1 each "mean" is a single value, so the means have the same shape as the population. Raise n and watch it change.`
      : pop.kind === "uniform"
        ? `The population is flat, yet the means already pile up in the middle: averaging lets high and low values cancel out.`
        : n < 30
          ? `With n = ${n} the means still lean to the right, like the bulbs themselves. The Normal curve is only a rough fit until n is larger.`
          : `With n = ${n} the means have lost the skew of the population and follow the Normal curve closely: the central limit theorem at work.`;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      {/* Population selector */}
      <div className="flex flex-wrap gap-1.5">
        {SAMPLE_MEAN_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => loadPreset(p)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              preset.id === p.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <VizHint>
        Press <strong className="font-semibold">{preset.drawOne(n)}</strong> to do the
        study once, then <strong className="font-semibold">Repeat 500 times</strong> to see
        how much x̄ could have varied.
      </VizHint>

      {/* Sample size and the run buttons */}
      <div className="rounded-lg border border-[color:var(--color-line)] px-3 py-2 space-y-2">
        <Slider
          label="n, the sample size"
          mono={false}
          value={n}
          min={1}
          max={MAX_N}
          step={1}
          format={(v) => String(v)}
          onChange={changeN}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mr-0.5">
            Run it
          </span>
          <button
            onClick={() => run(1)}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700"
          >
            {preset.drawOne(n)}
          </button>
          <button
            onClick={() => run(500)}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700"
          >
            {/* Named as a repeat of the study, not "take 500 samples": in
                practice there is only ever one sample, and the repeats are
                the thought experiment that shows how much its x̄ could vary. */}
            Repeat 500 times
          </button>
          <button
            onClick={() => clearTally()}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-500)] transition-colors hover:border-blue-400"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[520px] select-none">
          <title>
            Upper chart: the population, with mean {fmt(mu)} and standard deviation{" "}
            {fmtSigma}. Lower chart: {tally.total} sample means from samples of size{" "}
            {n}, against the Normal curve with mean {fmt(mu)} and standard deviation{" "}
            {fmtSd(se)}.
          </title>

          {/* ---- Upper chart: the population ---- */}
          <text
            x={PLOT_X0}
            y={14}
            fontSize={VIZ_TEXT.caption}
            fontWeight="600"
            fill="var(--color-ink-700)"
          >
            The population: one value per {preset.item}
          </text>
          <path
            d={`${popPath} L ${PLOT_X1} ${POP_AXIS} L ${PLOT_X0} ${POP_AXIS} Z`}
            fill={ACCENT}
            fillOpacity={0.08}
            stroke="none"
          />
          <path d={popPath} fill="none" stroke="var(--color-ink-500)" strokeWidth="1.5" />

          {/* The latest sample's values as a rug on the population axis. A
              value has only a position along x, so each is a tick standing
              on the axis rather than a dot at some height that would look
              like it meant something. */}
          {lastSample?.map((v, i) => (
            <line
              key={i}
              x1={xOf(v)}
              y1={POP_AXIS}
              x2={xOf(v)}
              y2={POP_AXIS - 10}
              stroke={ACCENT}
              strokeWidth="1.5"
              strokeOpacity={0.6}
            />
          ))}

          <line x1={PLOT_X0} y1={POP_AXIS} x2={PLOT_X1} y2={POP_AXIS} stroke="var(--color-ink-900)" />
          {ticks.map((t) => (
            <text
              key={`pt${t}`}
              x={xOf(t)}
              y={POP_AXIS + 13}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-500)"
              className="tabular-nums"
            >
              {fmt(t)}
            </text>
          ))}

          {/* Population mean μ: red, dashed, labelled above the chart */}
          <line
            x1={xOf(mu)}
            y1={POP_Y0 - 4}
            x2={xOf(mu)}
            y2={POP_AXIS}
            stroke={MEAN_C}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={xOf(mu) + 4}
            y={POP_Y0}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={MEAN_C}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            &#956; = {fmt(mu)}
          </text>

          {/* The latest sample's mean x̄, marked where the rug sits. Its label
              sits low, near the rug, so it never collides with the μ label
              at the top even when the two lines nearly coincide. */}
          {lastMean !== null && (
            <g>
              <line
                x1={lastX}
                y1={POP_AXIS - 28}
                x2={lastX}
                y2={POP_AXIS}
                stroke={ACCENT_DARK}
                strokeWidth="2"
              />
              <text
                x={lastX}
                y={POP_AXIS - 32}
                textAnchor={lastX > PLOT_X1 - 50 ? "end" : lastX < PLOT_X0 + 50 ? "start" : "middle"}
                fontSize={VIZ_TEXT.axisTick}
                fontWeight="600"
                fill={ACCENT_DARK}
                stroke="white"
                strokeWidth="3"
                paintOrder="stroke"
                className="tabular-nums"
              >
                x̄ = {fmt(lastMean)}
                {lastOffChart && " (off the chart)"}
              </text>
            </g>
          )}

          {/* ---- Lower chart: the sample means ---- */}
          <text
            x={PLOT_X0}
            y={MEAN_Y0 - 22}
            fontSize={VIZ_TEXT.caption}
            fontWeight="600"
            fill="var(--color-ink-700)"
          >
            Sample means: one x̄ per sample of {n}
          </text>

          {/* Observed means as pale bars, drawn first so the theory curve
              sits over them. */}
          {tally.counts.map((_, i) => {
            const c = shownCount(i);
            if (c <= 0) return null;
            const x0 = xOf(viewLo + i * binW);
            const x1 = xOf(Math.min(viewHi, viewLo + (i + 1) * binW));
            const y = meanY(density(c));
            return (
              <rect
                key={i}
                x={x0}
                y={y}
                width={Math.max(0.5, x1 - x0 - 0.5)}
                height={MEAN_AXIS - y}
                fill={ACCENT}
                fillOpacity={0.28}
              />
            );
          })}

          <path d={theoryPath} fill="none" stroke={ACCENT_DARK} strokeWidth="2" />

          <line x1={PLOT_X0} y1={MEAN_AXIS} x2={PLOT_X1} y2={MEAN_AXIS} stroke="var(--color-ink-900)" />
          {ticks.map((t) => (
            <text
              key={`mt${t}`}
              x={xOf(t)}
              y={MEAN_AXIS + 13}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-500)"
              className="tabular-nums"
            >
              {fmt(t)}
            </text>
          ))}
          <text
            x={(PLOT_X0 + PLOT_X1) / 2}
            y={MEAN_AXIS + 34}
            textAnchor="middle"
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
          >
            {preset.axisLabel}
          </text>

          {/* The mean of X̄ is μ, so the same red marker carries straight down. */}
          <line
            x1={xOf(mu)}
            y1={MEAN_Y0 - 8}
            x2={xOf(mu)}
            y2={MEAN_AXIS}
            stroke={MEAN_C}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={xOf(mu) + 4}
            y={MEAN_Y0 - 4}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={MEAN_C}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            &#956; = {fmt(mu)}
          </text>

          {/* The latest x̄ falling from the population into the pile. */}
          {falling && lastMean !== null && (
            <circle cx={lastX} cy={dotY} r={4.5} fill={ACCENT_DARK} />
          )}
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
              "Pick a population along the top. The upper chart shows its shape, with the population mean μ in red.",
              "Set n, the number of values in each sample.",
              "Press the first run button to take one sample. Its values appear as ticks under the population, and their mean x̄ drops into the lower chart.",
              "In real life you only get one sample. Press Repeat 500 times to imagine the whole study done 500 times over, and see where all those sample means land. The blue curve is the Normal distribution N(μ, σ²/n) that the theory predicts.",
              "Change n and compare. A bigger n gives a narrower pile of means; for the skewed light bulbs it also gives a more bell-shaped one.",
            ]}
          />
        </div>
        {/* The working, then the answer: substituting σ and n into σ²/n is
            the whole calculation this unit teaches. For a non-Normal
            population the result is only an approximation, so it says so. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          X̄ {isNormal ? "~" : "≈"} N(μ, σ²/n) = N({fmt(mu)}, {fmtSigma}²/{n}) ={" "}
          <span className="font-semibold">
            N(<span style={{ color: MEAN_C }}>{fmt(mu)}</span>, {fmtVariance((sigma * sigma) / n)})
          </span>
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
          σ/√n = {fmtSigma}/√{n} = {fmtSd(se)}
          {tally.total > 1 && (
            <>
              {" "}&nbsp;·&nbsp; {tally.total.toLocaleString()} samples: mean of x̄ ={" "}
              {obsMean.toFixed(isNormal ? 2 : 1)}, sd of x̄ = {fmtSd(obsSd)}
            </>
          )}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{interpretation}</p>
      </div>
    </div>
  );
}
