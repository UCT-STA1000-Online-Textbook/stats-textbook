/**
 * Two-set Venn diagram explorer.
 *
 * Renders a sample space S containing two **draggable** circles A and B. Only
 * the region picked out by the current operation is shaded — everything else
 * is left blank — so even compound complements stay easy to read. The shaded
 * region recomputes live as the circles are dragged.
 *
 * Every region is drawn as a path computed from the live circle geometry (the
 * intersection lens is sampled as a polygon). Nothing depends on SVG masks, so
 * the shading always follows a drag — whichever circle moves.
 *
 * A scatter of fixed sample-space "elements" shows which dots fall inside the
 * highlighted set, with a running count.
 *
 * Used in `m1-introducing-probability`; the `mode` param is the contract for
 * the set-theory `<KeywordChip>` cross-links (see
 * `memory/project_wu1_review_comments.md`).
 */

"use client";

import { useState, useRef, type ReactNode } from "react";
import type { VizParams } from "@/store/vizStore";
import { useSvgDrag, clampN } from "../useDrag";
import { VizGuide } from "../VizGuide";

type Mode =
  | "A"
  | "B"
  | "intersection"
  | "union"
  | "A-only"
  | "complement-A"
  | "complement-intersection"
  | "neither"
  | "symmetric-difference"
  | "mutually-exclusive"
  | "subset"
  | "universal-set";

/** The four disjoint regions a two-set diagram splits the sample space into. */
type Region = "aOnly" | "bOnly" | "lens" | "neither";

interface ModeMeta {
  key: Mode;
  /** Inline label for the toolbar button. */
  label: ReactNode;
  /** Mathematical expression shown in the summary. */
  expr: ReactNode;
  desc: string;
  /** The regions this operation picks out — the ones that get shaded. */
  highlight: Region[];
}

/**
 * Renders a horizontal bar that spans every character it wraps. Use for any
 * compound complement like `\overline{A \cup B}` — the Unicode combining
 * macron only attaches to a single preceding character.
 */
function Bar({ children }: { children: ReactNode }) {
  return <span className="overline">{children}</span>;
}

const MODES: ModeMeta[] = [
  { key: "A", label: "A", expr: "A", desc: "All elements in A.", highlight: ["aOnly", "lens"] },
  { key: "B", label: "B", expr: "B", desc: "All elements in B.", highlight: ["bOnly", "lens"] },
  {
    key: "intersection",
    label: "A ∩ B",
    expr: "A ∩ B",
    desc: "Elements that belong to both A and B.",
    highlight: ["lens"],
  },
  {
    key: "union",
    label: "A ∪ B",
    expr: "A ∪ B",
    desc: "Elements in A, in B, or in both.",
    highlight: ["aOnly", "bOnly", "lens"],
  },
  {
    key: "A-only",
    label: (
      <>
        A ∩ <Bar>B</Bar>
      </>
    ),
    expr: (
      <>
        A ∩ <Bar>B</Bar>
      </>
    ),
    desc: "Elements in A but not in B.",
    highlight: ["aOnly"],
  },
  {
    key: "complement-A",
    label: <Bar>A</Bar>,
    expr: <Bar>A</Bar>,
    desc: "Elements of S that are not in A.",
    highlight: ["bOnly", "neither"],
  },
  {
    key: "complement-intersection",
    label: <Bar>A ∩ B</Bar>,
    expr: <Bar>A ∩ B</Bar>,
    desc: "Everything except the intersection.",
    highlight: ["aOnly", "bOnly", "neither"],
  },
  {
    key: "neither",
    label: (
      <>
        <Bar>A</Bar> ∩ <Bar>B</Bar>
      </>
    ),
    expr: (
      <>
        <Bar>A</Bar> ∩ <Bar>B</Bar> = <Bar>A ∪ B</Bar>
      </>
    ),
    desc: "Elements in neither A nor B (De Morgan).",
    highlight: ["neither"],
  },
  {
    key: "symmetric-difference",
    label: "Sym. diff.",
    expr: "(A ∪ B) ∖ (A ∩ B)",
    desc: "Elements in exactly one of A or B.",
    highlight: ["aOnly", "bOnly"],
  },
  {
    key: "mutually-exclusive",
    label: "Mut. excl.",
    expr: "A ∩ B = ∅",
    desc: "Mutually exclusive sets — drag the circles apart so they share nothing.",
    highlight: ["aOnly", "bOnly"],
  },
  {
    key: "subset",
    label: "Subset",
    expr: "B ⊂ A",
    desc: "Every element of B also belongs to A. Drag the smaller circle B fully inside A.",
    highlight: ["lens"],
  },
  {
    key: "universal-set",
    label: "S & ∅",
    expr: "S and ∅",
    desc: "S is the universal set — it contains every element under consideration. ∅ is the empty set, which contains no elements.",
    highlight: ["aOnly", "bOnly", "lens", "neither"],
  },
];

// --- SVG geometry (viewBox units) ---
const S = { x: 18, y: 18, w: 364, h: 224 };
const R = 74; // radius of A, and of B except in subset mode
const SUBSET_R = 34; // radius of B in subset mode

const PAPER = "rgb(248, 250, 252)"; // sample-space background
const HIGHLIGHT = "rgb(37, 99, 235)"; // blue-600 — the one shading colour
const HIGHLIGHT_OP = 0.32;

/** Fixed sample-space elements. Membership is recomputed live as A/B move. */
const ELEMENTS: Point[] = [
  { x: 122, y: 106 },
  { x: 130, y: 168 },
  { x: 192, y: 110 },
  { x: 200, y: 132 },
  { x: 205, y: 166 },
  { x: 272, y: 108 },
  { x: 280, y: 164 },
  { x: 52, y: 52 },
  { x: 350, y: 210 },
];

interface Point {
  x: number;
  y: number;
}

/** Canonical circle placement for a mode — the student can then drag freely. */
function layoutFor(mode: Mode): { a: Point; b: Point } {
  if (mode === "mutually-exclusive")
    return { a: { x: 110, y: 130 }, b: { x: 290, y: 130 } };
  if (mode === "subset") return { a: { x: 180, y: 130 }, b: { x: 180, y: 118 } };
  return { a: { x: 165, y: 130 }, b: { x: 235, y: 130 } };
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** A full circle as an SVG path (two half-arcs). */
function circlePath(c: Point, r: number) {
  return `M ${c.x - r} ${c.y} A ${r} ${r} 0 1 0 ${c.x + r} ${c.y} A ${r} ${r} 0 1 0 ${c.x - r} ${c.y} Z`;
}

/**
 * Samples one arc of `center`/`r` from `from` to `to`, choosing the way round
 * whose midpoint lies inside the circle (`insideC`, `insideR`) — i.e. the arc
 * that bounds the lens.
 */
function sampleArc(
  center: Point,
  r: number,
  from: Point,
  to: Point,
  insideC: Point,
  insideR: number,
): Point[] {
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  const a1 = Math.atan2(to.y - center.y, to.x - center.x);
  let delta = a1 - a0;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  const midX = center.x + r * Math.cos(a0 + delta / 2);
  const midY = center.y + r * Math.sin(a0 + delta / 2);
  if (Math.hypot(midX - insideC.x, midY - insideC.y) > insideR) {
    delta = delta > 0 ? delta - 2 * Math.PI : delta + 2 * Math.PI;
  }
  const n = 30;
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + (delta * i) / n;
    pts.push({ x: center.x + r * Math.cos(t), y: center.y + r * Math.sin(t) });
  }
  return pts;
}

/** SVG path for the lens A∩B — empty string when the circles don't overlap. */
function lensPath(cA: Point, rA: number, cB: Point, rB: number): string {
  const d = dist(cA, cB);
  if (d >= rA + rB) return ""; // disjoint
  if (d <= Math.abs(rA - rB)) {
    // One circle contains the other → the lens is the smaller circle.
    return rA <= rB ? circlePath(cA, rA) : circlePath(cB, rB);
  }
  const dx = cB.x - cA.x;
  const dy = cB.y - cA.y;
  const a = (rA * rA - rB * rB + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, rA * rA - a * a));
  const xm = cA.x + (a * dx) / d;
  const ym = cA.y + (a * dy) / d;
  const ox = (-dy / d) * h;
  const oy = (dx / d) * h;
  const p0 = { x: xm + ox, y: ym + oy };
  const p1 = { x: xm - ox, y: ym - oy };
  const arcA = sampleArc(cA, rA, p0, p1, cB, rB);
  const arcB = sampleArc(cB, rB, p1, p0, cA, rA);
  const pts = [...arcA, ...arcB];
  return (
    "M " +
    pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ") +
    " Z"
  );
}

/**
 * Interactive Venn explorer.
 *
 * @param params.mode — initial highlighted region; defaults to "intersection".
 *   Unrecognised values fall back to "intersection".
 */
export default function VennDiagram({ params }: { params: VizParams }) {
  const initialMode: Mode = isMode(params.mode) ? params.mode : "intersection";
  const [mode, setMode] = useState<Mode>(initialMode);

  const initialLayout = layoutFor(initialMode);
  const [cA, setCA] = useState<Point>(initialLayout.a);
  const [cB, setCB] = useState<Point>(initialLayout.b);

  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = useSvgDrag(svgRef);

  // In subset mode B is drawn smaller so it can sit fully inside A.
  const subsetMode = mode === "subset";
  const rB = subsetMode ? SUBSET_R : R;

  /** Switch mode and snap the circles to that mode's canonical layout. */
  function selectMode(m: Mode) {
    setMode(m);
    const layout = layoutFor(m);
    setCA(layout.a);
    setCB(layout.b);
  }

  /** Begin dragging a circle; its centre is clamped to keep it inside S. */
  function dragCircle(e: React.PointerEvent, which: "a" | "b") {
    const origin = which === "a" ? cA : cB;
    const setter = which === "a" ? setCA : setCB;
    const radius = which === "a" ? R : rB;
    startDrag(e, (dx, dy) => {
      setter({
        x: clampN(origin.x + dx, S.x + radius, S.x + S.w - radius),
        y: clampN(origin.y + dy, S.y + radius, S.y + S.h - radius),
      });
    });
  }

  const active = MODES.find((m) => m.key === mode) ?? MODES[0];
  const lit = new Set<Region>(active.highlight);

  // Region paths from the live geometry. A-only / B-only are a circle with the
  // lens punched out (even-odd fill); the lens is its own polygon.
  const lens = lensPath(cA, R, cB, rB);
  const aOnlyPath = circlePath(cA, R) + (lens ? " " + lens : "");
  const bOnlyPath = circlePath(cB, rB) + (lens ? " " + lens : "");

  // Live region membership of each element, and how many fall in the
  // highlighted set.
  let nHighlighted = 0;
  const dots = ELEMENTS.map((p) => {
    const inA = dist(p, cA) <= R;
    const inB = dist(p, cB) <= rB;
    let region: Region = "neither";
    if (inA && inB) region = "lens";
    else if (inA) region = "aOnly";
    else if (inB) region = "bOnly";
    const inHighlight = lit.has(region);
    if (inHighlight) nHighlighted++;
    return { ...p, inHighlight };
  });

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => selectMode(m.key)}
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
        <svg
          ref={svgRef}
          viewBox="0 0 400 260"
          className="w-full h-auto max-h-[300px]"
        >
          {/* Sample-space box. */}
          <rect
            x={S.x}
            y={S.y}
            width={S.w}
            height={S.h}
            rx="8"
            fill={PAPER}
            stroke="rgb(15, 23, 42)"
            strokeWidth="1.5"
          />
          <text
            x="370"
            y="36"
            textAnchor="end"
            fontSize="13"
            fontStyle="italic"
            fontWeight="600"
            fill="rgb(71, 85, 105)"
          >
            S
          </text>

          {/* The highlighted set, in one colour; everything else stays blank.
              When "neither" is part of it, shade the whole box and punch out
              the regions that are NOT highlighted with the paper colour. */}
          {lit.has("neither") ? (
            <>
              <rect
                x={S.x}
                y={S.y}
                width={S.w}
                height={S.h}
                rx="8"
                fill={HIGHLIGHT}
                fillOpacity={HIGHLIGHT_OP}
              />
              {!lit.has("aOnly") && (
                <path d={aOnlyPath} fillRule="evenodd" fill={PAPER} />
              )}
              {!lit.has("bOnly") && (
                <path d={bOnlyPath} fillRule="evenodd" fill={PAPER} />
              )}
              {!lit.has("lens") && lens && <path d={lens} fill={PAPER} />}
            </>
          ) : (
            <>
              {lit.has("aOnly") && (
                <path
                  d={aOnlyPath}
                  fillRule="evenodd"
                  fill={HIGHLIGHT}
                  fillOpacity={HIGHLIGHT_OP}
                />
              )}
              {lit.has("bOnly") && (
                <path
                  d={bOnlyPath}
                  fillRule="evenodd"
                  fill={HIGHLIGHT}
                  fillOpacity={HIGHLIGHT_OP}
                />
              )}
              {lit.has("lens") && lens && (
                <path d={lens} fill={HIGHLIGHT} fillOpacity={HIGHLIGHT_OP} />
              )}
            </>
          )}

          {/* Circle outlines (always shown so the structure is legible). */}
          <circle
            cx={cA.x}
            cy={cA.y}
            r={R}
            fill="none"
            stroke="rgb(15, 23, 42)"
            strokeWidth="1.5"
          />
          <circle
            cx={cB.x}
            cy={cB.y}
            r={rB}
            fill="none"
            stroke="rgb(15, 23, 42)"
            strokeWidth="1.5"
          />

          {/* Sample-space elements: solid when inside the highlighted set,
              hollow when outside it. */}
          {dots.map((d, i) =>
            d.inHighlight ? (
              <circle key={i} cx={d.x} cy={d.y} r={5} fill={HIGHLIGHT} />
            ) : (
              <circle
                key={i}
                cx={d.x}
                cy={d.y}
                r={4}
                fill="white"
                stroke="rgb(148, 163, 184)"
                strokeWidth="1.5"
              />
            ),
          )}

          {/* Set labels just inside each circle's upper edge. */}
          <text
            x={cA.x - R + 12}
            y={cA.y - R + 22}
            fontSize="14"
            fontWeight="700"
            fill="rgb(15, 23, 42)"
            pointerEvents="none"
          >
            A
          </text>
          <text
            x={subsetMode ? cB.x - rB + 8 : cB.x + R - 22}
            y={subsetMode ? cB.y - rB + 14 : cB.y - R + 22}
            fontSize={subsetMode ? "12" : "14"}
            fontWeight="700"
            fill="rgb(15, 23, 42)"
            pointerEvents="none"
          >
            B
          </text>

          {/* Transparent drag handles, last so they receive the pointer. */}
          <circle
            cx={cA.x}
            cy={cA.y}
            r={R}
            fill="transparent"
            style={{ cursor: "grab", touchAction: "none" }}
            onPointerDown={(e) => dragCircle(e, "a")}
          />
          <circle
            cx={cB.x}
            cy={cB.y}
            r={rB}
            fill="transparent"
            style={{ cursor: "grab", touchAction: "none" }}
            onPointerDown={(e) => dragCircle(e, "b")}
          />
        </svg>
      </div>

      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            Highlighting
          </p>
          <VizGuide
            steps={[
              "Drag circle A or B — the shaded region updates as you move them.",
              "Pick an operation above; only the region it refers to is shaded.",
              "A dot is solid when it falls inside the highlighted region, hollow when it doesn't.",
            ]}
          />
        </div>
        <p className="mt-0.5 font-mono text-[14px] text-[color:var(--color-ink-900)]">
          {active.expr}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          {active.desc}
        </p>
        <p className="mt-1.5 text-[12px] font-medium text-blue-700">
          {nHighlighted} of {ELEMENTS.length} sample elements are highlighted.
        </p>
      </div>
    </div>
  );
}

/** Type guard so we can safely consume the loosely-typed `params.mode`. */
function isMode(v: unknown): v is Mode {
  return (
    typeof v === "string" &&
    [
      "A",
      "B",
      "intersection",
      "union",
      "A-only",
      "complement-A",
      "complement-intersection",
      "neither",
      "symmetric-difference",
      "mutually-exclusive",
      "subset",
      "universal-set",
    ].includes(v)
  );
}
