/**
 * Probability Venn diagram for the Addition Rule.
 *
 * Sliders control Pr(A), Pr(B) and Pr(A ∩ B). The four region probabilities
 * (A only, intersection, B only, neither) are written into the diagram, and
 * the derived quantities Pr(A ∪ B), Pr(Ā), etc. are listed underneath so
 * Theorems 1–3 of WU2 are visible at a glance.
 *
 * Pr(A ∩ B) is auto-clamped to [max(0, Pr(A)+Pr(B)−1), min(Pr(A), Pr(B))]
 * whenever any slider moves — the only way to keep all four region
 * probabilities non-negative and summing to 1.
 */

"use client";

import { useState, type ReactNode } from "react";
import type { VizParams } from "@/store/vizStore";

/**
 * Renders a horizontal bar that spans every character it wraps. Used for
 * compound complements in the formula rows; a Unicode combining macron
 * would only sit above a single preceding character.
 */
function Bar({ children }: { children: ReactNode }) {
  return <span className="overline">{children}</span>;
}

/**
 * @param params.pA  — initial Pr(A) ∈ [0,1]; defaults to 0.5.
 * @param params.pB  — initial Pr(B) ∈ [0,1]; defaults to 0.6.
 * @param params.pAB — initial Pr(A ∩ B); auto-clamped if inconsistent.
 */
export default function ProbabilityVenn({ params }: { params: VizParams }) {
  const initialPA = clamp01(toNum(params.pA, 0.5));
  const initialPB = clamp01(toNum(params.pB, 0.6));
  const initialPAB = clamp01(toNum(params.pAB, 0.3));

  // Initial values are clamped on mount so the four region probabilities
  // start in a feasible configuration.
  const [pA, setPA] = useState(initialPA);
  const [pB, setPB] = useState(initialPB);
  const [pAB, setPAB] = useState(() =>
    clampIntersection(initialPAB, initialPA, initialPB),
  );

  // Slider handlers do their own clamping so we never enter a state with a
  // negative region. Pr(A ∩ B) must satisfy
  //   max(0, Pr(A) + Pr(B) − 1)  ≤  Pr(A ∩ B)  ≤  min(Pr(A), Pr(B)).
  function handlePA(v: number) {
    setPA(v);
    setPAB((prev) => clampIntersection(prev, v, pB));
  }
  function handlePB(v: number) {
    setPB(v);
    setPAB((prev) => clampIntersection(prev, pA, v));
  }
  function handlePAB(v: number) {
    setPAB(clampIntersection(v, pA, pB));
  }

  const pAOnly = Math.max(0, pA - pAB);
  const pBOnly = Math.max(0, pB - pAB);
  const pUnion = pA + pB - pAB;
  const pNeither = Math.max(0, 1 - pUnion);
  const pNotA = 1 - pA;
  const pNotIntersection = 1 - pAB;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto">
      <div className="space-y-2">
        <Slider label="Pr(A)" value={pA} onChange={handlePA} />
        <Slider label="Pr(B)" value={pB} onChange={handlePB} />
        <Slider label="Pr(A ∩ B)" value={pAB} onChange={handlePAB} />
      </div>

      <div className="flex items-center justify-center">
        <svg viewBox="0 0 360 200" className="w-full max-w-[360px]">
          <defs>
            <mask id="pv-maskInsideA">
              <rect width="360" height="200" fill="black" />
              <circle cx="140" cy="100" r="62" fill="white" />
            </mask>
            <mask id="pv-maskOutsideA">
              <rect width="360" height="200" fill="white" />
              <circle cx="140" cy="100" r="62" fill="black" />
            </mask>
            <mask id="pv-maskOutsideB">
              <rect width="360" height="200" fill="white" />
              <circle cx="220" cy="100" r="62" fill="black" />
            </mask>
          </defs>

          <rect
            x="10"
            y="10"
            width="340"
            height="180"
            rx="6"
            fill="rgb(248, 250, 252)"
            stroke="rgb(15, 23, 42)"
            strokeWidth="1.5"
          />
          <text
            x="345"
            y="26"
            textAnchor="end"
            fontSize="11"
            fontStyle="italic"
            fontWeight="600"
            fill="rgb(71, 85, 105)"
          >
            S
          </text>

          {/* Region tints — opacity scaled with the region probability so
              denser regions look heavier without ever fully obscuring the
              outline. */}
          <circle
            cx="140"
            cy="100"
            r="62"
            fill="rgb(37, 99, 235)"
            fillOpacity={tintOpacity(pAOnly)}
            mask="url(#pv-maskOutsideB)"
          />
          <circle
            cx="220"
            cy="100"
            r="62"
            fill="rgb(37, 99, 235)"
            fillOpacity={tintOpacity(pBOnly)}
            mask="url(#pv-maskOutsideA)"
          />
          <circle
            cx="220"
            cy="100"
            r="62"
            fill="rgb(37, 99, 235)"
            fillOpacity={tintOpacity(pAB)}
            mask="url(#pv-maskInsideA)"
          />

          <circle
            cx="140"
            cy="100"
            r="62"
            fill="none"
            stroke="rgb(15, 23, 42)"
            strokeWidth="1.5"
          />
          <circle
            cx="220"
            cy="100"
            r="62"
            fill="none"
            stroke="rgb(15, 23, 42)"
            strokeWidth="1.5"
          />

          <text x="92" y="50" fontSize="13" fontWeight="700" fill="rgb(15, 23, 42)">
            A
          </text>
          <text x="258" y="50" fontSize="13" fontWeight="700" fill="rgb(15, 23, 42)">
            B
          </text>

          {/* Region probability labels */}
          <RegionLabel x={108} y={104} value={pAOnly} />
          <RegionLabel x={180} y={104} value={pAB} emphasized />
          <RegionLabel x={252} y={104} value={pBOnly} />
          <RegionLabel x={325} y={104} value={pNeither} muted />
        </svg>
      </div>

      <div className="space-y-1 text-[12px] font-mono text-[color:var(--color-ink-700)]">
        <Row
          expr="Pr(A ∪ B) = Pr(A) + Pr(B) − Pr(A ∩ B)"
          value={pUnion}
          highlight
        />
        <Row
          expr={
            <>
              Pr(A ∩ <Bar>B</Bar>) = Pr(A) − Pr(A ∩ B)
            </>
          }
          value={pAOnly}
        />
        <Row
          expr={
            <>
              Pr(<Bar>A</Bar>) = 1 − Pr(A)
            </>
          }
          value={pNotA}
        />
        <Row
          expr={
            <>
              Pr(<Bar>A ∩ B</Bar>) = 1 − Pr(A ∩ B)
            </>
          }
          value={pNotIntersection}
        />
      </div>
    </div>
  );
}

function tintOpacity(p: number) {
  // Floor so a probability of 0 still leaves a faint outline-fill; cap so
  // even Pr = 1 remains semi-transparent and the region label stays legible.
  return 0.12 + 0.5 * Math.min(1, Math.max(0, p));
}

function RegionLabel({
  x,
  y,
  value,
  emphasized,
  muted,
}: {
  x: number;
  y: number;
  value: number;
  emphasized?: boolean;
  muted?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={emphasized ? 12 : 11}
      fontWeight={emphasized ? 700 : 600}
      className="tabular-nums"
      fill={muted ? "rgb(100, 116, 139)" : "rgb(15, 23, 42)"}
    >
      {value.toFixed(2)}
    </text>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-[12px] font-mono text-[color:var(--color-ink-700)]">
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

function Row({
  expr,
  value,
  highlight,
}: {
  expr: ReactNode;
  value: number;
  highlight?: boolean;
}) {
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

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function toNum(v: unknown, fallback: number) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
/** Clamp Pr(A ∩ B) into the feasible window for the given Pr(A), Pr(B). */
function clampIntersection(pAB: number, pA: number, pB: number) {
  const lo = Math.max(0, pA + pB - 1);
  const hi = Math.min(pA, pB);
  return Math.max(lo, Math.min(hi, pAB));
}
