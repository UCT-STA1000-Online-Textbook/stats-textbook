/**
 * Least-squares regression viz, used by Module 5, WU10 (`m5-regression`).
 *
 * The slides ask "Which line fits the data best?" and answer: the one that
 * makes the sum of squared residuals as small as possible. This viz lets the
 * student try to find that line by hand:
 *
 *   - The scatterplot shows an example's data with a line the student moves
 *     by dragging its two end handles. Each residual e = y − ŷ is drawn as a
 *     vertical line from the point to the line, with a pale square whose area
 *     is e². The sum of squared residuals adds up those areas.
 *   - The read-out adds up the squares and compares the total with the
 *     smallest possible one, from the least-squares line. "Show least-squares
 *     line" draws that line, with its a, b, r and R² (the same figures as the
 *     Excel output in the slides).
 *   - The data points can be dragged up and down too. Lining them up shows
 *     r moving towards +1 or −1; scattering them shows r falling towards 0.
 *
 * Default tier: a hand-rolled SVG, with no animation beyond the drag itself.
 */

"use client";

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { VIZ_TEXT, VizHint } from "../shared";
import { clampN, useSvgDrag } from "../useDrag";
import { REGRESSION_PRESETS, type RegressionPreset } from "../data/inferenceData";
import { fitLine, type Point } from "../regression";
import { fmt, pct } from "./format";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const INK = "rgb(15, 23, 42)"; // slate-900, the least-squares line

// SVG geometry (viewBox units). The left margin holds the y tick labels.
const W = 440;
const PLOT_X0 = 46;
const PLOT_X1 = 426;
const PLOT_Y0 = 14;
const AXIS_Y = 214;
const H = AXIS_Y + 38;

/** The student's line, stored by its height at the left and right edges of the plot. */
interface UserLine {
  left: number;
  right: number;
}

/** Starts the student's line flat, at the mean of y: a fair "no idea yet" guess. */
function flatLine(points: Point[]): UserLine {
  const my = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { left: my, right: my };
}

/** Writes ŷ = a + bx with a true minus sign: "ŷ = −9.872 + 3.586x". */
function equation(a: number, b: number): string {
  return `ŷ = ${fmt(a, 3)} ${b < 0 ? "−" : "+"} ${fmt(Math.abs(b), 3)}x`;
}

/**
 * Fit a line by eye and compare its sum of squared residuals with the
 * least-squares line's.
 *
 * @param params.preset — id of the data set to open with, from
 *   `REGRESSION_PRESETS`; defaults to Example 1 (education and income).
 */
export default function LeastSquares({ params }: { params: VizParams }) {
  const initial = REGRESSION_PRESETS.find((p) => p.id === params.preset) ?? REGRESSION_PRESETS[0];

  const [preset, setPreset] = useState<RegressionPreset>(initial);
  const [points, setPoints] = useState<Point[]>(initial.points);
  const [line, setLine] = useState<UserLine>(() => flatLine(initial.points));
  const [showBest, setShowBest] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = useSvgDrag(svgRef);
  const clipId = useId();

  const [x0, x1] = preset.xView;
  const [y0, y1] = preset.yView;
  const xOf = (x: number) => PLOT_X0 + ((x - x0) / (x1 - x0)) * (PLOT_X1 - PLOT_X0);
  const yOf = (y: number) => AXIS_Y - ((y - y0) / (y1 - y0)) * (AXIS_Y - PLOT_Y0);
  /** viewBox units per unit of y, to turn a vertical drag into a change in y. */
  const pxPerY = (AXIS_Y - PLOT_Y0) / (y1 - y0);
  // Dragged points snap to a tidy grid (0.5 for income, 0.1 for defect rate)
  // so the read-out never prints a figure like 33.4172.
  const snap = preset.yStep / 20;
  const clampY = (y: number) => clampN(y, y0, y1);
  // toFixed strips the floating-point tail (9.600000000000001) that rounding
  // to a multiple of 0.1 leaves, so an untouched point still equals the data.
  const snapY = (y: number) => clampY(Number((Math.round(y / snap) * snap).toFixed(2)));

  const fit = fitLine(points);
  const moved = points.some((p, i) => p.y !== preset.points[i].y);

  // The student's line in a + bx form, from its two edge heights.
  const userB = (line.right - line.left) / (x1 - x0);
  const userA = line.left - userB * x0;
  const residuals = points.map((p) => p.y - (userA + userB * p.x));
  const userSum = residuals.reduce((s, e) => s + e * e, 0);

  function loadPreset(next: RegressionPreset) {
    setPreset(next);
    setPoints(next.points);
    setLine(flatLine(next.points));
    setShowBest(false);
  }

  function reset() {
    loadPreset(preset);
  }

  function dragEnd(e: PointerEvent, side: keyof UserLine) {
    const start = line[side];
    startDrag(e, (_dx, dy) => setLine((l) => ({ ...l, [side]: clampY(start - dy / pxPerY) })));
  }

  function dragPoint(e: PointerEvent, i: number) {
    const start = points[i].y;
    startDrag(e, (_dx, dy) => {
      const y = snapY(start - dy / pxPerY);
      setPoints((ps) => ps.map((p, k) => (k === i ? { ...p, y } : p)));
    });
  }

  /** Arrow keys nudge a focused handle or point, for students not using a pointer. */
  function nudge(e: KeyboardEvent, move: (dy: number) => void) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    move((e.key === "ArrowUp" ? 1 : -1) * snap * (e.shiftKey ? 10 : 1));
  }

  // --- Axes ---
  const xTicks: number[] = [];
  for (let v = Math.ceil(x0 / preset.xStep) * preset.xStep; v <= x1 + 1e-9; v += preset.xStep) xTicks.push(v);
  const yTicks: number[] = [];
  for (let v = Math.ceil(y0 / preset.yStep) * preset.yStep; v <= y1 + 1e-9; v += preset.yStep) yTicks.push(v);

  // --- Read-out ---
  const terms = residuals.map((e) => `(${fmt(e, 2)})²`);
  // Past four terms, show the first two and the last two, as the text does.
  const shownTerms = terms.length > 4 ? `${terms.slice(0, 2).join(" + ")} + ⋯ + ${terms.slice(-2).join(" + ")}` : terms.join(" + ");
  const r2 = fit.r * fit.r;
  /** Every point on one straight line: the least-squares line passes through them all. */
  const perfectFit = fit.sse < 1e-9;
  const allSameY = points.every((p) => p.y === points[0].y);
  const ratio = perfectFit ? 1 : userSum / fit.sse;

  /** One plain sentence on what the picture currently means. */
  const interpretation = allSameY
    ? "Every y is the same, so there is no variation in y to explain and no relationship: r is 0."
    : perfectFit
      ? userSum < 1e-6
        ? `The points lie on one straight line and your line goes through them all, so Σe² = 0 and r = ${fit.r > 0 ? "+1" : "−1"}.`
        : `The points lie on one straight line, so the least-squares line goes through every one (Σe² = 0) and r = ${fit.r > 0 ? "+1" : "−1"}. Drag your line onto them.`
      : ratio < 1.005
        ? "This is the least-squares line: no other straight line has a smaller sum of squared residuals."
        : ratio < 1.05
          ? `Very close: your squares add up to only ${pct(ratio - 1)} more than the least-squares line's.`
          : `Your squares add up to ${ratio < 10 ? ratio.toFixed(1) : Math.round(ratio)} times the smallest possible total. Tilt and shift the line to shrink them.`;

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
    }`;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="flex flex-wrap gap-1.5">
        {REGRESSION_PRESETS.map((q) => (
          <button key={q.id} onClick={() => loadPreset(q)} className={chip(preset.id === q.id)}>
            {q.label}
          </button>
        ))}
      </div>

      <VizHint>
        Drag the two round handles at the ends of the line to make the shaded squares as small as you can.
      </VizHint>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setShowBest((s) => !s)}
          aria-pressed={showBest}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700"
        >
          {showBest ? "Hide least-squares line" : "Show least-squares line"}
        </button>
        <button
          onClick={reset}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-500)] transition-colors hover:border-blue-400"
        >
          Reset
        </button>
      </div>

      <div className="flex items-center justify-center">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[340px] select-none">
          <title>
            {`Scatterplot of ${preset.yName} against ${preset.xName}, with a line you can drag and a square on each residual. Your sum of squared residuals is ${fmt(userSum, 3)}; the smallest possible is ${fmt(fit.sse, 3)}.`}
          </title>
          <defs>
            <clipPath id={clipId}>
              <rect x={PLOT_X0} y={PLOT_Y0} width={PLOT_X1 - PLOT_X0} height={AXIS_Y - PLOT_Y0} />
            </clipPath>
          </defs>

          {/* Grid lines and tick labels */}
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={PLOT_X0} y1={yOf(v)} x2={PLOT_X1} y2={yOf(v)} stroke="var(--color-line)" strokeWidth="0.6" />
              <text
                x={PLOT_X0 - 6}
                y={yOf(v) + 3.5}
                textAnchor="end"
                fontSize={VIZ_TEXT.axisTick}
                fill="var(--color-ink-700)"
                className="tabular-nums"
              >
                {v}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text
              key={`x${v}`}
              x={xOf(v)}
              y={AXIS_Y + 13}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-700)"
              className="tabular-nums"
            >
              {v}
            </text>
          ))}
          <line x1={PLOT_X0} y1={AXIS_Y} x2={PLOT_X1} y2={AXIS_Y} stroke="var(--color-ink-900)" />
          <line x1={PLOT_X0} y1={PLOT_Y0} x2={PLOT_X0} y2={AXIS_Y} stroke="var(--color-ink-900)" />
          <text x={(PLOT_X0 + PLOT_X1) / 2} y={AXIS_Y + 30} textAnchor="middle" fontSize={VIZ_TEXT.label} fill="var(--color-ink-700)">
            {preset.xLabel}
          </text>
          <text
            x={12}
            y={(PLOT_Y0 + AXIS_Y) / 2}
            textAnchor="middle"
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
            transform={`rotate(-90 12 ${(PLOT_Y0 + AXIS_Y) / 2})`}
          >
            {preset.yLabel}
          </text>

          <g clipPath={`url(#${clipId})`}>
            {/* Squared residuals: each square's side is the residual, so its
                area is e². Drawn to the right of the residual line. */}
            {points.map((p, i) => {
              const top = Math.min(yOf(p.y), yOf(p.y - residuals[i]));
              const side = Math.abs(yOf(p.y) - yOf(p.y - residuals[i]));
              return (
                <rect
                  key={`sq${i}`}
                  x={xOf(p.x)}
                  y={top}
                  width={side}
                  height={side}
                  fill={ACCENT}
                  fillOpacity={0.12}
                  stroke={ACCENT}
                  strokeOpacity={0.35}
                  strokeWidth="0.8"
                />
              );
            })}
            {points.map((p, i) => (
              <line
                key={`res${i}`}
                x1={xOf(p.x)}
                y1={yOf(p.y)}
                x2={xOf(p.x)}
                y2={yOf(p.y - residuals[i])}
                stroke={ACCENT_DARK}
                strokeWidth="1.2"
              />
            ))}

            {showBest && (
              <line
                x1={xOf(x0)}
                y1={yOf(fit.a + fit.b * x0)}
                x2={xOf(x1)}
                y2={yOf(fit.a + fit.b * x1)}
                stroke={INK}
                strokeWidth="1.8"
                strokeDasharray="6 4"
              />
            )}

            {/* The student's line */}
            <line x1={xOf(x0)} y1={yOf(line.left)} x2={xOf(x1)} y2={yOf(line.right)} stroke={ACCENT} strokeWidth="2.2" />
          </g>

          {/* Data points: drag up or down to change y. */}
          {points.map((p, i) => (
            <g
              key={`pt${i}`}
              role="slider"
              tabIndex={0}
              aria-label={`Point ${i + 1}, at x = ${p.x}`}
              aria-valuetext={`y = ${p.y}`}
              aria-valuenow={p.y}
              aria-valuemin={y0}
              aria-valuemax={y1}
              className="cursor-ns-resize outline-none"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => dragPoint(e, i)}
              onKeyDown={(e) =>
                nudge(e, (dy) => setPoints((ps) => ps.map((q, k) => (k === i ? { ...q, y: snapY(q.y + dy) } : q))))
              }
            >
              {/* Invisible wider hit area so a point is easy to grab on a phone. */}
              <circle cx={xOf(p.x)} cy={yOf(p.y)} r={13} fill="transparent" />
              <circle cx={xOf(p.x)} cy={yOf(p.y)} r={4.5} fill={INK} stroke="white" strokeWidth="1.2" />
            </g>
          ))}

          {/* The line's two end handles */}
          {(["left", "right"] as const).map((side) => {
            const cx = side === "left" ? xOf(x0) : xOf(x1);
            return (
              <g
                key={side}
                role="slider"
                tabIndex={0}
                aria-label={`${side === "left" ? "Left" : "Right"} end of your line`}
                aria-valuenow={Number(line[side].toFixed(2))}
                aria-valuemin={y0}
                aria-valuemax={y1}
                className="cursor-ns-resize outline-none"
                style={{ touchAction: "none" }}
                onPointerDown={(e) => dragEnd(e, side)}
                onKeyDown={(e) => nudge(e, (dy) => setLine((l) => ({ ...l, [side]: clampY(l[side] + dy) })))}
              >
                <circle cx={cx} cy={yOf(line[side])} r={16} fill="transparent" />
                <circle cx={cx} cy={yOf(line[side])} r={7} fill="white" stroke={ACCENT} strokeWidth="2.5" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">{preset.source}</p>
          <VizGuide
            steps={[
              "Pick a data set along the top. The dependent variable y is on the vertical axis and the independent variable x on the horizontal axis.",
              "Your blue line starts flat. Each dark vertical line is a residual, e = y − ŷ: the gap between a point and your line. The square on it has area e².",
              "Drag the round handles at either end of the line to tilt and shift it. The read-out adds up the squares: that is your sum of squared residuals.",
              "Try to get your total down to the smallest possible one, shown under it. Then press Show least-squares line to see the line that achieves it, with its a, b, r and R².",
              "Drag the data points up or down. Line them all up on a sloping line and r reaches +1 or −1; scatter them and r falls towards 0. Press Reset to bring back the example's data.",
            ]}
          />
        </div>
        {/* The working, then the answer. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          Your line {equation(userA, userB)}: Σe² = {shownTerms} = <span className="font-semibold text-blue-700">{fmt(userSum, 3)}</span>
        </p>
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          {showBest ? (
            <>
              Least squares {equation(fit.a, fit.b)}: Σe² = <span className="font-semibold">{fmt(fit.sse, 3)}</span>
            </>
          ) : (
            <>
              Smallest possible Σe² = <span className="font-semibold">{fmt(fit.sse, 3)}</span>
            </>
          )}
        </p>
        {showBest && (
          <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
            r = {fmt(fit.r, 3)}, R² = r² = {fmt(r2, 3)}: {pct(r2)} of the variation in {preset.yName} is explained by the
            variation in {preset.xName}.{moved ? " You have moved the data, so these are not the example's figures." : ""}
          </p>
        )}
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{interpretation}</p>
      </div>
    </div>
  );
}
