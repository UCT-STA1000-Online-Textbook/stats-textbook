/**
 * Mean-versus-median balance beam for Module 2, WU2 (`m2-summary-measures`).
 *
 * Makes two claims from the notes physical:
 *
 *   1. INTROSTAT describes the mean as the point where a weightless ruler
 *      carrying an equal mass at each observation balances. Here that ruler is
 *      real: the student drags the fulcrum, and the beam tilts under the net
 *      torque until the fulcrum sits exactly at the mean.
 *   2. The mean is *not robust*. Dragging one observation off to the right
 *      pulls the mean after it while the median barely stirs — the lesson of
 *      Examples 21A and 22A, where a handful of huge trades leave the mean ten
 *      times above the middle of the data.
 *
 * Both the observations and the fulcrum are draggable. Torque is computed in
 * data units as Σ(xᵢ − fulcrum), which is zero precisely at the mean, so
 * "level beam" and "fulcrum on the mean" are the same state by construction
 * rather than by a tolerance test.
 *
 * Default tier: hand-rolled SVG driven by pointer drags through the shared
 * `useSvgDrag` hook; no animation loop runs while the student is not dragging.
 */

"use client";

import { useMemo, useRef, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { useSvgDrag, clampN } from "../useDrag";
import { BALANCE_PRESETS } from "../data/summaryData";
import { fmtStat, mean as meanOf, quartileInc } from "../data/summaryStats";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const MEAN_C = "rgb(220, 38, 38)"; // red-600 — matches HistogramBuilder's mean overlay
const MEDIAN_C = "rgb(5, 150, 105)"; // emerald-600 — matches HistogramBuilder's median

// SVG geometry (viewBox units). The gap above the beam is headroom for
// weights that share a value and therefore stack vertically; at 150 units it
// holds eight before the topmost would clip.
const W = 440;
const H = 265;
const AXIS_X0 = 40;
const AXIS_X1 = 410;
const AXIS_Y = 225;
const BEAM_Y = 150;
const WEIGHT_R = 8;
/** Base of the fulcrum triangle, measured down from the beam. */
const FULCRUM_H = 30;

/** Data domain — every preset is scaled to this axis so one scale serves all. */
const DOMAIN = { lo: 0, hi: 100 };

/** Largest beam tilt, in degrees, at maximum net torque. */
const MAX_TILT = 11;

/**
 * @param params.preset — initial preset id ("symmetric" | "skewed" |
 *   "outlier"); defaults to "symmetric".
 */
export default function MeanMedianBalance({ params }: { params: VizParams }) {
  const initialPreset =
    BALANCE_PRESETS.find((p) => p.id === params.preset) ?? BALANCE_PRESETS[0];

  const [presetId, setPresetId] = useState(initialPreset.id);
  const [values, setValues] = useState<number[]>([...initialPreset.values]);
  const [fulcrum, setFulcrum] = useState(() => meanOf(initialPreset.values));
  // The preset's caption describes its *starting* shape, so it stops being
  // true the moment a weight moves. Tracked rather than derived by comparing
  // arrays, since dragging a weight away and back should still count as edited.
  const [edited, setEdited] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = useSvgDrag(svgRef);
  // Value captured at pointer-down, since `useSvgDrag` reports displacement
  // from the drag origin rather than an absolute position.
  const dragOrigin = useRef(0);

  const preset = BALANCE_PRESETS.find((p) => p.id === presetId) ?? BALANCE_PRESETS[0];

  const mean = meanOf(values);
  const median = quartileInc(values, 0.5);
  const n = values.length;

  const xOf = (v: number) => AXIS_X0 + ((v - DOMAIN.lo) / (DOMAIN.hi - DOMAIN.lo)) * (AXIS_X1 - AXIS_X0);
  /** Converts a horizontal displacement in SVG units back into data units. */
  const toData = (dx: number) => (dx / (AXIS_X1 - AXIS_X0)) * (DOMAIN.hi - DOMAIN.lo);

  /**
   * Net torque about the fulcrum, normalised to [-1, 1].
   *
   * Σ(xᵢ − f) is divided by its largest possible magnitude (every observation
   * pinned at the far end of the axis), so the tilt reads as a fraction of
   * "maximally unbalanced" and stays comparable across presets.
   */
  const tilt = useMemo(() => {
    const torque = values.reduce((sum, v) => sum + (v - fulcrum), 0);
    const worst = n * Math.max(fulcrum - DOMAIN.lo, DOMAIN.hi - fulcrum);
    const normalised = worst === 0 ? 0 : torque / worst;
    return clampN(normalised, -1, 1) * MAX_TILT;
  }, [values, fulcrum, n]);

  const balanced = Math.abs(mean - fulcrum) < 0.05;

  /** Load a preset, resetting both the observations and the fulcrum. */
  function loadPreset(id: string) {
    const p = BALANCE_PRESETS.find((q) => q.id === id);
    if (!p) return;
    setPresetId(id);
    setValues([...p.values]);
    setFulcrum(meanOf(p.values));
    setEdited(false);
  }

  /** Stack indices so observations sharing a value don't draw on top of each other. */
  const stackIndex = useMemo(() => {
    const seen = new Map<number, number>();
    return values.map((v) => {
      const key = Math.round(v);
      const k = seen.get(key) ?? 0;
      seen.set(key, k + 1);
      return k;
    });
  }, [values]);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Preset selector */}
      <div className="flex flex-wrap gap-1.5">
        {BALANCE_PRESETS.map((p) => (
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
        <button
          onClick={() => setFulcrum(mean)}
          disabled={balanced}
          className="ml-auto px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-700)] transition-colors hover:border-blue-400 disabled:opacity-40 disabled:hover:border-[color:var(--color-line)]"
        >
          Balance it
        </button>
      </div>

      {/* Beam */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto max-h-[300px] select-none"
        >
          {/* No `role="img"`: that would mark the whole subtree presentational
              and hide the draggable weights and fulcrum from assistive tech.
              The other drag-based viz in this repo omit it for the same reason. */}
          <title>
            A balance beam carrying {n} equal weights, with the fulcrum at{" "}
            {fmtStat(fulcrum)} and the mean at {fmtStat(mean)}
          </title>

          {/* Beam and its weights rotate together about the fulcrum */}
          <g transform={`rotate(${tilt} ${xOf(fulcrum)} ${BEAM_Y})`}>
            <line
              x1={AXIS_X0}
              y1={BEAM_Y}
              x2={AXIS_X1}
              y2={BEAM_Y}
              stroke="var(--color-ink-700)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {values.map((v, i) => (
              <circle
                key={i}
                cx={xOf(v)}
                cy={BEAM_Y - WEIGHT_R - 2 - stackIndex[i] * (WEIGHT_R * 2 + 1)}
                r={WEIGHT_R}
                fill={ACCENT}
                fillOpacity={0.85}
                stroke={ACCENT_DARK}
                strokeWidth="1.5"
                className="cursor-grab active:cursor-grabbing"
                style={{ touchAction: "none" }}
                onPointerDown={(e) => {
                  dragOrigin.current = values[i];
                  setEdited(true);
                  startDrag(e, (dx) => {
                    const next = clampN(
                      Math.round(dragOrigin.current + toData(dx)),
                      DOMAIN.lo,
                      DOMAIN.hi,
                    );
                    setValues((prev) => prev.map((old, j) => (j === i ? next : old)));
                  });
                }}
              />
            ))}
          </g>

          {/* Fulcrum — drawn upright regardless of tilt, since it is the pivot */}
          <g
            className="cursor-ew-resize"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              dragOrigin.current = fulcrum;
              startDrag(e, (dx) => {
                setFulcrum(clampN(dragOrigin.current + toData(dx), DOMAIN.lo, DOMAIN.hi));
              });
            }}
          >
            {/* Invisible wider hit area — the visible triangle is small. */}
            <rect
              x={xOf(fulcrum) - 16}
              y={BEAM_Y}
              width={32}
              height={AXIS_Y - BEAM_Y}
              fill="transparent"
            />
            <path
              d={`M ${xOf(fulcrum)} ${BEAM_Y + 3} L ${xOf(fulcrum) + 13} ${BEAM_Y + FULCRUM_H} L ${xOf(fulcrum) - 13} ${BEAM_Y + FULCRUM_H} Z`}
              fill={balanced ? MEAN_C : "var(--color-ink-400)"}
            />
          </g>

          {/* Mean and median markers, on the axis below.
              The mean's label sits in the clear band between the base of the
              fulcrum and the axis — at the mean the fulcrum is directly on top
              of it, so a label drawn at the triangle's own height would be
              unreadable in precisely the state the viz is trying to reward. */}
          {/* `pointerEvents: none` on the mean marker: it is painted after the
              fulcrum and sits directly over it whenever the beam is balanced,
              where it would otherwise swallow the pointer-down that starts a
              fulcrum drag — exactly the state a student drags away from. */}
          <line
            x1={xOf(mean)}
            y1={BEAM_Y + FULCRUM_H + 2}
            x2={xOf(mean)}
            y2={AXIS_Y}
            stroke={MEAN_C}
            strokeWidth="1.5"
            style={{ pointerEvents: "none" }}
          />
          {/* White halo (stroke painted under the fill) so the label stays
              readable where the mean's own vertical line runs behind it. */}
          <text
            x={xOf(mean)}
            y={AXIS_Y - 6}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill={MEAN_C}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
            style={{ pointerEvents: "none" }}
            className="tabular-nums"
          >
            x&#772; = {mean.toFixed(1)}
          </text>

          <line
            x1={xOf(median)}
            y1={AXIS_Y}
            x2={xOf(median)}
            y2={AXIS_Y + 20}
            stroke={MEDIAN_C}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={xOf(median)}
            y={AXIS_Y + 31}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill={MEDIAN_C}
            className="tabular-nums"
          >
            median = {fmtStat(median)}
          </text>

          {/* Axis */}
          <line
            x1={AXIS_X0}
            y1={AXIS_Y}
            x2={AXIS_X1}
            y2={AXIS_Y}
            stroke="var(--color-ink-900)"
            strokeWidth="1"
          />
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={xOf(t)} y1={AXIS_Y} x2={xOf(t)} y2={AXIS_Y + 4} stroke="var(--color-ink-400)" strokeWidth="1" />
              <text x={xOf(t)} y={AXIS_Y + 14} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)" className="tabular-nums">
                {t}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            {balanced ? "Balanced: the fulcrum is at the mean" : "Tilting: drag the fulcrum to the mean"}
          </p>
          <VizGuide
            steps={[
              "Drag any blue weight along the beam to change the data.",
              "Drag the grey triangle (the fulcrum) until the beam sits level.",
              "It only balances when the fulcrum is exactly at the mean x̄.",
              "Load 'One outlier' and drag the lone point right: the mean follows it, the median hardly moves.",
              "Press 'Balance it' to snap the fulcrum back to the mean.",
            ]}
          />
        </div>
        <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 text-[12px] text-[color:var(--color-ink-900)]">
          <span>
            n = <span className="font-semibold tabular-nums">{n}</span>
          </span>
          <span style={{ color: MEAN_C }}>
            x&#772; = <span className="font-semibold tabular-nums">{mean.toFixed(2)}</span>
          </span>
          <span style={{ color: MEDIAN_C }}>
            median = <span className="font-semibold tabular-nums">{fmtStat(median)}</span>
          </span>
        </div>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          {Math.abs(mean - median) < 0.5
            ? "Mean and median agree: this batch is close to symmetric."
            : `The mean sits ${fmtStat(Math.abs(mean - median), 1)} ${mean > median ? "above" : "below"} the median, so the data is skewed to the ${mean > median ? "right" : "left"}.`}
        </p>
        {!edited && (
          <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{preset.caption}</p>
        )}
      </div>
    </div>
  );
}
