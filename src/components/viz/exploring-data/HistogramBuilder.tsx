/**
 * Interactive histogram builder for quantitative data (Module 2, WU1).
 *
 * Backs Examples 3A (GMAT scores), 4B (share risk) and the 5C/6C practice
 * datasets from `m2-graphical-summaries`. Students drag a class-width slider
 * and watch the histogram, the class-interval table, and the shape rebuild
 * live. The two width guidelines from the notes — Sturge and GENSTAT — are
 * shown as one-click chips so students can compare "too spikey" against "too
 * blurred", and an optional overlay marks the mean and median to make skewness
 * concrete (mean pulled toward the long tail).
 *
 * Boundary rule matches the notes: a value on a class boundary is counted in
 * the higher class, i.e. class `k` is the half-open interval
 * `[start + k·L, start + (k+1)·L)`.
 *
 * Default tier: hand-rolled SVG; bar heights animate via the shared
 * `useReplayTween` whenever the dataset or width changes.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { useReplayTween } from "../useReplayTween";
import {
  QUANTITATIVE_DATASETS,
  MBA_GMAT,
  type QuantitativeDataset,
} from "../data/exploringData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const MEAN_C = "rgb(220, 38, 38)"; // red-600
const MEDIAN_C = "rgb(5, 150, 105)"; // emerald-600

// SVG plot geometry (viewBox units).
const W = 440;
const H = 300;
const M = { top: 12, right: 12, bottom: 36, left: 36 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

/** Round a value to the nearest slider step and clamp into [min, max]. */
function snap(v: number, min: number, max: number, step: number): number {
  const snapped = Math.round(v / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/** Median of a numeric array (average of the two middle values when even). */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Format a class-interval label, trimming trailing zeros on decimals. */
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, ""));

/**
 * @param params.dataset — initial dataset id ("gmat" | "risk" | "exam" | "trees"); defaults to "gmat".
 */
export default function HistogramBuilder({ params }: { params: VizParams }) {
  const initialId =
    typeof params.dataset === "string" && QUANTITATIVE_DATASETS[params.dataset]
      ? params.dataset
      : MBA_GMAT.id;
  const [datasetId, setDatasetId] = useState(initialId);
  const dataset: QuantitativeDataset = QUANTITATIVE_DATASETS[datasetId];

  const [width, setWidth] = useState(dataset.width.default);
  const [showStats, setShowStats] = useState(false);

  /** Switch dataset and reset the width to that dataset's sensible default. */
  function pickDataset(id: string) {
    setDatasetId(id);
    setWidth(QUANTITATIVE_DATASETS[id].width.default);
  }

  const values = dataset.values;
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Width guidelines from the notes.
  const sturge = range / (1 + 1.44 * Math.log(n));
  const genstat = range / Math.sqrt(n);

  // Lower boundary aligned to the chosen width (start ≤ min).
  const start = Math.floor(min / width) * width;
  const nBins = Math.floor((max - start) / width) + 1;
  const freqs = new Array<number>(nBins).fill(0);
  for (const v of values) {
    const k = Math.min(nBins - 1, Math.floor((v - start) / width));
    freqs[k]++;
  }
  const maxFreq = Math.max(...freqs);

  const mean = values.reduce((s, v) => s + v, 0) / n;
  const med = median(values);

  const progress = useReplayTween([datasetId, width]);

  // Scales.
  const domainHi = start + nBins * width;
  const xOf = (v: number) => M.left + ((v - start) / (domainHi - start)) * PLOT_W;
  const yOf = (f: number) => M.top + PLOT_H - (f / maxFreq) * PLOT_H;
  // Label every boundary, but thin them out when there are many classes.
  const labelEvery = nBins > 9 ? 2 : 1;

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Dataset selector */}
      <div className="flex flex-wrap gap-1.5">
        {Object.values(QUANTITATIVE_DATASETS).map((d) => (
          <button
            key={d.id}
            onClick={() => pickDataset(d.id)}
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

      {/* Width slider + guideline chips */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[color:var(--color-ink-700)] whitespace-nowrap">
            Class width <span className="font-semibold tabular-nums">L = {fmt(width)}</span>
          </span>
          <input
            type="range"
            min={dataset.width.min}
            max={dataset.width.max}
            step={dataset.width.step}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="flex-1 accent-blue-600"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] uppercase tracking-wide text-[color:var(--color-ink-500)]">
            Suggested:
          </span>
          <button
            onClick={() => setWidth(snap(sturge, dataset.width.min, dataset.width.max, dataset.width.step))}
            className="px-2 py-0.5 rounded-md text-[11px] border border-[color:var(--color-line)] bg-white hover:border-blue-400"
          >
            Sturge ≈ {sturge.toFixed(1)}
          </button>
          <button
            onClick={() => setWidth(snap(genstat, dataset.width.min, dataset.width.max, dataset.width.step))}
            className="px-2 py-0.5 rounded-md text-[11px] border border-[color:var(--color-line)] bg-white hover:border-blue-400"
          >
            GENSTAT ≈ {genstat.toFixed(1)}
          </button>
          <label className="ml-auto flex items-center gap-1.5 text-[11px] text-[color:var(--color-ink-700)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showStats}
              onChange={(e) => setShowStats(e.target.checked)}
              className="accent-blue-600"
            />
            Mean &amp; median
          </label>
        </div>
      </div>

      {/* Histogram */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[300px]" role="img">
          {/* y-axis ticks + gridlines */}
          {Array.from({ length: maxFreq + 1 }, (_, f) => f)
            .filter((f) => maxFreq <= 10 || f % Math.ceil(maxFreq / 8) === 0)
            .map((f) => (
              <g key={f}>
                <line x1={M.left} y1={yOf(f)} x2={W - M.right} y2={yOf(f)} stroke="var(--color-line)" strokeWidth="0.5" />
                <text x={M.left - 5} y={yOf(f)} textAnchor="end" dominantBaseline="central" fontSize="9.5" fill="var(--color-ink-500)" className="tabular-nums">
                  {f}
                </text>
              </g>
            ))}

          {/* Bars */}
          {freqs.map((f, k) => {
            const x0 = xOf(start + k * width);
            const x1 = xOf(start + (k + 1) * width);
            const barW = x1 - x0;
            const h = (f / maxFreq) * PLOT_H * progress;
            return (
              <rect
                key={k}
                x={x0 + 0.5}
                y={M.top + PLOT_H - h}
                width={Math.max(0, barW - 1)}
                height={h}
                fill={ACCENT}
                fillOpacity={0.82}
                stroke="white"
                strokeWidth="1"
              />
            );
          })}

          {/* x-axis line + boundary labels */}
          <line x1={M.left} y1={M.top + PLOT_H} x2={W - M.right} y2={M.top + PLOT_H} stroke="var(--color-ink-900)" strokeWidth="1" />
          {Array.from({ length: nBins + 1 }, (_, k) => k)
            .filter((k) => k % labelEvery === 0)
            .map((k) => {
              const bx = start + k * width;
              return (
                <text key={k} x={xOf(bx)} y={M.top + PLOT_H + 13} textAnchor="middle" fontSize="9.5" fill="var(--color-ink-500)" className="tabular-nums">
                  {fmt(bx)}
                </text>
              );
            })}
          <text x={M.left + PLOT_W / 2} y={H - 2} textAnchor="middle" fontSize="10" fill="var(--color-ink-700)">
            {dataset.unit}
          </text>

          {/* Optional mean & median overlay */}
          {showStats && (
            <g>
              <line x1={xOf(mean)} y1={M.top} x2={xOf(mean)} y2={M.top + PLOT_H} stroke={MEAN_C} strokeWidth="1.5" />
              <line x1={xOf(med)} y1={M.top} x2={xOf(med)} y2={M.top + PLOT_H} stroke={MEDIAN_C} strokeWidth="1.5" strokeDasharray="4 3" />
            </g>
          )}
        </svg>
      </div>

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            {nBins} classes · width {fmt(width)}
          </p>
          <VizGuide
            steps={[
              "Pick a dataset along the top.",
              "Drag the slider to change the class-interval width L.",
              "Tap a 'Suggested' chip to use the Sturge or GENSTAT guideline.",
              "Tick 'Mean & median' to see how a long tail pulls the mean toward it.",
            ]}
          />
        </div>
        <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 text-[12px] text-[color:var(--color-ink-900)]">
          <span>n = <span className="font-semibold tabular-nums">{n}</span></span>
          <span>min = <span className="font-semibold tabular-nums">{fmt(min)}</span></span>
          <span>max = <span className="font-semibold tabular-nums">{fmt(max)}</span></span>
        </div>
        {showStats && (
          <p className="mt-1 text-[12px]">
            <span style={{ color: MEAN_C }} className="font-semibold">mean = {mean.toFixed(1)}</span>
            <span className="text-[color:var(--color-ink-500)]"> · </span>
            <span style={{ color: MEDIAN_C }} className="font-semibold">median = {fmt(med)}</span>
          </p>
        )}
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          {dataset.caption}
        </p>
      </div>
    </div>
  );
}
