/**
 * Number-line visualisation of set-builder intervals.
 *
 * Mirrors Examples 6A and 7A from `m1-introducing-probability` where
 * P = {x | 0 ≤ x ≤ 10} and Q = {x | 5 < x < 20}. Switching modes shows
 * P, Q, P ∩ Q (a half-open interval) or P ∪ Q so students can read the
 * endpoint conventions visually instead of having to parse the set-builder
 * notation in their head.
 *
 * Solid endpoint = closed (≤ / ≥ / value included);
 * hollow endpoint = open (< / > / value excluded).
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";

type Mode = "P" | "Q" | "intersection" | "union";

interface ModeMeta {
  key: Mode;
  label: string;
  expr: string;
  reading: string;
}

const MODES: ModeMeta[] = [
  {
    key: "P",
    label: "P",
    expr: "P = {x | 0 ≤ x ≤ 10}",
    reading: "All x between 0 and 10, inclusive on both ends.",
  },
  {
    key: "Q",
    label: "Q",
    expr: "Q = {x | 5 < x < 20}",
    reading: "All x strictly between 5 and 20.",
  },
  {
    key: "intersection",
    label: "P ∩ Q",
    expr: "P ∩ Q = {x | 5 < x ≤ 10}",
    reading: "Open at 5 (excluded by Q) and closed at 10 (included by P).",
  },
  {
    key: "union",
    label: "P ∪ Q",
    expr: "P ∪ Q = {x | 0 ≤ x < 20}",
    reading: "Closed at 0 (P includes it) and open at 20 (Q excludes it).",
  },
];

/** Stroke + fill colours used for every interval bar. */
const ACCENT = "rgb(37, 99, 235)";
const ACCENT_FAINT = "rgba(37, 99, 235, 0.32)";

/**
 * @param params.mode — initial highlighted set; defaults to "P".
 */
export default function SetBuilderLine({ params }: { params: VizParams }) {
  const initialMode: Mode = isMode(params.mode) ? params.mode : "P";
  const [mode, setMode] = useState<Mode>(initialMode);

  // VizPanel re-keys this component when params change, so we don't need an
  // effect to mirror `params.mode` into local state.

  // Number-line domain is fixed to [-2, 24] so the same axis works for every
  // mode and the user can compare interval boundaries visually.
  const xMin = -2;
  const xMax = 24;
  const svgW = 420;
  const svgH = 200;
  const padX = 32;
  const yLine = 130;

  /** Maps a domain x value to an SVG x coordinate. */
  const xScale = (x: number) =>
    padX + ((x - xMin) / (xMax - xMin)) * (svgW - 2 * padX);

  const ticks = [0, 5, 10, 15, 20];

  const active = MODES.find((m) => m.key === mode) ?? MODES[0];

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              mode === m.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto max-h-[260px]">
          {/* Axis */}
          <line
            x1={padX - 10}
            y1={yLine}
            x2={svgW - padX + 10}
            y2={yLine}
            stroke="rgb(15, 23, 42)"
            strokeWidth="1"
          />
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={xScale(t)}
                y1={yLine - 4}
                x2={xScale(t)}
                y2={yLine + 4}
                stroke="rgb(15, 23, 42)"
                strokeWidth="1"
              />
              <text
                x={xScale(t)}
                y={yLine + 22}
                textAnchor="middle"
                fontSize="11"
                fill="rgb(71, 85, 105)"
                className="tabular-nums"
              >
                {t}
              </text>
            </g>
          ))}

          {/* Interval bars + endpoints depend on the mode. */}
          {mode === "P" && (
            <Interval
              x1={0}
              x2={10}
              x1Closed
              x2Closed
              xScale={xScale}
              y={yLine}
            />
          )}
          {mode === "Q" && (
            <Interval
              x1={5}
              x2={20}
              x1Closed={false}
              x2Closed={false}
              xScale={xScale}
              y={yLine}
            />
          )}
          {mode === "intersection" && (
            <Interval
              x1={5}
              x2={10}
              x1Closed={false}
              x2Closed
              xScale={xScale}
              y={yLine}
            />
          )}
          {mode === "union" && (
            <Interval
              x1={0}
              x2={20}
              x1Closed
              x2Closed={false}
              xScale={xScale}
              y={yLine}
            />
          )}

          {/* Static reference outlines for the *other* set, faded, when the
              user is looking at an intersection or union. Helps make the
              composition visible. */}
          {(mode === "intersection" || mode === "union") && (
            <>
              <ReferenceBar
                x1={0}
                x2={10}
                xScale={xScale}
                y={yLine - 32}
                label="P"
                closed={[true, true]}
              />
              <ReferenceBar
                x1={5}
                x2={20}
                xScale={xScale}
                y={yLine - 56}
                label="Q"
                closed={[false, false]}
              />
            </>
          )}
        </svg>
      </div>

      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
          Set
        </p>
        <p className="mt-0.5 font-mono text-[13px] text-[color:var(--color-ink-900)]">
          {active.expr}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          {active.reading} Solid endpoint = included; hollow = excluded.
        </p>
      </div>
    </div>
  );
}

/** Solid filled bar with appropriately-styled endpoints. */
function Interval({
  x1,
  x2,
  x1Closed,
  x2Closed,
  xScale,
  y,
}: {
  x1: number;
  x2: number;
  x1Closed: boolean;
  x2Closed: boolean;
  xScale: (x: number) => number;
  y: number;
}) {
  return (
    <g>
      <rect
        x={xScale(x1)}
        y={y - 9}
        width={xScale(x2) - xScale(x1)}
        height={18}
        fill={ACCENT_FAINT}
      />
      <line
        x1={xScale(x1)}
        y1={y}
        x2={xScale(x2)}
        y2={y}
        stroke={ACCENT}
        strokeWidth="3"
      />
      <Endpoint cx={xScale(x1)} cy={y} closed={x1Closed} />
      <Endpoint cx={xScale(x2)} cy={y} closed={x2Closed} />
    </g>
  );
}

/** Faded reminder of the input sets, drawn above the active interval. */
function ReferenceBar({
  x1,
  x2,
  xScale,
  y,
  label,
  closed,
}: {
  x1: number;
  x2: number;
  xScale: (x: number) => number;
  y: number;
  label: string;
  closed: [boolean, boolean];
}) {
  return (
    <g opacity="0.55">
      <line
        x1={xScale(x1)}
        y1={y}
        x2={xScale(x2)}
        y2={y}
        stroke="rgb(100, 116, 139)"
        strokeWidth="2"
      />
      <Endpoint cx={xScale(x1)} cy={y} closed={closed[0]} muted />
      <Endpoint cx={xScale(x2)} cy={y} closed={closed[1]} muted />
      <text
        x={xScale(x1) - 14}
        y={y + 4}
        fontSize="11"
        fontWeight="600"
        fill="rgb(71, 85, 105)"
      >
        {label}
      </text>
    </g>
  );
}

/** Solid (closed) or hollow (open) endpoint marker. */
function Endpoint({
  cx,
  cy,
  closed,
  muted = false,
}: {
  cx: number;
  cy: number;
  closed: boolean;
  muted?: boolean;
}) {
  const stroke = muted ? "rgb(100, 116, 139)" : ACCENT;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={closed ? stroke : "white"}
      stroke={stroke}
      strokeWidth="1.75"
    />
  );
}

function isMode(v: unknown): v is Mode {
  return (
    typeof v === "string" &&
    ["P", "Q", "intersection", "union"].includes(v)
  );
}
