/**
 * Two-set Venn diagram explorer.
 *
 * Renders a sample space S containing two overlapping circles A and B, with a
 * mode selector that highlights any of the standard set-theory regions: A,
 * B, A∩B, A∪B, A∩B̄, Ā, (A∩B)̄, neither, symmetric difference, and a
 * disjoint (mutually exclusive) configuration.
 *
 * Region shading is composed entirely with SVG masks — each highlight is a
 * shape clipped/inverted by another circle, which keeps the geometry exact
 * and avoids hand-computed lens paths.
 *
 * Used in `m1-introducing-probability` to satisfy Leanne Scott's request
 * (recorded in `memory/project_wu1_review_comments.md`) for visual
 * cross-links from the set-theory concept list.
 */

"use client";

import { useState, type ReactNode } from "react";
import type { VizParams } from "@/store/vizStore";

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

interface ModeMeta {
  key: Mode;
  /** Inline label for the toolbar button. */
  label: ReactNode;
  /** Mathematical expression shown in the highlighting summary. */
  expr: ReactNode;
  desc: string;
}

/**
 * Renders a horizontal bar that spans every character it wraps. Use for any
 * compound complement like `\overline{A \cup B}` — the Unicode combining
 * macron only attaches to a single preceding character, which is why we
 * can't just write "(A ∪ B)̄" inline.
 */
function Bar({ children }: { children: ReactNode }) {
  return <span className="overline">{children}</span>;
}

const MODES: ModeMeta[] = [
  { key: "A", label: "A", expr: "A", desc: "All elements in A." },
  { key: "B", label: "B", expr: "B", desc: "All elements in B." },
  {
    key: "intersection",
    label: "A ∩ B",
    expr: "A ∩ B",
    desc: "Elements that belong to both A and B.",
  },
  {
    key: "union",
    label: "A ∪ B",
    expr: "A ∪ B",
    desc: "Elements in A, in B, or in both.",
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
  },
  {
    key: "complement-A",
    label: <Bar>A</Bar>,
    expr: <Bar>A</Bar>,
    desc: "Elements of S that are not in A.",
  },
  {
    key: "complement-intersection",
    label: <Bar>A ∩ B</Bar>,
    expr: <Bar>A ∩ B</Bar>,
    desc: "Everything except the intersection.",
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
  },
  {
    key: "symmetric-difference",
    label: "Sym. diff.",
    expr: "(A ∪ B) ∖ (A ∩ B)",
    desc: "Elements in exactly one of A or B.",
  },
  {
    key: "mutually-exclusive",
    label: "Mut. excl.",
    expr: "A ∩ B = ∅",
    desc: "Mutually exclusive sets — no overlap.",
  },
  {
    key: "subset",
    label: "Subset",
    expr: "B ⊂ A",
    desc: "Every element of B also belongs to A. The smaller circle lies entirely within A.",
  },
  {
    key: "universal-set",
    label: "S & ∅",
    expr: "S and ∅",
    desc: "S is the universal set — it contains every element under consideration. ∅ is the empty set, which contains no elements.",
  },
];

/**
 * Interactive Venn explorer.
 *
 * @param params.mode — initial highlighted region; defaults to "intersection".
 *   Accepts any value of the local `Mode` union; unrecognised values are
 *   silently ignored on the initial mount.
 */
export default function VennDiagram({ params }: { params: VizParams }) {
  const initialMode: Mode = isMode(params.mode) ? params.mode : "intersection";
  const [mode, setMode] = useState<Mode>(initialMode);

  // VizPanel re-keys this component on params change, so the initial mode
  // stays in sync with TryThis without a useEffect.

  // Slide the circles apart for the disjoint visual. Everything else uses
  // the overlapping default layout.
  const cAy = 130;
  const cBy = 130;
  const r = 78;
  const cAx = mode === "mutually-exclusive" ? 110 : 165;
  const cBx = mode === "mutually-exclusive" ? 290 : 235;
  // In subset mode B is drawn as a small circle inside A to illustrate B ⊂ A.
  const subsetMode = mode === "subset";
  const bRenderX = subsetMode ? 175 : cBx;
  const bRenderY = subsetMode ? 118 : cBy;
  const bRenderR = subsetMode ? 30 : r;

  const FILL = "rgb(37, 99, 235)"; // blue-600
  const FILL_OP = 0.32;

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
        <svg viewBox="0 0 400 260" className="w-full h-auto max-h-[300px]">
          <defs>
            {/* Reusable masks. "InsideX" passes only the disk of X; "OutsideX"
                passes everything except X. Recursive composition (mask of
                circle B inside mask InsideA) gives us the lens cleanly. */}
            <mask id="vd-maskInsideA">
              <rect width="400" height="260" fill="black" />
              <circle cx={cAx} cy={cAy} r={r} fill="white" />
            </mask>
            <mask id="vd-maskOutsideA">
              <rect width="400" height="260" fill="white" />
              <circle cx={cAx} cy={cAy} r={r} fill="black" />
            </mask>
            <mask id="vd-maskOutsideB">
              <rect width="400" height="260" fill="white" />
              <circle cx={cBx} cy={cBy} r={r} fill="black" />
            </mask>
            <mask id="vd-maskOutsideLens">
              <rect width="400" height="260" fill="white" />
              <g mask="url(#vd-maskInsideA)">
                <circle cx={cBx} cy={cBy} r={r} fill="black" />
              </g>
            </mask>
            <mask id="vd-maskNeither">
              <rect width="400" height="260" fill="white" />
              <circle cx={cAx} cy={cAy} r={r} fill="black" />
              <circle cx={cBx} cy={cBy} r={r} fill="black" />
            </mask>
          </defs>

          {/* Sample-space rectangle */}
          <rect
            x="18"
            y="18"
            width="364"
            height="224"
            rx="8"
            fill="rgb(248, 250, 252)"
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

          {/* Region highlights */}
          {mode === "A" && (
            <circle cx={cAx} cy={cAy} r={r} fill={FILL} fillOpacity={FILL_OP} />
          )}
          {mode === "B" && (
            <circle cx={cBx} cy={cBy} r={r} fill={FILL} fillOpacity={FILL_OP} />
          )}
          {mode === "union" && (
            <>
              <circle cx={cAx} cy={cAy} r={r} fill={FILL} fillOpacity={FILL_OP} />
              <circle cx={cBx} cy={cBy} r={r} fill={FILL} fillOpacity={FILL_OP} />
            </>
          )}
          {mode === "intersection" && (
            <circle
              cx={cBx}
              cy={cBy}
              r={r}
              fill={FILL}
              fillOpacity={FILL_OP}
              mask="url(#vd-maskInsideA)"
            />
          )}
          {mode === "A-only" && (
            <circle
              cx={cAx}
              cy={cAy}
              r={r}
              fill={FILL}
              fillOpacity={FILL_OP}
              mask="url(#vd-maskOutsideB)"
            />
          )}
          {mode === "complement-A" && (
            <rect
              x="18"
              y="18"
              width="364"
              height="224"
              rx="8"
              fill={FILL}
              fillOpacity={FILL_OP}
              mask="url(#vd-maskOutsideA)"
            />
          )}
          {mode === "complement-intersection" && (
            <rect
              x="18"
              y="18"
              width="364"
              height="224"
              rx="8"
              fill={FILL}
              fillOpacity={FILL_OP}
              mask="url(#vd-maskOutsideLens)"
            />
          )}
          {mode === "neither" && (
            <rect
              x="18"
              y="18"
              width="364"
              height="224"
              rx="8"
              fill={FILL}
              fillOpacity={FILL_OP}
              mask="url(#vd-maskNeither)"
            />
          )}
          {mode === "symmetric-difference" && (
            <>
              <circle
                cx={cAx}
                cy={cAy}
                r={r}
                fill={FILL}
                fillOpacity={FILL_OP}
                mask="url(#vd-maskOutsideB)"
              />
              <circle
                cx={cBx}
                cy={cBy}
                r={r}
                fill={FILL}
                fillOpacity={FILL_OP}
                mask="url(#vd-maskOutsideA)"
              />
            </>
          )}
          {/* mutually-exclusive renders only the outlines below — no shading. */}
          {mode === "subset" && (
            <circle cx={bRenderX} cy={bRenderY} r={bRenderR} fill={FILL} fillOpacity={FILL_OP} />
          )}
          {mode === "universal-set" && (
            <rect x="18" y="18" width="364" height="224" rx="8" fill={FILL} fillOpacity={FILL_OP} />
          )}

          {/* Circle outlines (always shown so the structure is legible) */}
          <circle
            cx={cAx}
            cy={cAy}
            r={r}
            fill="none"
            stroke="rgb(15, 23, 42)"
            strokeWidth="1.5"
          />
          <circle
            cx={bRenderX}
            cy={bRenderY}
            r={bRenderR}
            fill="none"
            stroke="rgb(15, 23, 42)"
            strokeWidth="1.5"
          />

          {/* Set labels positioned just inside each circle's upper edge. */}
          <text
            x={cAx - r + 12}
            y={cAy - r + 22}
            fontSize="14"
            fontWeight="700"
            fill="rgb(15, 23, 42)"
          >
            A
          </text>
          <text
            x={subsetMode ? bRenderX - bRenderR + 8 : cBx + r - 22}
            y={subsetMode ? bRenderY - bRenderR + 14 : cBy - r + 22}
            fontSize={subsetMode ? "12" : "14"}
            fontWeight="700"
            fill="rgb(15, 23, 42)"
          >
            B
          </text>
        </svg>
      </div>

      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
          Highlighting
        </p>
        <p className="mt-0.5 font-mono text-[14px] text-[color:var(--color-ink-900)]">
          {active.expr}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          {active.desc}
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
