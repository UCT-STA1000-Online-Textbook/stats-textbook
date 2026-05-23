/**
 * Independence Square — a probability-area picture of statistical independence.
 *
 * The unit square is the whole sample space (total probability 1). A draggable
 * vertical divider at x = Pr(A) splits it into column A (left) and column Ā
 * (right). Event B is the shaded region rising from the base of the square;
 * its top edge has two segments — a height within A's column (this is the
 * conditional probability Pr(B|A)) and a height within Ā's column (Pr(B|Ā)) —
 * each with its own draggable handle.
 *
 * When the two heights are levelled, B's top edge is a single straight line:
 * A and B are *independent*, and Pr(A ∩ B) equals the corner rectangle
 * Pr(A) × Pr(B). Tilt the handles apart and B becomes *dependent* on A.
 * This is the representation independence needs — WU4 notes that a Venn
 * diagram cannot show it.
 *
 * Default-tier viz: lightweight 2D SVG; pointer-drag via the shared
 * `useSvgDrag` hook.
 */

"use client";

import { useRef, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { useSvgDrag, clampN } from "../useDrag";
import { VizGuide } from "../VizGuide";

// --- SVG geometry (viewBox units) ---
const VB_W = 300;
const VB_H = 256;
const X0 = 46; // square left edge
const Y0 = 16; // square top edge
const SQ = 200; // square side
const BOTTOM = Y0 + SQ;
const RIGHT = X0 + SQ;

/** Independence verdict tolerance: the two conditional heights this close
 *  count as "levelled" (≈ one fine drag step). */
const EPS = 0.015;

const BLUE = "rgb(37, 99, 235)";
const INK = "rgb(15, 23, 42)";

/**
 * @param params.pa     — initial Pr(A). Default 0.45.
 * @param params.pbga   — initial Pr(B|A). Default 0.7.
 * @param params.pbgabar— initial Pr(B|Ā). Default 0.3.
 *
 * The defaults start in a clearly *dependent* configuration so the student
 * discovers independence by levelling the cut.
 */
export default function IndependenceSquare({ params }: { params: VizParams }) {
  const [pA, setPA] = useState(clampN(toNum(params.pa, 0.45), 0.08, 0.92));
  const [pBgA, setPBgA] = useState(clamp01(toNum(params.pbga, 0.7)));
  const [pBgAbar, setPBgAbar] = useState(clamp01(toNum(params.pbgabar, 0.3)));

  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = useSvgDrag(svgRef);

  // Derived probabilities. Pr(B) is the area of B — a probability-weighted
  // blend of the two conditional heights.
  const pB = pA * pBgA + (1 - pA) * pBgAbar;
  const pAB = pA * pBgA; // area of the A ∩ B corner rectangle
  const pAxpB = pA * pB;
  const independent = Math.abs(pBgA - pBgAbar) <= EPS;

  // Geometry from the three probabilities.
  const divX = X0 + pA * SQ; // vertical divider
  const topA = Y0 + SQ * (1 - pBgA); // top of B inside column A
  const topAbar = Y0 + SQ * (1 - pBgAbar); // top of B inside column Ā

  /** Drag the divider horizontally → Pr(A). */
  function dragDivider(e: React.PointerEvent) {
    const origin = pA;
    startDrag(e, (dx) => setPA(clampN(origin + dx / SQ, 0.08, 0.92)));
  }
  /** Drag a B-boundary handle vertically → the conditional height. */
  function dragTopA(e: React.PointerEvent) {
    const origin = pBgA;
    startDrag(e, (_dx, dy) => setPBgA(clampN(origin - dy / SQ, 0, 1)));
  }
  function dragTopAbar(e: React.PointerEvent) {
    const origin = pBgAbar;
    startDrag(e, (_dx, dy) => setPBgAbar(clampN(origin - dy / SQ, 0, 1)));
  }

  /** Level the cut: set both conditional heights to Pr(B) — this leaves Pr(B)
   *  unchanged while making A and B exactly independent. */
  function levelCut() {
    setPBgA(pB);
    setPBgAbar(pB);
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-[color:var(--color-ink-500)]">
          The square is the whole sample space — its area is 1.
        </p>
        <VizGuide
          steps={[
            "The vertical divider sets Pr(A): drag it left or right.",
            "Event B is the shaded region rising from the base.",
            "Drag the two round handles to set B's height inside A (Pr(B|A)) and inside Ā (Pr(B|Ā)).",
            "Level the two handles so B's top is one straight line — then A and B are independent.",
            "Watch Pr(A∩B) and Pr(A)×Pr(B): they are equal exactly when the cut is level.",
          ]}
        />
      </div>

      <div className="flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full max-w-[320px]"
        >
          {/* Sample space */}
          <rect
            x={X0}
            y={Y0}
            width={SQ}
            height={SQ}
            fill="rgb(248, 250, 252)"
            stroke={INK}
            strokeWidth="1.5"
          />

          {/* B inside column A — the A ∩ B rectangle */}
          <rect
            x={X0}
            y={topA}
            width={divX - X0}
            height={BOTTOM - topA}
            fill={BLUE}
            fillOpacity="0.36"
          />
          {/* B inside column Ā */}
          <rect
            x={divX}
            y={topAbar}
            width={RIGHT - divX}
            height={BOTTOM - topAbar}
            fill={BLUE}
            fillOpacity="0.36"
          />

          {/* B top-edge segments */}
          <line x1={X0} y1={topA} x2={divX} y2={topA} stroke={BLUE} strokeWidth="2" />
          <line
            x1={divX}
            y1={topAbar}
            x2={RIGHT}
            y2={topAbar}
            stroke={BLUE}
            strokeWidth="2"
          />

          {/* Column labels */}
          <text
            x={(X0 + divX) / 2}
            y={Y0 - 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={INK}
          >
            A
          </text>
          <text
            x={(divX + RIGHT) / 2}
            y={Y0 - 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={INK}
          >
            A&#x0304;
          </text>
          {/* B label, parked in the lower-left of the shaded region */}
          <text
            x={X0 + 8}
            y={BOTTOM - 8}
            fontSize="12"
            fontWeight="700"
            fill={BLUE}
          >
            B
          </text>

          {/* Divider — visible line + wide invisible hit area */}
          <line x1={divX} y1={Y0} x2={divX} y2={BOTTOM} stroke={INK} strokeWidth="1.75" />
          <line
            x1={divX}
            y1={Y0}
            x2={divX}
            y2={BOTTOM}
            stroke="transparent"
            strokeWidth="18"
            style={{ cursor: "ew-resize", touchAction: "none" }}
            onPointerDown={dragDivider}
          />
          <rect
            x={divX - 5}
            y={(Y0 + BOTTOM) / 2 - 11}
            width={10}
            height={22}
            rx={3}
            fill="white"
            stroke={INK}
            strokeWidth="1.5"
            style={{ cursor: "ew-resize", touchAction: "none" }}
            onPointerDown={dragDivider}
          />

          {/* B-height handles */}
          <Handle
            cx={(X0 + divX) / 2}
            cy={topA}
            onPointerDown={dragTopA}
          />
          <Handle
            cx={(divX + RIGHT) / 2}
            cy={topAbar}
            onPointerDown={dragTopAbar}
          />
        </svg>
      </div>

      {/* Verdict + level button */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold border ${
            independent
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              independent ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {independent ? "A and B are independent" : "A and B are dependent"}
        </span>
        <button
          onClick={levelCut}
          className="rounded-md border border-[color:var(--color-line)] bg-white px-2.5 py-1 text-[12px] font-medium text-[color:var(--color-ink-700)] hover:border-indigo-400 transition-colors"
        >
          Level the cut
        </button>
      </div>

      {/* Readouts — the independence test made numeric */}
      <div className="space-y-1 text-[12px] font-mono text-[color:var(--color-ink-700)]">
        <div
          className={`flex justify-between gap-2 px-3 py-1.5 rounded-md border ${
            independent
              ? "bg-emerald-50/70 border-emerald-200/70"
              : "bg-amber-50/70 border-amber-200/70"
          }`}
        >
          <span>Pr(A∩B) vs Pr(A)×Pr(B)</span>
          <span className="tabular-nums font-semibold">
            {pAB.toFixed(2)} {independent ? "=" : "≠"} {pAxpB.toFixed(2)}
          </span>
        </div>
        <Row label="Pr(B | A)" value={pBgA} />
        <Row label="Pr(B | A̅)" value={pBgAbar} />
        <Row label="Pr(A)" value={pA} />
        <Row label="Pr(B)" value={pB} />
      </div>

      <p className="text-[11px] leading-relaxed text-[color:var(--color-ink-500)]">
        A and B are independent exactly when B fills the <em>same fraction</em>{" "}
        of column A as of column Ā — one straight cut. Then Pr(B|A) = Pr(B|Ā) =
        Pr(B). This is not the same as <em>mutually exclusive</em>: that is a
        Venn-diagram idea (A and B simply not overlapping), and it cannot be
        read off this square.
      </p>
    </div>
  );
}

/** Draggable round handle — a visible dot over a generous invisible hit area. */
function Handle({
  cx,
  cy,
  onPointerDown,
}: {
  cx: number;
  cy: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <g style={{ cursor: "ns-resize", touchAction: "none" }} onPointerDown={onPointerDown}>
      <circle cx={cx} cy={cy} r={13} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={5.5}
        fill="white"
        stroke={BLUE}
        strokeWidth="2.25"
      />
    </g>
  );
}

/** Mono readout row, `label` left and the two-decimal `value` right. */
function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2 px-3 text-[color:var(--color-ink-500)]">
      <span>{label}</span>
      <span className="tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function toNum(v: unknown, fallback: number) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
