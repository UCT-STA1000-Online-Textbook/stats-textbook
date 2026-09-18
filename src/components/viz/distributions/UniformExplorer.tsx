/**
 * Rectangle explorer for the Uniform distribution, used by Module 4, WU1
 * (`m4-uniform`).
 *
 * The Uniform density looks too simple to need a picture, and that is exactly
 * the trap: students read f(x) = 1/(b − a) as a constant they were handed
 * rather than as a height forced on them by the requirement that the area be
 * one. Two interactions make that visible:
 *
 *   1. Dragging the endpoints a and b changes the *width* of the rectangle,
 *      and the height moves the other way to keep the area at one. Widen the
 *      interval and the density drops; narrow it and the density climbs.
 *   2. Dragging the shading handles c and d sweeps out Pr[c ≤ X ≤ d], which
 *      for this distribution is just the ratio of two lengths, (d − c)/(b − a).
 *
 * The x-axis window is fixed per preset and never rescales, because a
 * rectangle drawn against a moving axis would look the same at every width
 * and the first lesson would be lost.
 *
 * Mean and variance are shown alongside, so Example 13C(b) has something
 * concrete behind it: the mean sits at the midpoint however the interval is
 * dragged, and the variance grows with the square of the width.
 *
 * The third interaction is the one that makes the probability real. "Drop"
 * draws actual values from the distribution and scatters them across the
 * rectangle, keeping score of how many land inside the shaded strip. That
 * running proportion converges on the number the formula predicts, so
 * "probability" stops being a length calculation and becomes a thing the
 * student watches happen. The tally is cleared whenever the interval or the
 * strip moves, since the old drops answered a different question.
 *
 * Default tier: hand-rolled SVG, pointer drags via the shared `useSvgDrag`
 * hook. Nothing animates, so no loop runs.
 */

"use client";

import { useRef, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { useSvgDrag, clampN } from "../useDrag";
import { VIZ_TEXT, VizHint } from "../shared";
import { sampleUniform } from "../sampling";
import { UNIFORM_PRESETS } from "../data/distributionData";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
/** Mean marker colour, shared with every other viz that marks a mean. */
const MEAN_C = "rgb(220, 38, 38)"; // red-600

// SVG geometry (viewBox units).
const W = 440;
const H = 380;
const PLOT_X0 = 52;
const PLOT_X1 = 424;
const PLOT_Y0 = 24;
const AXIS_Y = 286;
/** Row below the axis holding the two shading handles. */
const HANDLE_Y = 324;
/** How many recent draws are kept on screen as dots. */
const RECENT_SHOWN = 40;

/**
 * Narrowest the interval (b − a) may be dragged, as a fraction of the visible
 * axis window.
 *
 * It sets the top of the y-axis: the tallest the rectangle can ever be is
 * 1/(MIN_WIDTH × window), so fixing this fixes the scale. Without a floor the
 * height would run away to infinity as b approached a, and the y-axis would
 * have to rescale, which is the one thing this viz must not do.
 *
 * Tuned as high as the lesson allows. A smaller floor buys a taller possible
 * rectangle, but it buys it by leaving the plot mostly empty at the widths
 * the worked examples actually use, which is most of what a student ever
 * sees. At 0.42 the margarine preset opens filling about two thirds of the
 * plot and can still be squeezed noticeably taller, and every preset keeps
 * room to move. Raising it further would pin the final-mark interval, whose
 * width is already a large share of its window.
 */
const MIN_WIDTH = 0.42;

/**
 * Interactive Uniform density: drag the endpoints to see the height adjust,
 * drag the shading handles to read off a probability.
 *
 * @param params.preset — id of the example to open with, from
 *   `UNIFORM_PRESETS`; defaults to the margarine tub. The endpoints come from
 *   the preset rather than from a param: MDX only forwards quoted string
 *   attributes, so a numeric one could never reach here.
 */
export default function UniformExplorer({ params }: { params: VizParams }) {
  const initial =
    UNIFORM_PRESETS.find((p) => p.id === params.preset) ?? UNIFORM_PRESETS[0];

  const [presetId, setPresetId] = useState(initial.id);
  const preset = UNIFORM_PRESETS.find((p) => p.id === presetId) ?? UNIFORM_PRESETS[0];
  const [viewLo, viewHi] = preset.view;
  const viewSpan = viewHi - viewLo;
  const minWidth = viewSpan * MIN_WIDTH;

  // Endpoints of the interval, started from the preset's own figures.
  const [a, setA] = useState(initial.start[0]);
  const [b, setB] = useState(initial.start[1]);
  // Edges of the shaded sub-interval.
  const [c, setC] = useState(initial.shade[0]);
  const [d, setD] = useState(initial.shade[1]);

  /** Values drawn so far, and how many of them landed in the shaded strip. */
  const [drops, setDrops] = useState(0);
  const [hits, setHits] = useState(0);
  /**
   * The most recent draws, kept only so they can be drawn as dots. Capped:
   * the picture is unreadable past a few dozen and there is no reason to hold
   * thousands of numbers to show forty.
   */
  const [recent, setRecent] = useState<number[]>([]);

  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = useSvgDrag(svgRef);
  // Value captured at pointer-down: `useSvgDrag` reports displacement from the
  // drag origin, not an absolute position.
  const dragOrigin = useRef(0);

  /**
   * Top of the y-axis: the height of the narrowest rectangle allowed, plus a
   * little headroom so the tallest state is not flush with the frame.
   */
  const yTop = (1 / minWidth) * 1.08;

  const xOf = (v: number) => PLOT_X0 + ((v - viewLo) / viewSpan) * (PLOT_X1 - PLOT_X0);
  const yOf = (v: number) => AXIS_Y - (v / yTop) * (AXIS_Y - PLOT_Y0);
  /** Converts a horizontal displacement in SVG units back into data units. */
  const toData = (dx: number) => (dx / (PLOT_X1 - PLOT_X0)) * viewSpan;

  const fmt = preset.format ?? ((v: number) => v.toFixed(1));
  /** Letter the read-out calls the random variable; "X" unless a preset says otherwise. */
  const rv = preset.variable ?? "X";

  const width = b - a;
  const height = 1 / width;
  const mean = (a + b) / 2;
  const variance = (width * width) / 12;

  const shadeLo = Math.min(c, d);
  const shadeHi = Math.max(c, d);
  const probability = (shadeHi - shadeLo) / width;
  /** True when the shading spans the whole interval, so the area is exactly 1. */
  const wholeInterval = shadeLo <= a + 1e-9 && shadeHi >= b - 1e-9;

  /** Forget every draw so far. Called whenever the question on screen changes. */
  function clearDrops() {
    setDrops(0);
    setHits(0);
    setRecent([]);
  }

  /**
   * Draw `times` values from U(a, b) and score them against the shaded strip.
   *
   * The running proportion is what converges on Pr[c ≤ X ≤ d]; the dots are
   * only the tail end of the draws, so the picture stays legible.
   */
  function dropValues(times: number) {
    let landed = 0;
    const kept: number[] = [];
    for (let i = 0; i < times; i++) {
      const v = sampleUniform(a, b);
      if (v >= shadeLo && v <= shadeHi) landed += 1;
      kept.push(v);
    }
    setDrops((k) => k + times);
    setHits((k) => k + landed);
    setRecent((prev) => [...prev, ...kept].slice(-RECENT_SHOWN));
  }

  /** Load a preset, resetting the interval and the shading to its own figures. */
  function loadPreset(id: string) {
    const p = UNIFORM_PRESETS.find((q) => q.id === id);
    if (!p) return;
    setPresetId(id);
    setA(p.start[0]);
    setB(p.start[1]);
    setC(p.shade[0]);
    setD(p.shade[1]);
    clearDrops();
  }

  /**
   * Starts a drag on endpoint a or b.
   *
   * Moving an endpoint can leave a shading handle stranded outside the
   * interval, so both are pulled back inside on every move. Without this the
   * read-out could report a probability above 1.
   */
  function dragEndpoint(e: React.PointerEvent, which: "a" | "b") {
    clearDrops();
    dragOrigin.current = which === "a" ? a : b;
    startDrag(e, (dx) => {
      const raw = dragOrigin.current + toData(dx);
      if (which === "a") {
        const next = clampN(raw, viewLo, b - minWidth);
        setA(next);
        setC((v) => clampN(v, next, b));
        setD((v) => clampN(v, next, b));
      } else {
        const next = clampN(raw, a + minWidth, viewHi);
        setB(next);
        setC((v) => clampN(v, a, next));
        setD((v) => clampN(v, a, next));
      }
    });
  }

  /** Starts a drag on shading handle c or d, kept inside the interval. */
  function dragShade(e: React.PointerEvent, current: number, set: (v: number) => void) {
    clearDrops();
    dragOrigin.current = current;
    startDrag(e, (dx) => set(clampN(dragOrigin.current + toData(dx), a, b)));
  }

  /** Three evenly spaced axis ticks across the fixed window. */
  const ticks = [viewLo, (viewLo + viewHi) / 2, viewHi];

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      {/* Preset selector */}
      <div className="flex flex-wrap gap-1.5">
        {UNIFORM_PRESETS.map((p) => (
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

      <VizHint>
        Drag <strong className="font-semibold">c</strong> and{" "}
        <strong className="font-semibold">d</strong> to shade part of the interval: the
        shaded fraction is the probability. Then press Run to take real{" "}
        {preset.drawNoun} one at a time and see how many land in the strip.
      </VizHint>

      {/* Draw values from the distribution */}
      <div className="rounded-lg border border-[color:var(--color-line)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mr-0.5">
            Run it
          </span>
          {[1, 500].map((times) => (
            <button
              key={times}
              onClick={() => dropValues(times)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700"
            >
              {times === 1 ? preset.drawOne : preset.drawMany}
            </button>
          ))}
          <button
            onClick={clearDrops}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-500)] transition-colors hover:border-blue-400"
          >
            Reset
          </button>
        </div>
        {drops > 0 && (
          <p className="mt-1.5 text-[12px] text-[color:var(--color-ink-700)]">
            <span className="tabular-nums">{hits.toLocaleString()}</span> of{" "}
            <span className="tabular-nums">{drops.toLocaleString()}</span> {preset.drawNoun}{" "}
            landed in the shaded strip:{" "}
            <span className="font-semibold tabular-nums">
              {(hits / drops).toFixed(4)}
            </span>{" "}
            against a predicted{" "}
            <span className="tabular-nums">{probability.toFixed(4)}</span>
          </p>
        )}
      </div>

      {/* The density rectangle */}
      {/* shrink-0 so the chart is exactly as tall as it wants to be. Letting
          it flex meant its height was pinned by its width and it floated in a
          taller box, wasting a third of the panel. Overflow scrolls instead,
          which the root allows. */}
      <div className="shrink-0 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto max-h-[520px] select-none"
        >
          <title>
            Uniform density for {rv} on ({fmt(a)}, {fmt(b)}) with height{" "}
            {height.toFixed(4)}, and the area between {fmt(shadeLo)} and {fmt(shadeHi)}{" "}
            shaded, equal to {probability.toFixed(4)}
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
                  {v.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* y-axis caption */}
          <text
            x={14}
            y={(PLOT_Y0 + AXIS_Y) / 2}
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
            textAnchor="middle"
            transform={`rotate(-90 14 ${(PLOT_Y0 + AXIS_Y) / 2})`}
          >
            f({rv.toLowerCase()})
          </text>

          {/* The rectangle: pale body, with the shaded strip drawn over it */}
          <rect
            x={xOf(a)}
            y={yOf(height)}
            width={xOf(b) - xOf(a)}
            height={AXIS_Y - yOf(height)}
            fill={ACCENT}
            fillOpacity={0.1}
          />
          {shadeHi > shadeLo && (
            <rect
              x={xOf(shadeLo)}
              y={yOf(height)}
              width={xOf(shadeHi) - xOf(shadeLo)}
              height={AXIS_Y - yOf(height)}
              fill={ACCENT}
              fillOpacity={0.3}
            />
          )}
          {/* The most recent draws, as a rug: short ticks standing on the
              axis at the value each one took.

              Deliberately not a scatter inside the rectangle. This is a
              density plot, where height means f(x) and area means
              probability, so a dot floating at some height would imply its
              height meant something. A draw has only a position along x, and
              a rug says exactly that and nothing more. Ticks piling up on
              each other is fine: that crowding is the distribution. */}
          {recent.map((v, i) => (
            <line
              key={i}
              x1={xOf(v)}
              y1={AXIS_Y}
              x2={xOf(v)}
              y2={AXIS_Y - 11}
              stroke={v >= shadeLo && v <= shadeHi ? ACCENT_DARK : "var(--color-ink-500)"}
              strokeWidth="1.5"
              strokeOpacity={0.65}
            />
          ))}

          {/* Outline: the flat top plus the two vertical jumps at a and b */}
          <path
            d={`M ${xOf(a)} ${AXIS_Y} L ${xOf(a)} ${yOf(height)} L ${xOf(b)} ${yOf(
              height,
            )} L ${xOf(b)} ${AXIS_Y}`}
            fill="none"
            stroke={ACCENT_DARK}
            strokeWidth="2"
          />

          {/* Height, parked just above the flat top. Deliberately the bare
              number: at the narrowest interval the two grips leave only a
              small gap here, and the read-out below spells out the full
              f(x) = 1/(b − a) = … line anyway. */}
          <text
            x={(xOf(a) + xOf(b)) / 2}
            y={yOf(height) - 7}
            textAnchor="middle"
            fontSize={VIZ_TEXT.readout}
            fontWeight="600"
            fill={ACCENT_DARK}
            className="tabular-nums"
          >
            {height.toFixed(4)}
          </text>

          {/* Axis */}
          <line
            x1={PLOT_X0}
            y1={AXIS_Y}
            x2={PLOT_X1}
            y2={AXIS_Y}
            stroke="var(--color-ink-900)"
            strokeWidth="1"
          />
          {ticks.map((t) => (
            <text
              key={t}
              x={xOf(t)}
              y={AXIS_Y + 15}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-500)"
              className="tabular-nums"
            >
              {fmt(t)}
            </text>
          ))}
          {/* What the axis measures, captioned on the chart itself. */}
          <text
            x={(PLOT_X0 + PLOT_X1) / 2}
            y={HANDLE_Y + 34}
            textAnchor="middle"
            fontSize={VIZ_TEXT.label}
            fill="var(--color-ink-700)"
          >
            {preset.axisLabel}
          </text>

          {/* Mean marker at the midpoint of the interval. Red, dashed and
              labelled, the same treatment every other viz in the book gives a
              mean, so the idea keeps one colour across modules. The label is
              stroked in white underneath (paintOrder) to stay readable where
              it crosses the shaded strip. */}
          <g>
            <line
              x1={xOf(mean)}
              y1={yOf(height)}
              x2={xOf(mean)}
              y2={AXIS_Y}
              stroke={MEAN_C}
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text
              x={xOf(mean)}
              y={AXIS_Y - 8}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fontWeight="600"
              fill={MEAN_C}
              stroke="white"
              strokeWidth="3"
              paintOrder="stroke"
            >
              &#956; = {fmt(mean)}
            </text>
          </g>

          {/* Draggable endpoints a and b, gripped at the top corners */}
          {([
            [a, "a"],
            [b, "b"],
          ] as const).map(([v, name]) => (
            <g
              key={name}
              className="cursor-ew-resize"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => dragEndpoint(e, name)}
            >
              {/* Invisible wider hit area: the visible grip is only 18 units
                  across, which is an awkward target on a touch screen.
                  It deliberately stops just below the grip rather than running
                  down to the axis: the lower stretch would sit on top of the
                  c and d guide lines, and a press there could start the wrong
                  drag. */}
              <rect
                x={xOf(v) - 20}
                y={yOf(height) - 38}
                width={40}
                height={42}
                fill="transparent"
              />
              <rect
                x={xOf(v) - 9}
                y={yOf(height) - 20}
                width={18}
                height={16}
                rx="4"
                fill={ACCENT_DARK}
              />
              <text
                x={xOf(v)}
                y={yOf(height) - 8}
                textAnchor="middle"
                fontSize={VIZ_TEXT.caption}
                fontWeight="700"
                fill="white"
              >
                {name}
              </text>
              {/* The endpoint's value, stacked above its grip. It cannot sit
                  down by the axis: there it would print on top of the fixed
                  axis ticks, which carry the same numbers at the ends. */}
              <text
                x={xOf(v)}
                y={yOf(height) - 25}
                textAnchor="middle"
                fontSize={VIZ_TEXT.axisTick}
                fill={ACCENT_DARK}
                className="tabular-nums"
              >
                {fmt(v)}
              </text>
            </g>
          ))}

          {/* Draggable shading handles c and d, in a row below the axis */}
          {([
            [c, setC, "c"],
            [d, setD, "d"],
          ] as const).map(([v, set, name]) => (
            <g
              key={name}
              className="cursor-ew-resize"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => dragShade(e, v, set)}
            >
              {/* Invisible wider hit area: c and d can sit on top of each other. */}
              <rect
                x={xOf(v) - 22}
                y={AXIS_Y}
                width={44}
                height={HANDLE_Y + 24 - AXIS_Y}
                fill="transparent"
              />
              <line
                x1={xOf(v)}
                y1={yOf(height)}
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
              "Pick an example along the top. Each one is worked through in this unit.",
              "Drag the grips a and b to change the interval the values fall in.",
              "Watch the height: widen the interval and the density drops, because the area has to stay at one.",
              "Drag the handles c and d to shade part of the interval. The shaded fraction is the probability.",
              "The red line is the mean, which stays at the midpoint however you drag.",
              "Press Run to draw real values. Count how many land in the strip and the proportion closes on the predicted probability.",
            ]}
          />
        </div>
        {/* The working, not just the answer: for a Uniform distribution a
            probability is one length over another, and seeing the two lengths
            substituted is the whole lesson of the unit. This matches how the
            Module 1 to 3 viz present their results. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)]">
          Pr[{fmt(shadeLo)} ≤ {rv} ≤ {fmt(shadeHi)}] = ({fmt(shadeHi)} − {fmt(shadeLo)}) /{" "}
          {width.toFixed(1)} ={" "}
          <span className="font-semibold tabular-nums">{probability.toFixed(4)}</span>
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
          f({rv.toLowerCase()}) = 1/{width.toFixed(1)} = {height.toFixed(4)} &nbsp;·&nbsp;{" "}
          {/* Coloured to match the marker on the chart. */}
          <span style={{ color: MEAN_C }}>E[{rv}] = {mean.toFixed(2)}</span> &nbsp;·&nbsp;
          Var[{rv}] = {variance.toFixed(2)}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          {wholeInterval
            ? "The whole interval is shaded and the area is 1, which is what forces the height to be 1/(b − a)."
            : shadeHi === shadeLo
              ? "The strip has no width, so the probability is zero. A continuous variable never lands on an exact value."
              : `The shaded strip is ${(shadeHi - shadeLo).toFixed(1)} wide out of ${width.toFixed(1)}, and that ratio is the probability. No integration needed while the density is flat.`}
        </p>
      </div>
    </div>
  );
}
