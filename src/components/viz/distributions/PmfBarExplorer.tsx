/**
 * Bar-graph explorer for probability mass functions, used by Module 3, WU1
 * (`m3-pmf-pdf`).
 *
 * Does two jobs the text asks for:
 *
 *   1. The "Bar graphs" section says a bar graph gives "an easily interpretable
 *      visual impression of the shape of the distribution". Switching presets
 *      shows that shape changing while the bars always add to one.
 *   2. The chapter is careful about Pr[a ≤ X ≤ b] being a *sum* of separate
 *      point masses, and about how much the type of inequality matters for a
 *      discrete variable. Dragging the two handles selects a run of bars and
 *      adds exactly those probabilities, so the sum is visibly made of pieces.
 *
 * Every preset's x-values are equally spaced (including the money ones: the
 * tips step by R1.50 and the commissions by R10 000), so bars are laid out by
 * index and still sit at their true relative positions. If a preset with
 * uneven spacing is ever added, this layout would misrepresent it and would
 * need a real linear scale instead.
 *
 * Default tier: hand-rolled SVG, pointer drags via the shared `useSvgDrag`
 * hook. Nothing animates, so no loop runs.
 */

"use client";

import { useRef, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { useSvgDrag, clampN } from "../useDrag";
import { VIZ_TEXT } from "../shared";
import { PMF_PRESETS } from "../data/distributionData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
/** Bars outside the selected run: same hue, dropped back so the run reads first. */
const MUTED = "rgb(191, 219, 254)"; // blue-200

// SVG geometry (viewBox units).
const W = 440;
const H = 300;
const PLOT_X0 = 44;
const PLOT_X1 = 424;
const PLOT_Y0 = 20;
const AXIS_Y = 208;
/**
 * Row below the axis holding the two draggable range handles. Far enough
 * below `AXIS_Y` that each handle's leader line can start under the x-axis
 * value labels instead of striking through them.
 */
const HANDLE_Y = 258;
/** Top of the leader lines: just below the x-axis value labels. */
const LEADER_Y = 228;

/**
 * @param params.preset — id of the distribution to open with, from
 *   `PMF_PRESETS`; defaults to the fair die.
 * @param params.select — "all" (default) opens with every bar selected;
 *   "none" opens with a single bar selected, so the student builds the range
 *   up themselves.
 */
export default function PmfBarExplorer({ params }: { params: VizParams }) {
  const initial =
    PMF_PRESETS.find((p) => p.id === params.preset) ?? PMF_PRESETS[0];

  const [presetId, setPresetId] = useState(initial.id);
  const preset = PMF_PRESETS.find((p) => p.id === presetId) ?? PMF_PRESETS[0];
  const pts = preset.points;
  const n = pts.length;

  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(() => (params.select === "none" ? 0 : initial.points.length - 1));

  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = useSvgDrag(svgRef);
  // Index captured at pointer-down: `useSvgDrag` reports displacement from the
  // drag origin, not an absolute position.
  const dragOrigin = useRef(0);

  /** Horizontal centre of the slot for bar `i`. */
  const slot = (PLOT_X1 - PLOT_X0) / n;
  const cx = (i: number) => PLOT_X0 + slot * (i + 0.5);
  const barW = Math.min(slot * 0.6, 44);

  const pMax = Math.max(...pts.map((d) => d.p));
  /**
   * Axis top, rounded up to the next multiple of 0.2 (and always strictly
   * above `pMax`, so the tallest bar is never flush with the top). With three
   * gridlines the midpoint is then a multiple of 0.1, which keeps every tick
   * label tidy; quartering these values would not.
   */
  const yTop = (Math.floor(pMax / 0.2) + 1) * 0.2;
  const yOf = (p: number) => AXIS_Y - (p / yTop) * (AXIS_Y - PLOT_Y0);

  const fmt = preset.format ?? ((x: number) => String(x));
  /**
   * Renders a probability exactly. Presets with a common denominator print as
   * fractions ("1/6"), the rest at the decimal precision the preset declares.
   * Either way the printed terms of a sum add up to the printed total, which
   * a rounded 3-decimal display would not (six 0.167s appear to make 1.002).
   */
  const probText = (v: number) =>
    preset.den ? `${Math.round(v * preset.den)}/${preset.den}` : v.toFixed(preset.dp ?? 3);
  /**
   * The total of a run of probabilities, always as a decimal (a fraction
   * preset would otherwise read "6/6"). Decimal presets reuse their own
   * precision so the total carries exactly as many places as its terms.
   */
  const totalText = (v: number) => v.toFixed(preset.den ? 3 : (preset.dp ?? 3));

  // Not memoised: every preset has at most seven points, so slicing and
  // summing on each render costs less than tracking the dependencies would.
  const selected = pts.slice(Math.min(lo, hi), Math.max(lo, hi) + 1);
  const selectedP = selected.reduce((s, d) => s + d.p, 0);
  const totalP = pts.reduce((s, d) => s + d.p, 0);
  const a = pts[Math.min(lo, hi)];
  const b = pts[Math.max(lo, hi)];
  const wholeRange = selected.length === n;

  /** Load a preset, resetting the selection to the whole distribution. */
  function loadPreset(id: string) {
    const p = PMF_PRESETS.find((q) => q.id === id);
    if (!p) return;
    setPresetId(id);
    setLo(0);
    setHi(p.points.length - 1);
  }

  /** Starts a drag on one of the two range handles, snapping to bar indices. */
  function dragHandle(
    e: React.PointerEvent,
    current: number,
    set: (i: number) => void,
  ) {
    dragOrigin.current = current;
    startDrag(e, (dx) => {
      set(clampN(Math.round(dragOrigin.current + dx / slot), 0, n - 1));
    });
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Preset selector */}
      <div className="flex flex-wrap gap-1.5">
        {PMF_PRESETS.map((p) => (
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

      {/* Bar graph */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto max-h-[320px] select-none"
        >
          <title>
            Bar graph of the probability mass function for {preset.label}, with
            bars from {fmt(a.x)} to {fmt(b.x)} selected, adding to{" "}
            {selectedP.toFixed(3)}
          </title>

          {/* Horizontal gridlines and y-axis ticks */}
          {[0, 0.5, 1].map((frac) => {
            const p = yTop * frac;
            return (
              <g key={frac}>
                <line
                  x1={PLOT_X0}
                  y1={yOf(p)}
                  x2={PLOT_X1}
                  y2={yOf(p)}
                  stroke="var(--color-line)"
                  strokeWidth="1"
                  strokeDasharray={frac === 0 ? undefined : "3 3"}
                />
                <text
                  x={PLOT_X0 - 6}
                  y={yOf(p) + 3}
                  textAnchor="end"
                  fontSize={VIZ_TEXT.axisTick}
                  fill="var(--color-ink-500)"
                  className="tabular-nums"
                >
                  {p.toFixed(2)}
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
            p(x)
          </text>

          {/* Bars. A bar is "in" when its index lies in the selected run. */}
          {pts.map((d, i) => {
            const inRange = i >= Math.min(lo, hi) && i <= Math.max(lo, hi);
            return (
              <g key={d.x}>
                <rect
                  x={cx(i) - barW / 2}
                  y={yOf(d.p)}
                  width={barW}
                  height={AXIS_Y - yOf(d.p)}
                  fill={inRange ? ACCENT : MUTED}
                  stroke={inRange ? ACCENT_DARK : "transparent"}
                  strokeWidth="1"
                  rx="2"
                />
                <text
                  x={cx(i)}
                  y={yOf(d.p) - 5}
                  textAnchor="middle"
                  fontSize={VIZ_TEXT.axisTick}
                  fontWeight={inRange ? 600 : 400}
                  fill={inRange ? ACCENT_DARK : "var(--color-ink-500)"}
                  className="tabular-nums"
                >
                  {probText(d.p)}
                </text>
                <text
                  x={cx(i)}
                  y={AXIS_Y + 15}
                  textAnchor="middle"
                  fontSize={VIZ_TEXT.axisTick}
                  fill="var(--color-ink-700)"
                  className="tabular-nums"
                >
                  {fmt(d.x)}
                </text>
              </g>
            );
          })}

          {/* Axis line, drawn over the bar bases */}
          <line
            x1={PLOT_X0}
            y1={AXIS_Y}
            x2={PLOT_X1}
            y2={AXIS_Y}
            stroke="var(--color-ink-900)"
            strokeWidth="1"
          />

          {/* Selection bracket joining the two handles */}
          <line
            x1={cx(Math.min(lo, hi))}
            y1={HANDLE_Y - 10}
            x2={cx(Math.max(lo, hi))}
            y2={HANDLE_Y - 10}
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* The two draggable range handles */}
          {([
            [lo, setLo, "a"],
            [hi, setHi, "b"],
          ] as const).map(([idx, set, name]) => (
            <g
              key={name}
              className="cursor-ew-resize"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => dragHandle(e, idx, set)}
            >
              {/* Invisible wider hit area: the visible pill is small, and on a
                  phone a 20-unit target is not reliably tappable. */}
              <rect
                x={cx(idx) - 22}
                y={HANDLE_Y - 22}
                width={44}
                height={40}
                fill="transparent"
              />
              <line
                x1={cx(idx)}
                y1={LEADER_Y}
                x2={cx(idx)}
                y2={HANDLE_Y - 10}
                stroke={ACCENT}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <rect
                x={cx(idx) - 11}
                y={HANDLE_Y - 10}
                width={22}
                height={18}
                rx="5"
                fill={ACCENT}
              />
              <text
                x={cx(idx)}
                y={HANDLE_Y + 3}
                textAnchor="middle"
                fontSize={VIZ_TEXT.caption}
                fontWeight="700"
                fill="white"
              >
                {name}
              </text>
            </g>
          ))}

          {/* x-axis caption */}
          <text
            x={(PLOT_X0 + PLOT_X1) / 2}
            y={H - 4}
            textAnchor="middle"
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-500)"
          >
            {preset.axisLabel}
          </text>
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
              "Pick a distribution along the top. Each one comes from a worked example in this unit.",
              "The height of each bar is p(x), the probability that X takes that value.",
              "Drag the two blue handles a and b to select a run of bars.",
              "The selected bars add up to Pr[a ≤ X ≤ b], shown below the chart.",
              "Drag a and b onto the same bar: you get a single point probability p(x).",
              "Select every bar and the total is always 1, which is condition PMF3.",
            ]}
          />
        </div>
        <p className="mt-1 text-[13px] text-[color:var(--color-ink-900)]">
          {lo === hi ? (
            <>
              Pr[X = {fmt(a.x)}] ={" "}
              <span className="font-semibold tabular-nums">{probText(a.p)}</span>
            </>
          ) : (
            <>
              Pr[{fmt(a.x)} ≤ X ≤ {fmt(b.x)}] ={" "}
              <span className="tabular-nums">
                {selected.map((d) => probText(d.p)).join(" + ")}
              </span>{" "}
              = <span className="font-semibold tabular-nums">{totalText(selectedP)}</span>
            </>
          )}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          {wholeRange
            ? `All ${n} bars are selected, and they add to ${totalP.toFixed(3)}. That is condition PMF3: the probabilities of a mass function always sum to one.`
            : `Selected ${selected.length} of ${n} bars. The remaining ${(totalP - selectedP).toFixed(3)} sits outside the range.`}
        </p>
      </div>
    </div>
  );
}
