/**
 * Pairwise mutually exclusive and exhaustive partition.
 *
 * Visualises the closing definition of WU1's set-theory section: a family of
 * n sets A₁, …, Aₙ that covers S exactly (their union is S, every pair
 * disjoint). The partition is **interactive** — drag the dividers to make the
 * pieces unequal (any disjoint cover qualifies, not just equal slices) — and a
 * **draggable, resizable** overlay set B is sliced live into the pieces
 * Aᵢ ∩ B, which motivates the law-of-total-probability identity
 * B = ⋃ (Aᵢ ∩ B) that recurs in later units.
 */

"use client";

import { useRef, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { useSvgDrag, clampN } from "../useDrag";
import { VizGuide } from "../VizGuide";

/** Tints used for the strips. Cycled if `n` exceeds the palette length. */
const PALETTE = [
  "rgb(59, 130, 246)", // blue-500
  "rgb(99, 102, 241)", // indigo-500
  "rgb(20, 184, 166)", // teal-500
  "rgb(236, 72, 153)", // pink-500
  "rgb(16, 185, 129)", // emerald-500
  "rgb(249, 115, 22)", // orange-500
];

// --- Sample-space rectangle (viewBox units) ---
const X0 = 40;
const X1 = 380;
const Y0 = 30;
const Y1 = 240;
const MIN_STRIP = 26; // smallest a strip may be dragged to
const MIN_B = 44; // smallest the overlay B may be resized to

/** Equally-spaced internal divider x-coordinates for an n-piece partition. */
function equalDividers(n: number): number[] {
  return Array.from({ length: n - 1 }, (_, i) => X0 + ((i + 1) * (X1 - X0)) / n);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * @param params.n — initial number of partition pieces (clamped to 2–6).
 *   Defaults to 4.
 */
export default function SetPartition({ params }: { params: VizParams }) {
  const initialN = clampN(typeof params.n === "number" ? params.n : 4, 2, 6);
  const [n, setN] = useState(initialN);
  // n − 1 internal divider x-coordinates; index i sits between strip i and i+1.
  const [dividers, setDividers] = useState<number[]>(() =>
    equalDividers(initialN),
  );
  const [showB, setShowB] = useState(true);
  const [b, setB] = useState<Rect>({ x: 92, y: 104, w: 224, h: 80 });

  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = useSvgDrag(svgRef);

  /** Switch piece count and reset the dividers to an even split. */
  function selectN(k: number) {
    setN(k);
    setDividers(equalDividers(k));
  }

  /** Drag internal divider `j`, clamped between its neighbours. */
  function dragDivider(e: React.PointerEvent, j: number) {
    const origin = dividers[j];
    const leftBound = (j === 0 ? X0 : dividers[j - 1]) + MIN_STRIP;
    const rightBound = (j === n - 2 ? X1 : dividers[j + 1]) - MIN_STRIP;
    startDrag(e, (dx) => {
      const next = [...dividers];
      next[j] = clamp(origin + dx, leftBound, rightBound);
      setDividers(next);
    });
  }

  /** Drag the body of B to move it; B stays inside S. */
  function moveB(e: React.PointerEvent) {
    const origin = { ...b };
    startDrag(e, (dx, dy) => {
      setB({
        ...origin,
        x: clamp(origin.x + dx, X0, X1 - origin.w),
        y: clamp(origin.y + dy, Y0, Y1 - origin.h),
      });
    });
  }

  /** Drag the bottom-right handle to resize B. */
  function resizeB(e: React.PointerEvent) {
    const origin = { ...b };
    startDrag(e, (dx, dy) => {
      setB({
        ...origin,
        w: clamp(origin.w + dx, MIN_B, X1 - origin.x),
        h: clamp(origin.h + dy, MIN_B, Y1 - origin.y),
      });
    });
  }

  // Strip extents [left, right] for each piece, from the live dividers.
  const strips = Array.from({ length: n }, (_, i) => ({
    left: i === 0 ? X0 : dividers[i - 1],
    right: i === n - 1 ? X1 : dividers[i],
  }));

  // Pieces Aᵢ ∩ B — the overlap of each strip with the overlay rectangle.
  const intersections = strips.map((s) => {
    const left = Math.max(s.left, b.x);
    const right = Math.min(s.right, b.x + b.w);
    return right > left ? { left, right } : null;
  });
  const hitCount = intersections.filter(Boolean).length;

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
              onClick={() => selectN(k)}
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
        <svg
          ref={svgRef}
          viewBox="0 0 420 270"
          className="w-full h-auto max-h-[300px]"
        >
          {/* S boundary */}
          <rect
            x={X0}
            y={Y0}
            width={X1 - X0}
            height={Y1 - Y0}
            fill="rgb(248, 250, 252)"
            stroke="rgb(15, 23, 42)"
            strokeWidth="1.5"
            rx="6"
          />
          <text
            x={X1 - 8}
            y={Y0 + 16}
            textAnchor="end"
            fontSize="13"
            fontStyle="italic"
            fontWeight="600"
            fill="rgb(71, 85, 105)"
          >
            S
          </text>

          {/* Partition strips */}
          {strips.map((s, i) => (
            <g key={i}>
              <rect
                x={s.left}
                y={Y0}
                width={s.right - s.left}
                height={Y1 - Y0}
                fill={PALETTE[i % PALETTE.length]}
                fillOpacity="0.16"
              />
              <text
                x={(s.left + s.right) / 2}
                y={Y0 + 24}
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
          ))}

          {/* Aᵢ ∩ B pieces — the overlay sliced by the partition. */}
          {showB &&
            intersections.map((piece, i) =>
              piece ? (
                <rect
                  key={i}
                  x={piece.left}
                  y={b.y}
                  width={piece.right - piece.left}
                  height={b.h}
                  fill={PALETTE[i % PALETTE.length]}
                  fillOpacity="0.5"
                />
              ) : null,
            )}

          {/* Draggable dividers (drawn over the strips). */}
          {dividers.map((dx, j) => (
            <g key={j}>
              <line
                x1={dx}
                y1={Y0}
                x2={dx}
                y2={Y1}
                stroke="rgb(71, 85, 105)"
                strokeWidth="1.5"
              />
              <line
                x1={dx}
                y1={Y0}
                x2={dx}
                y2={Y1}
                stroke="transparent"
                strokeWidth="16"
                style={{ cursor: "ew-resize", touchAction: "none" }}
                onPointerDown={(e) => dragDivider(e, j)}
              />
            </g>
          ))}

          {/* Overlay set B — draggable body + resize handle. */}
          {showB && (
            <g>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill="none"
                stroke="rgb(15, 23, 42)"
                strokeWidth="1.75"
                strokeDasharray="4 3"
                rx="4"
              />
              <text
                x={b.x + 6}
                y={b.y + 15}
                fontSize="12"
                fontWeight="700"
                fill="rgb(15, 23, 42)"
                pointerEvents="none"
              >
                B
              </text>
              {/* Move handle — the whole interior. */}
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill="transparent"
                style={{ cursor: "move", touchAction: "none" }}
                onPointerDown={moveB}
              />
              {/* Resize handle — bottom-right corner. */}
              <rect
                x={b.x + b.w - 9}
                y={b.y + b.h - 9}
                width={18}
                height={18}
                fill="rgb(15, 23, 42)"
                fillOpacity={0.55}
                rx="3"
                style={{ cursor: "nwse-resize", touchAction: "none" }}
                onPointerDown={resizeB}
              />
            </g>
          )}
        </svg>
      </div>

      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2 text-[12px] text-[color:var(--color-ink-700)] leading-relaxed">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-mono">
            A<sub>1</sub> ∪ … ∪ A<sub>{n}</sub> = S,&nbsp; A<sub>i</sub> ∩ A
            <sub>j</sub> = ∅ for i ≠ j.
          </p>
          <VizGuide
            steps={[
              "Drag a divider to resize the pieces — any disjoint cover works, not just equal slices.",
              "Tick 'Overlay arbitrary set B', then drag B to move it or its corner handle to resize it.",
              "Each coloured slice of B is one piece Aᵢ ∩ B.",
            ]}
          />
        </div>
        {showB && (
          <p className="mt-1.5 font-mono">
            B = (A<sub>1</sub> ∩ B) ∪ … ∪ (A<sub>{n}</sub> ∩ B) &nbsp;—&nbsp; B
            currently meets {hitCount} of {n} pieces.
          </p>
        )}
      </div>
    </div>
  );
}
