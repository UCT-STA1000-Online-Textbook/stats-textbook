/**
 * Peaked-versus-flat variance demonstration for Module 3, WU2
 * (`m3-working-with-rv`).
 *
 * Serves the chapter's "geometrical interpretation of the mean and the
 * variance". The mean half of that interpretation (a ruler balancing on its
 * fulcrum) is already covered by `MeanMedianBalance` in Module 2, so this viz
 * deliberately leaves the mean alone and makes only the variance move: the
 * distribution is built so that μ stays pinned at 2 no matter where the slider
 * sits, and the only thing that changes is how spread out the probability is.
 *
 * The family is p(x) ∝ (t², t, 1, t, t²) on x = 0…4, normalised by
 * Z = 2t² + 2t + 1. It is symmetric about x = 2 for every t, so μ = 2 exactly,
 * and its variance runs smoothly from 0 (all mass on the mean, t = 0) to 2
 * (uniform across all five values, t = 1). That gives a clean one-slider
 * illustration of the text's claim: a peaked distribution has small variance,
 * a flat one has large variance.
 *
 * Each bar also reports its own contribution (x − μ)² p(x) to the variance
 * sum, so the student can see that the outer values are what actually drive
 * the variance up: they are the ones with a large (x − μ)².
 *
 * Default tier: hand-rolled SVG driven by a single range input. Nothing
 * animates, so no loop runs.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { Slider, VIZ_TEXT, clamp01, toNum } from "../shared";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const MEAN_C = "rgb(220, 38, 38)"; // red-600 — same mean colour as the Module 2 viz

// SVG geometry (viewBox units).
const W = 440;
const H = 268;
const PLOT_X0 = 46;
const PLOT_X1 = 424;
/**
 * Top of the plot area. Deliberately low: at the peaked end of the slider the
 * centre bar reaches this line and hangs its two labels 15 and 5 units above
 * it, so the mean caption above needs a reserved band or the three collide.
 */
const PLOT_Y0 = 42;
const AXIS_Y = 196;
/** Row below the axis carrying the μ ± σ span. */
const SPAN_Y = 226;
/** Baseline for the mean caption, inside the band reserved above the plot. */
const MEAN_LABEL_Y = 14;

/** The five values the random variable can take. */
const XS = [0, 1, 2, 3, 4];
/** The mean of this family, fixed by construction at the centre of `XS`. */
const MU = 2;

/**
 * Probabilities for the spread parameter `t`.
 *
 * Weights (t², t, 1, t, t²) normalised to sum to one. At t = 0 all the mass
 * sits on x = 2; at t = 1 every value is equally likely.
 */
function pmfFor(t: number): number[] {
  const w = [t * t, t, 1, t, t * t];
  const z = w.reduce((s, v) => s + v, 0);
  return w.map((v) => v / z);
}

/**
 * @param params.t — initial spread, 0 (all mass on the mean) to 1 (uniform);
 *   defaults to 0.5.
 */
export default function VarianceSpread({ params }: { params: VizParams }) {
  const [t, setT] = useState(() => clamp01(toNum(params.t, 0.5)));

  const p = pmfFor(t);
  /** Each value's own contribution to the variance sum, (x − μ)² p(x). */
  const contrib = XS.map((x, i) => (x - MU) ** 2 * p[i]);
  const variance = contrib.reduce((s, v) => s + v, 0);
  const sd = Math.sqrt(variance);
  // The text notes the coefficient of variation is only sensible when the
  // variable's lower limit is zero, which holds here (X starts at 0).
  const cv = sd / MU;

  const pMax = Math.max(...p);
  const yTop = Math.min(1, Math.ceil(pMax * 10) / 10 + 0.1) || 1;

  const slot = (PLOT_X1 - PLOT_X0) / XS.length;
  const cx = (i: number) => PLOT_X0 + slot * (i + 0.5);
  const barW = Math.min(slot * 0.52, 42);
  const yOf = (v: number) => AXIS_Y - (v / yTop) * (AXIS_Y - PLOT_Y0);
  /** Maps a data value (not an index) onto the axis, for the μ ± σ span. */
  const xOfValue = (v: number) => PLOT_X0 + slot * (v + 0.5);

  /** Plain-language reading of the current shape, shown under the chart. */
  const shape =
    t < 0.15
      ? "Very peaked: almost all the probability sits on the mean itself, so the terms (x − μ)² are nearly all zero and the variance is tiny."
      : t > 0.85
        ? "Very flat: the probability is spread evenly across all five values, so the outer terms (x − μ)² are large and the variance is at its biggest."
        : "In between: the outer values carry enough probability to pull the variance up, but the centre still holds the most.";

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Spread control */}
      <Slider
        label="spread of the distribution"
        value={t}
        onChange={setT}
        mono={false}
      />

      {/* Bar graph */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[300px] select-none">
          <title>
            A symmetric distribution on 0 to 4 with mean fixed at 2 and variance{" "}
            {variance.toFixed(3)}
          </title>

          {/* Gridlines and y-axis ticks */}
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
                  {v.toFixed(1)}
                </text>
              </g>
            );
          })}

          <text
            x={13}
            y={(PLOT_Y0 + AXIS_Y) / 2}
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
            textAnchor="middle"
            transform={`rotate(-90 13 ${(PLOT_Y0 + AXIS_Y) / 2})`}
          >
            p(x)
          </text>

          {/* Bars, labelled with their contribution to the variance */}
          {XS.map((x, i) => (
            <g key={x}>
              <rect
                x={cx(i) - barW / 2}
                y={yOf(p[i])}
                width={barW}
                height={AXIS_Y - yOf(p[i])}
                fill={ACCENT}
                fillOpacity={x === MU ? 1 : 0.75}
                stroke={ACCENT_DARK}
                strokeWidth="1"
                rx="2"
              />
              {/* Both labels carry a white halo (stroke painted under the
                  fill) because the dashed mean line runs vertically through
                  the centre bar's labels and would otherwise strike them out. */}
              <text
                x={cx(i)}
                y={yOf(p[i]) - 15}
                textAnchor="middle"
                fontSize={VIZ_TEXT.axisTick}
                fontWeight="600"
                fill={ACCENT_DARK}
                stroke="white"
                strokeWidth="3"
                paintOrder="stroke"
                className="tabular-nums"
              >
                {p[i].toFixed(3)}
              </text>
              {/* Contribution (x − μ)² p(x). Always zero at the mean itself,
                  which is the point the text is making about the variance. */}
              <text
                x={cx(i)}
                y={yOf(p[i]) - 5}
                textAnchor="middle"
                fontSize={VIZ_TEXT.axisTick}
                fill="var(--color-ink-500)"
                stroke="white"
                strokeWidth="3"
                paintOrder="stroke"
                className="tabular-nums"
              >
                +{contrib[i].toFixed(3)}
              </text>
              <text
                x={cx(i)}
                y={AXIS_Y + 15}
                textAnchor="middle"
                fontSize={VIZ_TEXT.axisTick}
                fill="var(--color-ink-700)"
                className="tabular-nums"
              >
                {x}
              </text>
            </g>
          ))}

          <line
            x1={PLOT_X0}
            y1={AXIS_Y}
            x2={PLOT_X1}
            y2={AXIS_Y}
            stroke="var(--color-ink-900)"
            strokeWidth="1"
          />

          {/* The mean, pinned at x = 2 for every value of the slider */}
          {/* Runs up to just under its own caption so the two read as one
              marker. It crosses the centre bar's labels on the way, which is
              why those carry white halos. */}
          <line
            x1={xOfValue(MU)}
            y1={MEAN_LABEL_Y + 5}
            x2={xOfValue(MU)}
            y2={AXIS_Y}
            stroke={MEAN_C}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={xOfValue(MU)}
            y={MEAN_LABEL_Y}
            textAnchor="middle"
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={MEAN_C}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            &#956; = 2
          </text>

          {/* The μ ± σ span: the visual width of the distribution */}
          <line
            x1={xOfValue(Math.max(0, MU - sd))}
            y1={SPAN_Y}
            x2={xOfValue(Math.min(4, MU + sd))}
            y2={SPAN_Y}
            stroke={ACCENT}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {[MU - sd, MU + sd].map((v, i) => (
            <line
              key={i}
              x1={xOfValue(v)}
              y1={SPAN_Y - 5}
              x2={xOfValue(v)}
              y2={SPAN_Y + 5}
              stroke={ACCENT}
              strokeWidth="2"
            />
          ))}
          <text
            x={xOfValue(MU)}
            y={SPAN_Y + 20}
            textAnchor="middle"
            fontSize={VIZ_TEXT.axisTick}
            fill={ACCENT_DARK}
            className="tabular-nums"
          >
            &#956; &#177; &#963; = 2 &#177; {sd.toFixed(2)}
          </text>
        </svg>
      </div>

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            Peaked or flat
          </p>
          <VizGuide
            steps={[
              "Drag the slider to move probability between the centre and the outer values.",
              "The mean stays at 2 the whole time: the distribution is always symmetric.",
              "The small grey number above each bar is that value's contribution (x − μ)² p(x).",
              "The bar at the mean always contributes zero, because there x − μ = 0.",
              "Watch the blue μ ± σ bar widen as the distribution flattens.",
            ]}
          />
        </div>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px] text-[color:var(--color-ink-900)]">
          <span style={{ color: MEAN_C }}>
            &#956; = <span className="font-semibold tabular-nums">2.000</span>
          </span>
          <span>
            &#963;&#178; = <span className="font-semibold tabular-nums">{variance.toFixed(3)}</span>
          </span>
          <span>
            &#963; = <span className="font-semibold tabular-nums">{sd.toFixed(3)}</span>
          </span>
          <span>
            CV = <span className="font-semibold tabular-nums">{cv.toFixed(3)}</span>
          </span>
        </div>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{shape}</p>
      </div>
    </div>
  );
}
