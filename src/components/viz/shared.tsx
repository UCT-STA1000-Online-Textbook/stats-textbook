/**
 * Small primitives shared across the default-tier (SVG) probability and
 * exploring-data visualisations — `ProbabilityVenn`, `BayesGrid`,
 * `IndependenceSquare`, `VennDiagram`, `SetPartition`. These were copy-pasted
 * per file as each viz was built; this module is the single source so a
 * future tweak (e.g. slider styling) doesn't need to be repeated five times.
 *
 * Also home to the two cross-cutting design tokens for visualisations: the
 * shared `CATEGORICAL_PALETTE` (colours for unlabelled groups) and the
 * `VIZ_TEXT` type scale (documented px roles for in-viz labels).
 */

"use client";

import type { ReactNode } from "react";

/**
 * The single categorical colour palette used by every visualisation that
 * distinguishes more than two unlabelled groups (`SetPartition`'s partition
 * strips, `CategoricalDisplay`'s pie/bar charts, and any future one). Kept
 * here — rather than duplicated per component — so two vizzes shown side by
 * side never disagree about what "category 3" looks like. `exploringData.ts`
 * re-exports this as `CATEGORY_COLORS` for its Module-2 dataset consumers;
 * both names point at the same array.
 *
 * Excludes the app's blue accent (reserved for chrome/selection state) and
 * red (reserved for "defective"/"wrong" semantics elsewhere in the app) so a
 * categorical chart never collides visually with those meanings — indices
 * wrap via `%` for palettes longer than this list.
 */
export const CATEGORICAL_PALETTE = [
  "rgb(37, 99, 235)", // blue-600
  "rgb(217, 119, 6)", // amber-600
  "rgb(5, 150, 105)", // emerald-600
  "rgb(220, 38, 38)", // red-600
  "rgb(124, 58, 237)", // violet-600
  "rgb(8, 145, 178)", // cyan-600
  "rgb(190, 24, 93)", // pink-700
] as const;

/**
 * Viz type scale — four font-size roles (px) used across every SVG/canvas
 * visualisation, so labels read consistently instead of drifting through
 * nine near-identical ad-hoc sizes. Apply as a Tailwind arbitrary value
 * (`text-[10px]`) or as an SVG `fontSize` prop (`fontSize={VIZ_TEXT.axisTick}`).
 *
 *   axisTick 10px — chart axis ticks and tiny in-diagram annotations
 *   caption  11px — small uppercase section captions, meta labels
 *   label    12px — general small UI text inside a viz (slider labels, body)
 *   readout  13px — emphasised numeric/formula readouts
 *
 * A handful of hero numbers (e.g. `RandomTrials`'s trial-count tally) sit
 * deliberately outside this scale — they are a distinct, larger display
 * size, not a mislabelled instance of one of these four roles.
 */
export const VIZ_TEXT = {
  axisTick: 10,
  caption: 11,
  label: 12,
  readout: 13,
} as const;

/** Clamp a number into [0, 1] — used to sanitise `VizParams` probabilities. */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Reads a `VizParams` value as a finite number, falling back if absent/invalid. */
export function toNum(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Renders a horizontal bar spanning every character it wraps — used for
 * compound complements like `\overline{A \cup B}`. A Unicode combining macron
 * only attaches to a single preceding character, so a real overline element
 * is needed for multi-character terms.
 */
export function Bar({ children }: { children: ReactNode }) {
  return <span className="overline">{children}</span>;
}

/**
 * Labelled 0–1 range slider, shared styling across the probability vizzes.
 *
 * `mono` controls whether the label uses the monospace font — `ProbabilityVenn`
 * labels its sliders with math notation ("Pr(A ∩ B)") in mono, while
 * `BayesGrid` labels its sliders with plain prose ("made in-house") and never
 * set mono; both are preserved here rather than unified, per the no-restyle
 * rule for this extraction pass.
 */
export function Slider({
  label,
  value,
  onChange,
  mono = true,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <label
          className={`text-[12px] text-[color:var(--color-ink-700)] ${mono ? "font-mono" : ""}`}
        >
          {label}
        </label>
        <span className="text-[12px] font-mono tabular-nums text-[color:var(--color-ink-900)]">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-blue-100 accent-blue-600 cursor-pointer"
      />
    </div>
  );
}

/**
 * Mono readout row pairing a formula/label with a two-decimal value.
 *
 * Two visual variants, matching the two call sites this replaces:
 *  - default: padded pill that can be `highlight`ed (blue background + bold
 *    value) — used by `ProbabilityVenn` and `BayesGrid`-style readouts.
 *  - `compact`: unpadded, always muted — used by `IndependenceSquare`'s
 *    denser readout stack.
 */
export function Row({
  expr,
  value,
  highlight,
  compact,
}: {
  expr: ReactNode;
  value: number;
  highlight?: boolean;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex justify-between gap-2 px-3 text-[color:var(--color-ink-500)]">
        <span>{expr}</span>
        <span className="tabular-nums">{value.toFixed(2)}</span>
      </div>
    );
  }
  return (
    <div
      className={`flex justify-between gap-2 px-3 py-1.5 rounded-md ${
        highlight
          ? "bg-blue-50/70 border border-blue-200/70"
          : "text-[color:var(--color-ink-500)]"
      }`}
    >
      <span className={highlight ? "text-[color:var(--color-ink-700)]" : ""}>
        {expr}
      </span>
      <span
        className={`tabular-nums ${
          highlight ? "font-semibold text-blue-700" : ""
        }`}
      >
        {value.toFixed(2)}
      </span>
    </div>
  );
}

/**
 * The sample-space rectangle every set/probability diagram draws first — a
 * pale rounded box with an optional italic "S" label in a corner. Geometry
 * (position, size, corner radius, label placement) varies per diagram, so
 * every value is a prop; nothing here is hard-coded to one viz's layout.
 */
export function SampleSpaceFrame({
  x,
  y,
  width,
  height,
  rx = 0,
  label,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner radius; 0 (square corners) if omitted. */
  rx?: number;
  /** Position and size of the "S" label; omit to draw the frame with no label. */
  label?: { x: number; y: number; fontSize?: number };
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill="rgb(248, 250, 252)"
        stroke="rgb(15, 23, 42)"
        strokeWidth="1.5"
      />
      {label && (
        <text
          x={label.x}
          y={label.y}
          textAnchor="end"
          fontSize={label.fontSize ?? 13}
          fontStyle="italic"
          fontWeight="600"
          fill="rgb(71, 85, 105)"
        >
          S
        </text>
      )}
    </>
  );
}
