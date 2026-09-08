/**
 * Area-under-the-curve explorer for probability density functions, used by
 * Module 3, WU1 (`m3-pmf-pdf`).
 *
 * The chapter's hardest idea is that for a continuous random variable a
 * probability is an *area*, not a height: "the actual values of f(x) cannot be
 * interpreted as being the probability that X is equal to x". Two things here
 * are built to make that stick:
 *
 *   1. Dragging the handles c and d shades the region between them and reports
 *      its area, so Pr[c ≤ X ≤ d] is something the student sweeps out by hand.
 *   2. Dragging the two handles onto the same point collapses the area to zero,
 *      which is Example 22B(f): the probability of a continuous variable taking
 *      an exact value is zero. The read-out calls this out when it happens.
 *
 * Areas come from each preset's exact antiderivative (`cdf`), not from
 * numerical integration, so the figures match the printed solutions exactly.
 * The curve itself is only sampled for drawing.
 *
 * Default tier: hand-rolled SVG, pointer drags via the shared `useSvgDrag`
 * hook. Nothing animates, so no loop runs.
 */

"use client";

import { useMemo, useRef, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { useSvgDrag, clampN } from "../useDrag";
import { VIZ_TEXT, toNum } from "../shared";
import { PDF_PRESETS } from "../data/distributionData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700

// SVG geometry (viewBox units).
const W = 440;
const H = 288;
const PLOT_X0 = 44;
const PLOT_X1 = 424;
const PLOT_Y0 = 20;
const AXIS_Y = 208;
/** Row below the axis holding the two draggable handles. */
const HANDLE_Y = 244;
/** Sample count for drawing the curve. Enough that a cubic looks smooth. */
const SAMPLES = 240;

/**
 * Drag snap: bring the handles to exactly the same value once they are within
 * this fraction of the domain of each other.
 *
 * The zero-area message must never appear next to a non-zero number, which is
 * what a "close enough" tolerance would produce. So rather than *treating* a
 * thin strip as empty, a drag that lands this close collapses the two handles
 * onto one value, making the width genuinely zero. The lesson the read-out
 * then states (an exact value has probability zero) is literally true of the
 * state on screen, and reaching that state by dragging stays easy.
 */
const SNAP = 0.006;

/**
 * @param params.preset — id of the density to open with, from `PDF_PRESETS`;
 *   defaults to the flat density.
 * @param params.c, params.d — initial positions of the two handles, in data
 *   units. Both default to covering the whole domain.
 */
export default function PdfArea({ params }: { params: VizParams }) {
  const initial =
    PDF_PRESETS.find((p) => p.id === params.preset) ?? PDF_PRESETS[0];

  const [presetId, setPresetId] = useState(initial.id);
  const preset = PDF_PRESETS.find((p) => p.id === presetId) ?? PDF_PRESETS[0];
  const [x0, x1] = preset.domain;

  // Clamped to the preset's own domain: an out-of-range value from MDX would
  // otherwise park a handle off-canvas and print a negative probability.
  const [c, setC] = useState(() =>
    clampN(toNum(params.c, initial.domain[0]), initial.domain[0], initial.domain[1]),
  );
  const [d, setD] = useState(() =>
    clampN(toNum(params.d, initial.domain[1]), initial.domain[0], initial.domain[1]),
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = useSvgDrag(svgRef);
  // Value captured at pointer-down: `useSvgDrag` reports displacement from the
  // drag origin, not an absolute position.
  const dragOrigin = useRef(0);

  /** Tallest value of the density, used to scale the y-axis. */
  const fMax = useMemo(() => {
    let m = 0;
    for (let i = 0; i <= SAMPLES; i++) {
      m = Math.max(m, preset.f(x0 + ((x1 - x0) * i) / SAMPLES));
    }
    return m;
  }, [preset, x0, x1]);

  /** Round the axis top up so the peak of the curve is not flush with it. */
  const yTop = fMax * 1.12;

  const xOf = (v: number) => PLOT_X0 + ((v - x0) / (x1 - x0)) * (PLOT_X1 - PLOT_X0);
  const yOf = (v: number) => AXIS_Y - (v / yTop) * (AXIS_Y - PLOT_Y0);
  /** Converts a horizontal displacement in SVG units back into data units. */
  const toData = (dx: number) => (dx / (PLOT_X1 - PLOT_X0)) * (x1 - x0);

  const fmt = preset.format ?? ((v: number) => v.toFixed(2));

  const loV = Math.min(c, d);
  const hiV = Math.max(c, d);
  const area = preset.cdf(hiV) - preset.cdf(loV);
  /** True only when the strip really has no width, so the area really is 0. */
  const isEmpty = hiV === loV;
  const wholeDomain = loV <= x0 + 1e-9 && hiV >= x1 - 1e-9;

  /** Points along the density, reused for both the outline and the shading. */
  const curve = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const v = x0 + ((x1 - x0) * i) / SAMPLES;
      out.push([xOf(v), yOf(preset.f(v))]);
    }
    return out;
    // `xOf`/`yOf` are pure functions of the preset's domain and `yTop`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, x0, x1, yTop]);

  const curvePath = curve.map(([px, py], i) => `${i ? "L" : "M"} ${px} ${py}`).join(" ");

  /** Closed path over just the selected strip, filled to show the area. */
  const shadePath = useMemo(() => {
    if (isEmpty) return "";
    const seg: string[] = [`M ${xOf(loV)} ${AXIS_Y}`, `L ${xOf(loV)} ${yOf(preset.f(loV))}`];
    for (let i = 0; i <= SAMPLES; i++) {
      const v = loV + ((hiV - loV) * i) / SAMPLES;
      seg.push(`L ${xOf(v)} ${yOf(preset.f(v))}`);
    }
    seg.push(`L ${xOf(hiV)} ${AXIS_Y}`, "Z");
    return seg.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, loV, hiV, isEmpty, yTop, x0, x1]);

  /** Load a preset, resetting both handles to span its whole domain. */
  function loadPreset(id: string) {
    const p = PDF_PRESETS.find((q) => q.id === id);
    if (!p) return;
    setPresetId(id);
    setC(p.domain[0]);
    setD(p.domain[1]);
  }

  /** Starts a drag on one of the two handles, clamped to the density's domain. */
  function dragHandle(
    e: React.PointerEvent,
    current: number,
    other: number,
    set: (v: number) => void,
  ) {
    dragOrigin.current = current;
    startDrag(e, (dx) => {
      const next = clampN(dragOrigin.current + toData(dx), x0, x1);
      // Snap onto the other handle so the zero-width state is exactly reachable.
      set(Math.abs(next - other) < SNAP * (x1 - x0) ? other : next);
    });
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Preset selector */}
      <div className="flex flex-wrap gap-1.5">
        {PDF_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => loadPreset(p.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              presetId === p.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Density curve */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto max-h-[320px] select-none"
        >
          <title>
            Density curve for {preset.label}, with the area between {fmt(loV)} and{" "}
            {fmt(hiV)} shaded, equal to {area.toFixed(4)}
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
                  {v.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* y-axis caption */}
          <text
            x={12}
            y={(PLOT_Y0 + AXIS_Y) / 2}
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
            textAnchor="middle"
            transform={`rotate(-90 12 ${(PLOT_Y0 + AXIS_Y) / 2})`}
          >
            f(x)
          </text>

          {/* Shaded area, then the curve outline on top of it */}
          {shadePath && <path d={shadePath} fill={ACCENT} fillOpacity={0.28} />}
          <path d={curvePath} fill="none" stroke={ACCENT_DARK} strokeWidth="2" />

          {/* Axis */}
          <line
            x1={PLOT_X0}
            y1={AXIS_Y}
            x2={PLOT_X1}
            y2={AXIS_Y}
            stroke="var(--color-ink-900)"
            strokeWidth="1"
          />
          {[x0, (x0 + x1) / 2, x1].map((t) => (
            <text
              key={t}
              x={xOf(t)}
              y={AXIS_Y + 15}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-700)"
              className="tabular-nums"
            >
              {fmt(t)}
            </text>
          ))}

          {/* The two draggable handles */}
          {([
            [c, setC, d, "c"],
            [d, setD, c, "d"],
          ] as const).map(([v, set, other, name]) => (
            <g
              key={name}
              className="cursor-ew-resize"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => dragHandle(e, v, other, set)}
            >
              {/* Invisible wider hit area: the visible pill is small, and the
                  two handles sit on top of each other at zero width. */}
              <rect
                x={xOf(v) - 22}
                y={PLOT_Y0}
                width={44}
                height={HANDLE_Y + 10 - PLOT_Y0}
                fill="transparent"
              />
              <line
                x1={xOf(v)}
                y1={PLOT_Y0}
                x2={xOf(v)}
                y2={HANDLE_Y - 10}
                stroke={ACCENT}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <rect
                x={xOf(v) - 11}
                y={HANDLE_Y - 10}
                width={22}
                height={18}
                rx="5"
                fill={ACCENT}
              />
              <text
                x={xOf(v)}
                y={HANDLE_Y + 3}
                textAnchor="middle"
                fontSize={VIZ_TEXT.caption}
                fontWeight="700"
                fill="white"
              >
                {name}
              </text>
              <text
                x={xOf(v)}
                y={HANDLE_Y + 20}
                textAnchor="middle"
                fontSize={VIZ_TEXT.axisTick}
                fill={ACCENT_DARK}
                className="tabular-nums"
              >
                {fmt(v)}
              </text>
            </g>
          ))}
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
              "Pick a density along the top. Each one comes from a worked example in this unit.",
              "Drag the handles c and d to sweep out a strip under the curve.",
              "The shaded area is Pr[c ≤ X ≤ d]. Height alone is not a probability.",
              "Drag c and d onto the same point: the area collapses to zero.",
              "Spread them across the whole interval and the area is 1, which is condition PDF3.",
            ]}
          />
        </div>
        <p className="mt-1 text-[13px] text-[color:var(--color-ink-900)]">
          Pr[{fmt(loV)} ≤ X ≤ {fmt(hiV)}] ={" "}
          <span className="font-semibold tabular-nums">{area.toFixed(4)}</span>
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          {isEmpty
            ? "The two handles are on the same point, so the strip has no width and the area is zero. For a continuous random variable the probability of any exact value is zero."
            : wholeDomain
              ? "The whole interval is shaded and the area is 1. That is condition PDF3: the total area under a density is always one."
              : `The unshaded part of the curve holds the remaining ${(1 - area).toFixed(4)}.`}
        </p>
      </div>
    </div>
  );
}
