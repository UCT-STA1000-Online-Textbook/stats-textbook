/**
 * Skewness morpher for Module 3, WU2 (`m3-working-with-rv`).
 *
 * The chapter's Skewness section describes three shapes (negatively skewed,
 * symmetric, positively skewed) with three static pictures. This turns those
 * pictures into one continuous slider, so a student can watch a long tail grow
 * on one side and shrink on the other rather than comparing three separate
 * figures.
 *
 * It also carries over the mean-versus-median lesson from Module 2: both
 * markers are drawn, and the read-out names which side the mean has been
 * dragged to. That is the practical test for skewness a student can actually
 * apply to a data set, and it links this section back to
 * `m2-summary-measures`.
 *
 * The family is the beta density f(x) ∝ x^(α−1)(1−x)^(β−1) on [0, 1] with
 * α = 3 − 1.6s and β = 3 + 1.6s, so α + β is always 6 and the mean is exactly
 * α/6. Both shape parameters stay above 1 across the whole slider range, which
 * keeps the density finite at both ends and the peak inside the interval.
 *
 * The normalising constant and the median are found numerically (trapezoid
 * rule over the sampled curve) rather than via a gamma function, since α and β
 * are not whole numbers. The median has no closed form for a beta density in
 * any case.
 *
 * Default tier: hand-rolled SVG driven by a single range input. Nothing
 * animates, so no loop runs.
 */

"use client";

import { useMemo, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { Slider, VIZ_TEXT, clamp01, toNum } from "../shared";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const MEAN_C = "rgb(220, 38, 38)"; // red-600 — matches the Module 2 mean colour
const MEDIAN_C = "rgb(5, 150, 105)"; // emerald-600 — matches the Module 2 median

// SVG geometry (viewBox units).
const W = 440;
const H = 282;
const PLOT_X0 = 40;
const PLOT_X1 = 424;
const PLOT_Y0 = 26;
const AXIS_Y = 200;
/** Sample count for drawing and for the numerical integrals. */
const SAMPLES = 240;

/**
 * @param params.skew — initial skew from -1 (long left tail) through 0
 *   (symmetric) to 1 (long right tail); defaults to 1, the positively skewed
 *   shape the text introduces first by name.
 */
export default function SkewnessMorpher({ params }: { params: VizParams }) {
  // The shared slider is a 0-to-1 control, so skew is stored in [0, 1] and
  // mapped to [-1, 1] for display and for the shape parameters.
  const [v, setV] = useState(() => clamp01((toNum(params.skew, 1) + 1) / 2));
  const s = 2 * v - 1;

  const alpha = 3 - 1.6 * s;
  const beta = 3 + 1.6 * s;

  const { curve, fMax, mean, median } = useMemo(() => {
    const xs: number[] = [];
    const gs: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = i / SAMPLES;
      xs.push(x);
      gs.push(Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1));
    }

    // Trapezoid rule for the normalising constant, then for the running area.
    const h = 1 / SAMPLES;
    let total = 0;
    const cum: number[] = [0];
    for (let i = 1; i <= SAMPLES; i++) {
      total += ((gs[i - 1] + gs[i]) / 2) * h;
      cum.push(total);
    }

    const dens = gs.map((g) => g / total);
    const cdf = cum.map((c) => c / total);

    // Median: first crossing of 0.5, linearly interpolated between samples.
    let med = 0.5;
    for (let i = 1; i <= SAMPLES; i++) {
      if (cdf[i] >= 0.5) {
        const span = cdf[i] - cdf[i - 1];
        const frac = span === 0 ? 0 : (0.5 - cdf[i - 1]) / span;
        med = xs[i - 1] + frac * h;
        break;
      }
    }

    return {
      curve: xs.map((x, i) => [x, dens[i]] as [number, number]),
      fMax: Math.max(...dens),
      // Exact for a beta density, since alpha + beta is always 6.
      mean: alpha / 6,
      median: med,
    };
  }, [alpha, beta]);

  const yTop = fMax * 1.15;
  const xOf = (x: number) => PLOT_X0 + x * (PLOT_X1 - PLOT_X0);
  const yOf = (y: number) => AXIS_Y - (y / yTop) * (AXIS_Y - PLOT_Y0);

  const areaPath =
    `M ${xOf(0)} ${AXIS_Y} ` +
    curve.map(([x, y]) => `L ${xOf(x)} ${yOf(y)}`).join(" ") +
    ` L ${xOf(1)} ${AXIS_Y} Z`;

  /**
   * Read the shape off the slider itself rather than off the mean/median gap.
   * The gap shrinks smoothly to zero, so any tolerance on it labels a band of
   * slider positions "symmetric" while the two markers are still visibly
   * apart. The slider steps in hundredths, so this catches only dead centre,
   * where the density really is symmetric and the markers really do coincide.
   */
  const direction =
    Math.abs(s) < 0.01 ? "symmetric" : s > 0 ? "positive" : "negative";

  const label =
    direction === "symmetric"
      ? "Symmetric"
      : direction === "positive"
        ? "Positively skewed"
        : "Negatively skewed";

  const caption =
    direction === "symmetric"
      ? "The two tails are mirror images, and the mean and the median sit on top of each other."
      : direction === "positive"
        ? "There is a long tail on the right. The far-out values on that side pull the mean past the median, so the mean is the larger of the two."
        : "There is a long tail on the left. The far-out values on that side pull the mean past the median, so the mean is the smaller of the two.";

  return (
    <div className="h-full flex flex-col gap-3">
      <Slider
        label="skewness: left tail to right tail"
        value={v}
        onChange={setV}
        mono={false}
      />

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[300px] select-none">
          <title>
            A {label.toLowerCase()} density, with mean {mean.toFixed(3)} and median{" "}
            {median.toFixed(3)}
          </title>

          <path d={areaPath} fill={ACCENT} fillOpacity={0.22} />
          <path
            d={curve.map(([x, y], i) => `${i ? "L" : "M"} ${xOf(x)} ${yOf(y)}`).join(" ")}
            fill="none"
            stroke={ACCENT_DARK}
            strokeWidth="2"
          />

          <line
            x1={PLOT_X0}
            y1={AXIS_Y}
            x2={PLOT_X1}
            y2={AXIS_Y}
            stroke="var(--color-ink-900)"
            strokeWidth="1"
          />

          {/* Axis captions. The y-axis carries no numeric ticks on purpose:
              the vertical scale is rescaled to each shape's own peak, so a
              number there would invite comparisons between shapes that the
              scale does not support. Only the horizontal scale is fixed. */}
          <text
            x={16}
            y={(PLOT_Y0 + AXIS_Y) / 2}
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
            textAnchor="middle"
            transform={`rotate(-90 16 ${(PLOT_Y0 + AXIS_Y) / 2})`}
          >
            f(x)
          </text>
          {[0, 0.5, 1].map((tick) => (
            <g key={tick}>
              <line
                x1={xOf(tick)}
                y1={AXIS_Y}
                x2={xOf(tick)}
                y2={AXIS_Y + 4}
                stroke="var(--color-ink-400)"
                strokeWidth="1"
              />
              <text
                x={xOf(tick)}
                y={AXIS_Y + 14}
                textAnchor="middle"
                fontSize={VIZ_TEXT.axisTick}
                fill="var(--color-ink-500)"
                className="tabular-nums"
              >
                {tick.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Mean marker, drawn above the axis */}
          <line
            x1={xOf(mean)}
            y1={PLOT_Y0 - 4}
            x2={xOf(mean)}
            y2={AXIS_Y}
            stroke={MEAN_C}
            strokeWidth="1.5"
          />
          <text
            x={xOf(mean)}
            y={PLOT_Y0 - 10}
            textAnchor="middle"
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={MEAN_C}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
            className="tabular-nums"
          >
            mean {mean.toFixed(2)}
          </text>

          {/* Median marker, dropped below the axis so the two labels never
              collide when the distribution is symmetric and they coincide.
              It starts below the tick row so it does not strike through the
              axis numbers, and its label carries a white halo for the same
              reason. */}
          <line
            x1={xOf(median)}
            y1={AXIS_Y + 20}
            x2={xOf(median)}
            y2={AXIS_Y + 30}
            stroke={MEDIAN_C}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={xOf(median)}
            y={AXIS_Y + 42}
            textAnchor="middle"
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={MEDIAN_C}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
            className="tabular-nums"
          >
            median {median.toFixed(2)}
          </text>

          <text
            x={(PLOT_X0 + PLOT_X1) / 2}
            y={H - 6}
            textAnchor="middle"
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-500)"
          >
            x
          </text>
        </svg>
      </div>

      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            {label}
          </p>
          <VizGuide
            steps={[
              "Drag the slider from one end to the other to swing the long tail from left to right.",
              "Stop in the middle for a symmetric distribution.",
              "Watch the red mean and the green median separate as the shape skews.",
              "However far you push it, the mean always ends up past the median, on the long-tail side.",
            ]}
          />
        </div>
        <div className="mt-1 grid grid-cols-2 gap-x-3 text-[12px] text-[color:var(--color-ink-900)]">
          <span style={{ color: MEAN_C }}>
            mean = <span className="font-semibold tabular-nums">{mean.toFixed(3)}</span>
          </span>
          <span style={{ color: MEDIAN_C }}>
            median = <span className="font-semibold tabular-nums">{median.toFixed(3)}</span>
          </span>
        </div>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{caption}</p>
      </div>
    </div>
  );
}
