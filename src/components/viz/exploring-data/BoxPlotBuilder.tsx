/**
 * Box-and-whisker plot builder for Module 2, WU2 (`m2-summary-measures`).
 *
 * Backs Examples 13A–20C and 25B: it turns a batch into its five-number
 * summary and draws the box, whiskers, and — when the flagging rule is on —
 * the outliers and strays that INTROSTAT asks students to label. Selecting the
 * GMAT dataset draws all six faculties side by side on one shared scale, which
 * is the comparison Example 17B is really about.
 *
 * Two ideas the plot is built to make visible:
 *
 *   1. With flagging on, whiskers stop at the *fences* (the outermost values
 *      that are not strays), not the extremes. That is what isolates the
 *      flagged points instead of burying them at the end of a long whisker.
 *   2. The optional mean marker sits away from the median whenever the batch
 *      is skew — the same lesson `MeanMedianBalance` lets students drag.
 *
 * Quartiles come from `summaryStats`, i.e. Excel's `QUARTILE.INC`, so every
 * number here matches what a student gets in a spreadsheet rather than the
 * half-rank arithmetic printed in the book.
 *
 * Default tier: hand-rolled SVG; box geometry grows from the median via the
 * shared `useReplayTween` when the dataset or options change.
 */

"use client";

import { useMemo, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { useReplayTween } from "../useReplayTween";
import { SUMMARY_DATASETS, FOOTBALL_POINTS, type SummaryGroup } from "../data/summaryData";
import {
  classifyPoints,
  classifyValue,
  fiveNumberSummary,
  fmtStat,
  interquartileRange,
  mean as meanOf,
  range as rangeOf,
  sampleSd,
  type FiveNumberSummary,
  type OutlierReport,
  type PointClass,
} from "../data/summaryStats";

// Semantic colours. Boxes stay on the app's blue accent; flagged points use a
// red severity ramp (light = stray, full = outlier) rather than an orange,
// which the project's palette reserves against. The mean is a neutral dark
// marker so it never reads as "flagged" — the same treatment RandomTrials
// gives its theoretical-value line.
const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const STRAY_C = "rgb(248, 113, 113)"; // red-400
const OUTLIER_C = "rgb(220, 38, 38)"; // red-600
const MEAN_C = "rgb(42, 49, 71)"; // --color-ink-700

// SVG plot geometry (viewBox units).
const W = 440;
const H = 300;
const M = { top: 14, right: 14, bottom: 30, left: 46 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

/** Everything the plot and the readout need about one group. */
interface GroupStats {
  name: string;
  n: number;
  five: FiveNumberSummary;
  mean: number;
  sd: number;
  range: number;
  iqr: number;
  report: OutlierReport;
  /** Flagged observations, de-duplicated for labelling. */
  flagged: { value: number; cls: PointClass; tags: string[] }[];
}

/**
 * Chooses ~6 round tick values covering [lo, hi].
 *
 * Picks a step from the 1/2/5 × 10ⁿ ladder so ticks land on human numbers
 * (0, 25, 50 …) instead of the raw data range divided by six.
 */
function axisTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const rawStep = span / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const nice = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  const step = nice * magnitude;
  const first = Math.ceil(lo / step) * step;

  const ticks: number[] = [];
  // Guard against a pathological step producing an unbounded loop; 40 ticks is
  // far more than the axis can ever show.
  for (let t = first, i = 0; t <= hi + step * 1e-9 && i < 40; t += step, i++) {
    ticks.push(Number(t.toPrecision(12)));
  }
  return ticks;
}

/**
 * Assigns each label a y position that clears its neighbours and stays inside
 * the plot band.
 *
 * Flagged values often bunch together — Example 18A has five strays between 2
 * and 18 hours on an axis running to 154 — so drawing every label at its own
 * data position renders them on top of one another. A downward pass separates
 * them by `minGap`; because that pass only ever pushes *down*, a cluster near
 * the foot of the axis would otherwise walk off the bottom of the plot, so a
 * second pass lifts the overflow back up and re-separates upward. A leader
 * line is drawn wherever a label ends up displaced from its point.
 *
 * @param ys — label anchor positions in SVG units, in ascending (top-down) order.
 * @param minGap — smallest vertical distance allowed between two labels.
 * @param bounds — the plot band labels must stay within.
 */
function spreadLabels(
  ys: number[],
  minGap: number,
  bounds: { top: number; bottom: number },
): number[] {
  const out: number[] = [];
  for (const y of ys) {
    const previous = out.length > 0 ? out[out.length - 1] : -Infinity;
    out.push(Math.max(y, previous + minGap));
  }

  // Pull the stack back inside the plot if the downward pass overshot. Only
  // possible when the labels genuinely don't fit, so clamping the top edge
  // afterwards is a last resort rather than the normal path.
  const overflow = out.length > 0 ? out[out.length - 1] - bounds.bottom : 0;
  if (overflow > 0) {
    for (let i = out.length - 1; i >= 0; i--) {
      const next = i < out.length - 1 ? out[i + 1] : Infinity;
      out[i] = Math.max(bounds.top, Math.min(out[i] - overflow, next - minGap));
    }
  }
  return out;
}

/** Collapses a group's values into the statistics the plot draws. */
function statsFor(group: SummaryGroup): GroupStats {
  const { name, values, tags } = group;
  const report = classifyPoints(values);

  // Group identical flagged values so a repeated observation is drawn (and
  // labelled) once, carrying every tag that produced it.
  const byValue = new Map<number, string[]>();
  values.forEach((v, i) => {
    if (classifyValue(v, report.bounds) === "normal") return;
    const list = byValue.get(v) ?? [];
    if (tags?.[i]) list.push(tags[i]);
    byValue.set(v, list);
  });

  const flagged = [...byValue.entries()]
    .map(([value, valueTags]) => ({
      value,
      cls: classifyValue(value, report.bounds),
      tags: valueTags,
    }))
    .sort((a, b) => a.value - b.value);

  return {
    name,
    n: values.length,
    five: fiveNumberSummary(values),
    mean: meanOf(values),
    sd: sampleSd(values),
    range: rangeOf(values),
    iqr: interquartileRange(values),
    report,
    flagged,
  };
}

/**
 * @param params.dataset — initial dataset id ("football" | "gmat-faculty" |
 *   "usage" | "wheat" | "rain" | "yields" | "volume"); defaults to "football".
 * @param params.flag — "off" starts with outlier/stray flagging disabled;
 *   defaults to on.
 */
export default function BoxPlotBuilder({ params }: { params: VizParams }) {
  const initialId =
    typeof params.dataset === "string" && SUMMARY_DATASETS[params.dataset]
      ? params.dataset
      : FOOTBALL_POINTS.id;

  const [datasetId, setDatasetId] = useState(initialId);
  const [flagOutliers, setFlagOutliers] = useState(params.flag !== "off");
  const [showMean, setShowMean] = useState(false);

  const dataset = SUMMARY_DATASETS[datasetId];
  const groups = useMemo(() => dataset.groups.map(statsFor), [dataset]);

  // Axis must cover every observation, flagged or not — a flagged point drawn
  // outside the domain would be clipped by the plot area.
  const { lo, hi } = useMemo(() => {
    const all = dataset.groups.flatMap((g) => g.values);
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.08 || 1;
    return { lo: min - pad, hi: max + pad };
  }, [dataset]);

  const progress = useReplayTween([datasetId, flagOutliers, showMean]);

  const yOf = (v: number) => M.top + PLOT_H - ((v - lo) / (hi - lo)) * PLOT_H;
  /**
   * `yOf` clamped to the plot band. The axis domain covers the observations,
   * but x̄ ± s can reach past them on a very spread batch (the wheat data, with
   * its mis-keyed 83, has s larger than the axis padding), so the mean marker
   * is clamped where the box and whiskers — always inside the domain — are not.
   */
  const yClamped = (v: number) => Math.max(M.top, Math.min(M.top + PLOT_H, yOf(v)));
  const ticks = useMemo(() => axisTicks(lo, hi), [lo, hi]);

  // Lay the boxes out evenly across the plot. Boxes narrow as groups multiply
  // but never exceed 56 units, which keeps a single-group plot from rendering
  // as one absurdly wide slab.
  const slot = PLOT_W / groups.length;
  const boxW = Math.min(56, slot * 0.42);
  const centreOf = (i: number) => M.left + slot * (i + 0.5);

  const isSingle = groups.length === 1;

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Dataset selector */}
      <div className="flex flex-wrap gap-1.5">
        {Object.values(SUMMARY_DATASETS).map((d) => (
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

      {/* Options */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <label className="flex items-center gap-1.5 text-[11px] text-[color:var(--color-ink-700)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={flagOutliers}
            onChange={(e) => setFlagOutliers(e.target.checked)}
            className="accent-blue-600"
          />
          Flag outliers &amp; strays
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-[color:var(--color-ink-700)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showMean}
            onChange={(e) => setShowMean(e.target.checked)}
            className="accent-blue-600"
          />
          Mean &plusmn; s
        </label>
        <VizGuide
          steps={[
            "Pick a batch of data along the top.",
            "The box spans the lower to upper quartile, with a line at the median.",
            "Tick 'Flag outliers & strays' to stop the whiskers at the fences and draw the flagged values as dots.",
            "Tick 'Mean ± s' to compare the mean against the median; they separate when the data is skew.",
            "Choose 'GMAT by faculty' to compare six batches on one scale.",
          ]}
        />
      </div>

      {/* Plot */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {/* Taller cap than the histogram's: a box plot's whole message is
            vertical, so it earns the extra height in the panel. */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[380px]" role="img">
          <title>
            Box-and-whisker plot of {dataset.label} measured in {dataset.unit}
          </title>

          {/* y-axis gridlines + ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                y1={yOf(t)}
                x2={W - M.right}
                y2={yOf(t)}
                stroke="var(--color-line)"
                strokeWidth="0.5"
              />
              <text
                x={M.left - 6}
                y={yOf(t)}
                textAnchor="end"
                dominantBaseline="central"
                fontSize="10"
                fill="var(--color-ink-500)"
                className="tabular-nums"
              >
                {fmtStat(t)}
              </text>
            </g>
          ))}

          {/* Axis line + unit label */}
          <line
            x1={M.left}
            y1={M.top}
            x2={M.left}
            y2={M.top + PLOT_H}
            stroke="var(--color-ink-900)"
            strokeWidth="1"
          />
          <text
            x={10}
            y={M.top + PLOT_H / 2}
            textAnchor="middle"
            fontSize="10"
            fill="var(--color-ink-700)"
            transform={`rotate(-90 10 ${M.top + PLOT_H / 2})`}
          >
            {dataset.unit}
          </text>

          {groups.map((g, i) => {
            const cx = centreOf(i);
            const { q1, median, q3, min, max } = g.five;

            // Whiskers reach the fences only while flagging is on; otherwise
            // they run all the way to the extremes and nothing is singled out.
            const whiskerLo = flagOutliers ? g.report.fences.lo : min;
            const whiskerHi = flagOutliers ? g.report.fences.hi : max;

            // Grow the box and whiskers out from the median as the tween runs.
            const at = (v: number) => yOf(median + (v - median) * progress);

            return (
              <g key={g.name}>
                {/* Whiskers + caps */}
                <line x1={cx} y1={at(q3)} x2={cx} y2={at(whiskerHi)} stroke={ACCENT_DARK} strokeWidth="1" />
                <line x1={cx} y1={at(q1)} x2={cx} y2={at(whiskerLo)} stroke={ACCENT_DARK} strokeWidth="1" />
                <line x1={cx - boxW / 4} y1={at(whiskerHi)} x2={cx + boxW / 4} y2={at(whiskerHi)} stroke={ACCENT_DARK} strokeWidth="1.5" />
                <line x1={cx - boxW / 4} y1={at(whiskerLo)} x2={cx + boxW / 4} y2={at(whiskerLo)} stroke={ACCENT_DARK} strokeWidth="1.5" />

                {/* Box (quartile to quartile) */}
                <rect
                  x={cx - boxW / 2}
                  y={at(q3)}
                  width={boxW}
                  height={Math.max(0, at(q1) - at(q3))}
                  fill={ACCENT}
                  fillOpacity={0.16}
                  stroke={ACCENT}
                  strokeWidth="1.5"
                />

                {/* Median */}
                <line
                  x1={cx - boxW / 2}
                  y1={yOf(median)}
                  x2={cx + boxW / 2}
                  y2={yOf(median)}
                  stroke={ACCENT_DARK}
                  strokeWidth="2.5"
                />

                {/* Mean ± s, offset to the right so it never overlaps the box */}
                {showMean && Number.isFinite(g.sd) && (
                  <g opacity={progress}>
                    <line
                      x1={cx + boxW / 2 + 7}
                      y1={yClamped(g.mean - g.sd)}
                      x2={cx + boxW / 2 + 7}
                      y2={yClamped(g.mean + g.sd)}
                      stroke={MEAN_C}
                      strokeWidth="1"
                      strokeDasharray="3 2"
                    />
                    <path
                      d={`M ${cx + boxW / 2 + 7} ${yClamped(g.mean) - 4} L ${cx + boxW / 2 + 11} ${yClamped(g.mean)} L ${cx + boxW / 2 + 7} ${yClamped(g.mean) + 4} L ${cx + boxW / 2 + 3} ${yClamped(g.mean)} Z`}
                      fill={MEAN_C}
                    />
                  </g>
                )}

                {/* Flagged observations */}
                {flagOutliers &&
                  (() => {
                    // Highest value first, so label positions are laid out top-down.
                    const ordered = [...g.flagged].sort((a, b) => b.value - a.value);
                    const labelYs = spreadLabels(
                      ordered.map((f) => yOf(f.value)),
                      11,
                      { top: M.top, bottom: M.top + PLOT_H },
                    );

                    return ordered.map((f, k) => {
                      const py = yOf(f.value);
                      const ly = labelYs[k];
                      return (
                        <g key={f.value} opacity={progress}>
                          {/* Leader line, drawn only when the label had to move. */}
                          {isSingle && Math.abs(ly - py) > 1 && (
                            <line
                              x1={cx + 4}
                              y1={py}
                              x2={cx + 7}
                              y2={ly}
                              stroke="var(--color-ink-300)"
                              strokeWidth="0.75"
                            />
                          )}
                          <circle
                            cx={cx}
                            cy={py}
                            r={f.cls === "outlier" ? 3.6 : 3}
                            fill={f.cls === "outlier" ? OUTLIER_C : "white"}
                            stroke={f.cls === "outlier" ? OUTLIER_C : STRAY_C}
                            strokeWidth="1.5"
                          />
                          {/* Only the single-batch plots have room for labels. */}
                          {isSingle && (
                            <text
                              x={cx + 8}
                              y={ly}
                              dominantBaseline="central"
                              fontSize="10"
                              fontWeight={f.cls === "outlier" ? 700 : 400}
                              fill={f.cls === "outlier" ? OUTLIER_C : "var(--color-ink-500)"}
                              className="tabular-nums"
                            >
                              {f.tags.length > 0
                                ? `${f.tags.join(", ")} (${fmtStat(f.value)})`
                                : fmtStat(f.value)}
                            </text>
                          )}
                        </g>
                      );
                    });
                  })()}

                {/* Group label (only meaningful when comparing batches) */}
                {!isSingle && (
                  <text
                    x={cx}
                    y={M.top + PLOT_H + 14}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--color-ink-700)"
                  >
                    {g.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        {isSingle ? (
          <SingleReadout g={groups[0]} flagged={flagOutliers} />
        ) : (
          <ComparisonReadout groups={groups} />
        )}
        <p className="mt-1.5 text-[12px] text-[color:var(--color-ink-500)]">{dataset.caption}</p>
      </div>
    </div>
  );
}

/** Five-number summary plus spread measures for a single batch. */
function SingleReadout({ g, flagged }: { g: GroupStats; flagged: boolean }) {
  const { min, q1, median, q3, max } = g.five;
  const outliers = g.flagged.filter((f) => f.cls === "outlier");
  const strays = g.flagged.filter((f) => f.cls === "stray");

  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
        Five-number summary · n = {g.n}
      </p>
      <p className="mt-0.5 font-mono text-[13px] tabular-nums text-[color:var(--color-ink-900)]">
        ({fmtStat(min)}, {fmtStat(q1)}, {fmtStat(median)}, {fmtStat(q3)}, {fmtStat(max)})
      </p>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px] text-[color:var(--color-ink-900)]">
        <span>
          Range R = <span className="font-semibold tabular-nums">{fmtStat(g.range)}</span>
        </span>
        <span>
          IQR I = <span className="font-semibold tabular-nums">{fmtStat(g.iqr)}</span>
        </span>
        <span>
          Mean x&#772; = <span className="font-semibold tabular-nums">{fmtStat(g.mean, 2)}</span>
        </span>
        <span>
          s = <span className="font-semibold tabular-nums">{fmtStat(g.sd, 2)}</span>
        </span>
      </div>
      {flagged && (
        <p className="mt-1 text-[12px]">
          {outliers.length === 0 && strays.length === 0 ? (
            <span className="text-[color:var(--color-ink-500)]">No outliers or strays.</span>
          ) : (
            <>
              <span style={{ color: OUTLIER_C }} className="font-semibold">
                {outliers.length} outlier{outliers.length === 1 ? "" : "s"}
              </span>
              <span className="text-[color:var(--color-ink-500)]"> · </span>
              <span className="font-semibold text-[color:var(--color-ink-700)]">
                {strays.length} stray{strays.length === 1 ? "" : "s"}
              </span>
              <span className="text-[color:var(--color-ink-500)]">
                {" "}
                · fences at {fmtStat(g.report.fences.lo)} and {fmtStat(g.report.fences.hi)}
              </span>
            </>
          )}
        </p>
      )}
    </>
  );
}

/** Compact location/spread table for the side-by-side faculty comparison. */
function ComparisonReadout({ groups }: { groups: GroupStats[] }) {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
        Location and spread by group
      </p>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full text-[11px] tabular-nums text-[color:var(--color-ink-900)]">
          <thead>
            <tr className="text-[color:var(--color-ink-500)] text-left">
              <th className="font-medium pr-2">Group</th>
              <th className="font-medium pr-2">n</th>
              <th className="font-medium pr-2">x&#772;</th>
              <th className="font-medium pr-2">x₍m₎</th>
              <th className="font-medium pr-2">s</th>
              <th className="font-medium pr-2">I</th>
              <th className="font-medium">R</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.name}>
                <td className="pr-2">{g.name}</td>
                <td className="pr-2">{g.n}</td>
                <td className="pr-2">{g.mean.toFixed(1)}</td>
                <td className="pr-2">{fmtStat(g.five.median)}</td>
                <td className="pr-2">{g.sd.toFixed(1)}</td>
                <td className="pr-2">{fmtStat(g.iqr)}</td>
                <td>{fmtStat(g.range)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
