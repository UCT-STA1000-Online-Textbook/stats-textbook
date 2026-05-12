/**
 * Pairwise mutually exclusive and exhaustive partition.
 *
 * Visualises the closing definition of WU1's set-theory section: a family
 * of n sets A₁, …, A_n that covers S exactly (their union is S, and each
 * pair is disjoint). An optional overlay set B is drawn across the strips
 * to motivate the law-of-total-probability identity that recurs throughout
 * later units.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";

/** Tints used for the strips. Cycled if `n` exceeds the palette length. */
const PALETTE = [
  "rgb(59, 130, 246)", // blue-500
  "rgb(99, 102, 241)", // indigo-500
  "rgb(20, 184, 166)", // teal-500
  "rgb(236, 72, 153)", // pink-500
  "rgb(16, 185, 129)", // emerald-500
  "rgb(249, 115, 22)", // orange-500
];

/**
 * @param params.n — initial number of partition pieces (clamped to 2–6).
 *   Defaults to 4.
 */
export default function SetPartition({ params }: { params: VizParams }) {
  const initialN = clamp(typeof params.n === "number" ? params.n : 4, 2, 6);
  const [n, setN] = useState(initialN);
  const [showB, setShowB] = useState(true);

  // VizPanel re-keys on params change, so initial n picks up the new value
  // without a useEffect.

  // Sample-space rectangle in SVG units.
  const x0 = 40,
    x1 = 380,
    y0 = 30,
    y1 = 240;
  const stripW = (x1 - x0) / n;

  // Arbitrary set B drawn as a horizontal band that crosses every strip.
  const bx0 = 80,
    bx1 = 350;
  const by0 = 110,
    by1 = 175;

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-[color:var(--color-ink-500)]">
            Parts:
          </span>
          {[2, 3, 4, 5, 6].map((k) => (
            <button
              key={k}
              onClick={() => setN(k)}
              className={`w-7 h-7 rounded-md text-[12px] font-semibold border transition-colors ${
                n === k
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-[color:var(--color-ink-700)] cursor-pointer">
          <input
            type="checkbox"
            checked={showB}
            onChange={(e) => setShowB(e.target.checked)}
            className="accent-blue-600"
          />
          Overlay arbitrary set B
        </label>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg viewBox="0 0 420 270" className="w-full h-auto max-h-[300px]">
          {/* S boundary */}
          <rect
            x={x0}
            y={y0}
            width={x1 - x0}
            height={y1 - y0}
            fill="rgb(248, 250, 252)"
            stroke="rgb(15, 23, 42)"
            strokeWidth="1.5"
            rx="6"
          />
          <text
            x={x1 - 8}
            y={y0 + 16}
            textAnchor="end"
            fontSize="13"
            fontStyle="italic"
            fontWeight="600"
            fill="rgb(71, 85, 105)"
          >
            S
          </text>

          {/* Partition strips */}
          {Array.from({ length: n }).map((_, i) => {
            const sx0 = x0 + i * stripW;
            return (
              <g key={i}>
                <rect
                  x={sx0}
                  y={y0}
                  width={stripW}
                  height={y1 - y0}
                  fill={PALETTE[i % PALETTE.length]}
                  fillOpacity="0.18"
                />
                {/* Internal divider (skip the first strip's left edge — it
                    coincides with S's border). */}
                {i > 0 && (
                  <line
                    x1={sx0}
                    y1={y0}
                    x2={sx0}
                    y2={y1}
                    stroke="rgb(100, 116, 139)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                )}
                <text
                  x={sx0 + stripW / 2}
                  y={y0 + 24}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="rgb(15, 23, 42)"
                >
                  A
                  <tspan fontSize="9" dy="3">
                    {i + 1}
                  </tspan>
                </text>
              </g>
            );
          })}

          {/* Optional B overlay to motivate B = ⋃ (A_i ∩ B). */}
          {showB && (
            <g>
              <rect
                x={bx0}
                y={by0}
                width={bx1 - bx0}
                height={by1 - by0}
                fill="rgb(15, 23, 42)"
                fillOpacity="0.08"
                stroke="rgb(15, 23, 42)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                rx="6"
              />
              <text
                x={bx0 + 6}
                y={by0 + 16}
                fontSize="12"
                fontWeight="700"
                fill="rgb(15, 23, 42)"
              >
                B
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2 text-[12px] text-[color:var(--color-ink-700)] leading-relaxed">
        <p className="font-mono">
          A<sub>1</sub> ∪ A<sub>2</sub> ∪ … ∪ A<sub>{n}</sub> = S, &nbsp;
          A<sub>i</sub> ∩ A<sub>j</sub> = ∅ for i ≠ j.
        </p>
        {showB && (
          <p className="mt-1.5 font-mono">
            B = (A<sub>1</sub> ∩ B) ∪ (A<sub>2</sub> ∩ B) ∪ … ∪ (A<sub>{n}</sub>{" "}
            ∩ B)
          </p>
        )}
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
