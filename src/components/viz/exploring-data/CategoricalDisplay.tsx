/**
 * Pie-chart / bar-graph explorer for qualitative data (Module 2, WU1).
 *
 * Backs Examples 1A (MBA first degrees) and 2C (JSE All-Share Index) from
 * `m2-graphical-summaries`. Students pick a dataset, toggle between a pie chart
 * and a horizontal bar graph, and optionally sort categories by decreasing
 * frequency — the textbook's recommendation for making comparisons easier. A
 * live table beside the chart shows each category's frequency and relative
 * frequency, mirroring the worked frequency-distribution tables in the notes.
 *
 * Default tier: hand-rolled SVG with a single requestAnimationFrame tween that
 * replays whenever the dataset, chart type, or sort order changes (the pie
 * sweeps open; the bars grow). No heavy dependencies.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { useReplayTween } from "../useReplayTween";
import {
  CATEGORICAL_DATASETS,
  CATEGORY_COLORS,
  MBA_FACULTIES,
  type CategoricalDataset,
} from "../data/exploringData";

type ChartType = "pie" | "bar";

/** A category enriched with its stable colour. */
interface Slice {
  name: string;
  value: number;
  color: string;
}

const PIE_VIEW = 260; // square viewBox side for the pie

/** Cartesian point on a circle; angle in degrees, 0° = 3 o'clock, clockwise. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** SVG path for a pie slice (centre wedge) spanning [a0, a1] degrees clockwise. */
function wedge(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

function isChart(v: unknown): v is ChartType {
  return v === "pie" || v === "bar";
}

/**
 * @param params.dataset — initial dataset id ("mba" | "jse-count" | "jse-weight"); defaults to "mba".
 * @param params.chart — initial chart type ("pie" | "bar"); defaults to "pie".
 */
export default function CategoricalDisplay({ params }: { params: VizParams }) {
  const initialId =
    typeof params.dataset === "string" && CATEGORICAL_DATASETS[params.dataset]
      ? params.dataset
      : MBA_FACULTIES.id;
  const [datasetId, setDatasetId] = useState(initialId);
  const [chart, setChart] = useState<ChartType>(
    isChart(params.chart) ? params.chart : "pie",
  );
  const [sorted, setSorted] = useState(false);

  const dataset: CategoricalDataset = CATEGORICAL_DATASETS[datasetId];
  const progress = useReplayTween([datasetId, chart, sorted]);

  // Colour follows the *original* position so a category keeps its colour when
  // the list is re-sorted or the chart type changes.
  const slices: Slice[] = dataset.categories.map((c, i) => ({
    name: c.name,
    value: c.value,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));
  const display = sorted
    ? [...slices].sort((a, b) => b.value - a.value)
    : slices;

  const total = slices.reduce((s, c) => s + c.value, 0);
  const fmtVal = (v: number) =>
    dataset.isPercent ? v.toFixed(2) : String(v);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Dataset selector */}
      <div className="flex flex-wrap gap-1.5">
        {Object.values(CATEGORICAL_DATASETS).map((d) => (
          <button
            key={d.id}
            onClick={() => setDatasetId(d.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              datasetId === d.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Chart-type + sort controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-[color:var(--color-line)] overflow-hidden">
          {(["pie", "bar"] as ChartType[]).map((c) => (
            <button
              key={c}
              onClick={() => setChart(c)}
              className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                chart === c
                  ? "bg-blue-600 text-white"
                  : "bg-white text-[color:var(--color-ink-700)] hover:bg-blue-50"
              }`}
            >
              {c === "pie" ? "Pie chart" : "Bar graph"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-[color:var(--color-ink-700)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sorted}
            onChange={(e) => setSorted(e.target.checked)}
            className="accent-blue-600"
          />
          Sort by frequency
        </label>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {chart === "pie" ? (
          <PieChart slices={display} total={total} progress={progress} />
        ) : (
          <BarGraph
            slices={display}
            valueLabel={dataset.valueLabel}
            progress={progress}
          />
        )}
      </div>

      {/* Frequency / relative-frequency table */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            Frequency distribution
          </p>
          <VizGuide
            steps={[
              "Pick a dataset along the top.",
              "Switch between a pie chart and a bar graph.",
              "Tick 'Sort by frequency' to order categories from largest to smallest — easier to compare.",
              "Read each category's count and relative frequency in the table.",
            ]}
          />
        </div>
        <table className="mt-1 w-full text-[12px] text-[color:var(--color-ink-900)]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wide text-[color:var(--color-ink-500)]">
              <th className="text-left font-medium py-0.5">Category</th>
              <th className="text-right font-medium py-0.5">{dataset.valueLabel}</th>
              <th className="text-right font-medium py-0.5">Rel. freq</th>
            </tr>
          </thead>
          <tbody>
            {display.map((c) => (
              <tr key={c.name}>
                <td className="py-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm"
                      style={{ background: c.color }}
                    />
                    {c.name}
                  </span>
                </td>
                <td className="text-right tabular-nums py-0.5">{fmtVal(c.value)}</td>
                <td className="text-right tabular-nums py-0.5">
                  {(c.value / total).toFixed(2)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-blue-200/70 font-semibold">
              <td className="py-0.5">Total</td>
              <td className="text-right tabular-nums py-0.5">
                {dataset.isPercent ? total.toFixed(2) : total}
              </td>
              <td className="text-right tabular-nums py-0.5">1.00</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          {dataset.caption}
        </p>
      </div>
    </div>
  );
}

/** Animated pie chart: each slice sweeps open clockwise from 3 o'clock. */
function PieChart({
  slices,
  total,
  progress,
}: {
  slices: Slice[];
  total: number;
  progress: number;
}) {
  const c = PIE_VIEW / 2;
  const r = c - 8;
  const sweepLimit = 360 * progress; // degrees revealed so far

  // Each slice's angular span, and its cumulative start angle — computed
  // immutably (no running mutation) so the values are stable across renders.
  const angles = slices.map((s) => (s.value / total) * 360);
  const starts = angles.map((_, i) =>
    angles.slice(0, i).reduce((sum, a) => sum + a, 0),
  );

  return (
    <svg
      viewBox={`0 0 ${PIE_VIEW} ${PIE_VIEW}`}
      className="w-full h-auto max-h-[260px]"
      role="img"
    >
      {slices.map((s, i) => {
        const angle = angles[i];
        const a0 = starts[i];
        const a1 = a0 + angle;
        const drawnEnd = Math.min(a1, sweepLimit);
        if (drawnEnd <= a0) return null; // not yet revealed
        // Label at the slice's mid-angle, once it is wide enough to read.
        const mid = (a0 + a1) / 2;
        const [lx, ly] = polar(c, c, r * 0.62, mid);
        const showLabel = a1 <= sweepLimit && angle >= 22;
        return (
          <g key={s.name}>
            <path d={wedge(c, c, r, a0, drawnEnd)} fill={s.color} stroke="white" strokeWidth="1.5" />
            {showLabel && (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="10.5"
                fontWeight="600"
                fill="white"
              >
                {((s.value / total) * 100).toFixed(0)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Animated horizontal bar graph; bars grow to their final width. */
function BarGraph({
  slices,
  valueLabel,
  progress,
}: {
  slices: Slice[];
  valueLabel: string;
  progress: number;
}) {
  const W = 420;
  const rowH = 30;
  const gap = 8;
  const labelW = 96;
  const valueW = 40;
  const H = slices.length * (rowH + gap) + 8;
  const maxVal = Math.max(...slices.map((s) => s.value));
  const trackW = W - labelW - valueW;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[280px]" role="img">
      {slices.map((s, i) => {
        const y = i * (rowH + gap) + 4;
        const w = (s.value / maxVal) * trackW * progress;
        return (
          <g key={s.name}>
            <text
              x={labelW - 6}
              y={y + rowH / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="11"
              fill="var(--color-ink-700)"
            >
              {s.name}
            </text>
            <rect x={labelW} y={y} width={w} height={rowH} rx={3} fill={s.color} />
            <text
              x={labelW + w + 5}
              y={y + rowH / 2}
              dominantBaseline="central"
              fontSize="11"
              fontWeight="600"
              fill="var(--color-ink-900)"
              className="tabular-nums"
            >
              {Number.isInteger(s.value) ? s.value : s.value.toFixed(1)}
            </text>
          </g>
        );
      })}
      <text x={labelW} y={H - 1} fontSize="9.5" fill="var(--color-ink-500)">
        {valueLabel} →
      </text>
    </svg>
  );
}
