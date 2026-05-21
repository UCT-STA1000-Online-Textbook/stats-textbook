/**
 * Number-line visualisation of set-builder intervals.
 *
 * Two intervals P and Q sit on a shared number line with **draggable
 * endpoints** — drag an endpoint to move it, click it to toggle
 * open ↔ closed. The result row (P ∩ Q or P ∪ Q, per the selected mode)
 * **recomputes live** from whatever P and Q currently are, including the
 * empty-set case when they don't overlap and the two-piece case for a union
 * of disjoint intervals.
 *
 * Solid endpoint = closed (≤ / ≥ / value included);
 * hollow endpoint = open (< / > / value excluded).
 *
 * Mirrors Examples 6A and 7A from `m1-introducing-probability`. The `mode`
 * param selects which row the result shows on first mount.
 */

"use client";

import { useRef, useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { useSvgDrag, clampN } from "../useDrag";
import { VizGuide } from "../VizGuide";

type Mode = "P" | "Q" | "intersection" | "union";

/** A real interval: bounds plus whether each end is closed (inclusive). */
interface Iv {
  lo: number;
  hi: number;
  loC: boolean;
  hiC: boolean;
}

// --- Number-line geometry (viewBox units) ---
const X_MIN = -2;
const X_MAX = 24;
const SVG_W = 420;
const SVG_H = 232;
const PAD_X = 30;
const PX_PER_UNIT = (SVG_W - 2 * PAD_X) / (X_MAX - X_MIN);
const Y_P = 52; // P row
const Y_Q = 100; // Q row
const Y_AXIS = 170; // number line + result row
const TICKS = [0, 5, 10, 15, 20];

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_FAINT = "rgba(37, 99, 235, 0.30)";
const MUTED = "rgb(100, 116, 139)"; // slate-500

/** Maps a domain value to an SVG x coordinate. */
const xScale = (x: number) =>
  PAD_X + ((x - X_MIN) / (X_MAX - X_MIN)) * (SVG_W - 2 * PAD_X);

/** Intersection of two intervals — null when they don't overlap. */
function intersect(p: Iv, q: Iv): Iv | null {
  let lo: number, loC: boolean;
  if (p.lo > q.lo) [lo, loC] = [p.lo, p.loC];
  else if (q.lo > p.lo) [lo, loC] = [q.lo, q.loC];
  else [lo, loC] = [p.lo, p.loC && q.loC];

  let hi: number, hiC: boolean;
  if (p.hi < q.hi) [hi, hiC] = [p.hi, p.hiC];
  else if (q.hi < p.hi) [hi, hiC] = [q.hi, q.hiC];
  else [hi, hiC] = [p.hi, p.hiC && q.hiC];

  if (lo > hi) return null;
  if (lo === hi && !(loC && hiC)) return null; // single point, excluded
  return { lo, hi, loC, hiC };
}

/** True when `a` lies entirely below `b` with a genuine gap between them. */
function gapBelow(a: Iv, b: Iv): boolean {
  if (a.hi < b.lo) return true;
  // touching at one point — a gap only if neither side includes that point
  if (a.hi === b.lo) return !(a.hiC || b.loC);
  return false;
}

/** Union of two intervals — one merged piece, or two disjoint pieces. */
function union(p: Iv, q: Iv): Iv[] {
  if (gapBelow(p, q)) return [p, q];
  if (gapBelow(q, p)) return [q, p];
  let lo: number, loC: boolean;
  if (p.lo < q.lo) [lo, loC] = [p.lo, p.loC];
  else if (q.lo < p.lo) [lo, loC] = [q.lo, q.loC];
  else [lo, loC] = [p.lo, p.loC || q.loC];

  let hi: number, hiC: boolean;
  if (p.hi > q.hi) [hi, hiC] = [p.hi, p.hiC];
  else if (q.hi > p.hi) [hi, hiC] = [q.hi, q.hiC];
  else [hi, hiC] = [p.hi, p.hiC || q.hiC];

  return [{ lo, hi, loC, hiC }];
}

/** Set-builder string for an interval, e.g. "{x | 0 ≤ x < 10}". */
function exprOf(iv: Iv): string {
  const left = iv.loC ? "≤" : "<";
  const right = iv.hiC ? "≤" : "<";
  return `{x | ${iv.lo} ${left} x ${right} ${iv.hi}}`;
}

const MODE_LABELS: Record<Mode, string> = {
  P: "P",
  Q: "Q",
  intersection: "P ∩ Q",
  union: "P ∪ Q",
};

/**
 * @param params.mode — initial result shown; defaults to "P".
 */
export default function SetBuilderLine({ params }: { params: VizParams }) {
  const initialMode: Mode = isMode(params.mode) ? params.mode : "P";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [p, setP] = useState<Iv>({ lo: 0, hi: 10, loC: true, hiC: true });
  const [q, setQ] = useState<Iv>({ lo: 5, hi: 20, loC: false, hiC: false });

  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = useSvgDrag(svgRef);
  // Distinguishes a click (toggle open/closed) from a drag (move endpoint).
  const movedRef = useRef(false);

  /** Drag one endpoint along the line; values snap to whole numbers. */
  function dragEndpoint(
    e: React.PointerEvent,
    iv: Iv,
    setter: (v: Iv) => void,
    end: "lo" | "hi",
  ) {
    movedRef.current = false;
    const origin = iv[end];
    startDrag(e, (dx) => {
      movedRef.current = true;
      let v = Math.round(origin + dx / PX_PER_UNIT);
      v =
        end === "lo"
          ? clampN(v, X_MIN, iv.hi - 1)
          : clampN(v, iv.lo + 1, X_MAX);
      setter({ ...iv, [end]: v });
    });
  }

  /** Click (not drag) on an endpoint toggles closed ↔ open. */
  function toggleEndpoint(
    iv: Iv,
    setter: (v: Iv) => void,
    end: "lo" | "hi",
  ) {
    if (movedRef.current) return; // the press was a drag — ignore the click
    const key = end === "lo" ? "loC" : "hiC";
    setter({ ...iv, [key]: !iv[key] });
  }

  // Result row content depends on the mode.
  const result: Iv[] =
    mode === "P"
      ? [p]
      : mode === "Q"
        ? [q]
        : mode === "intersection"
          ? (intersect(p, q) ? [intersect(p, q) as Iv] : [])
          : union(p, q);

  const resultExpr =
    result.length === 0
      ? `${MODE_LABELS[mode]} = ∅ (the empty set)`
      : `${MODE_LABELS[mode]} = ${result.map(exprOf).join(" ∪ ")}`;

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {(["P", "Q", "intersection", "union"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              mode === m
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto max-h-[280px]"
        >
          {/* Draggable input intervals. */}
          <IntervalRow
            iv={p}
            y={Y_P}
            label="P"
            color={ACCENT}
            onDrag={(e, end) => dragEndpoint(e, p, setP, end)}
            onToggle={(end) => toggleEndpoint(p, setP, end)}
          />
          <IntervalRow
            iv={q}
            y={Y_Q}
            label="Q"
            color={ACCENT}
            onDrag={(e, end) => dragEndpoint(e, q, setQ, end)}
            onToggle={(end) => toggleEndpoint(q, setQ, end)}
          />

          {/* Number line */}
          <line
            x1={xScale(X_MIN) - 6}
            y1={Y_AXIS}
            x2={xScale(X_MAX) + 6}
            y2={Y_AXIS}
            stroke="rgb(15, 23, 42)"
            strokeWidth="1"
          />
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={xScale(t)}
                y1={Y_AXIS - 4}
                x2={xScale(t)}
                y2={Y_AXIS + 4}
                stroke="rgb(15, 23, 42)"
                strokeWidth="1"
              />
              <text
                x={xScale(t)}
                y={Y_AXIS + 20}
                textAnchor="middle"
                fontSize="11"
                fill={MUTED}
                className="tabular-nums"
              >
                {t}
              </text>
            </g>
          ))}

          {/* Live result on the number line. */}
          {result.length === 0 ? (
            <text
              x={SVG_W / 2}
              y={Y_AXIS - 14}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill={MUTED}
            >
              {MODE_LABELS[mode]} = ∅
            </text>
          ) : (
            result.map((iv, i) => (
              <ResultBar key={i} iv={iv} y={Y_AXIS} />
            ))
          )}
        </svg>
      </div>

      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            {MODE_LABELS[mode]}
          </p>
          <VizGuide
            steps={[
              "Drag an endpoint to slide it along the number line.",
              "Click an endpoint to switch it between included (solid) and excluded (hollow).",
              "Pick P, Q, P∩Q or P∪Q to show that set on the line.",
            ]}
          />
        </div>
        <p className="mt-0.5 font-mono text-[12.5px] leading-relaxed text-[color:var(--color-ink-900)]">
          {resultExpr}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">
          Solid endpoint = included (≤ / ≥); hollow = excluded (&lt; / &gt;).
        </p>
      </div>
    </div>
  );
}

/** A draggable interval: faint band, accent bar, two endpoint handles. */
function IntervalRow({
  iv,
  y,
  label,
  color,
  onDrag,
  onToggle,
}: {
  iv: Iv;
  y: number;
  label: string;
  color: string;
  onDrag: (e: React.PointerEvent, end: "lo" | "hi") => void;
  onToggle: (end: "lo" | "hi") => void;
}) {
  const xL = xScale(iv.lo);
  const xH = xScale(iv.hi);
  return (
    <g>
      <text
        x={PAD_X - 18}
        y={y + 4}
        fontSize="12"
        fontWeight="700"
        fill={color}
      >
        {label}
      </text>
      <rect x={xL} y={y - 9} width={xH - xL} height={18} fill={ACCENT_FAINT} />
      <line x1={xL} y1={y} x2={xH} y2={y} stroke={color} strokeWidth="3" />
      <Endpoint cx={xL} cy={y} closed={iv.loC} color={color} draggable
        onDrag={(e) => onDrag(e, "lo")} onToggle={() => onToggle("lo")} />
      <Endpoint cx={xH} cy={y} closed={iv.hiC} color={color} draggable
        onDrag={(e) => onDrag(e, "hi")} onToggle={() => onToggle("hi")} />
    </g>
  );
}

/** The computed result interval, drawn on the number line. */
function ResultBar({ iv, y }: { iv: Iv; y: number }) {
  const xL = xScale(iv.lo);
  const xH = xScale(iv.hi);
  return (
    <g>
      <rect x={xL} y={y - 9} width={xH - xL} height={18} fill={ACCENT_FAINT} />
      <line x1={xL} y1={y} x2={xH} y2={y} stroke={ACCENT} strokeWidth="3" />
      <Endpoint cx={xL} cy={y} closed={iv.loC} color={ACCENT} />
      <Endpoint cx={xH} cy={y} closed={iv.hiC} color={ACCENT} />
    </g>
  );
}

/**
 * Solid (closed) or hollow (open) endpoint marker. When `draggable`, the whole
 * marker is a drag handle and a plain click toggles its open/closed state.
 */
function Endpoint({
  cx,
  cy,
  closed,
  color,
  draggable = false,
  onDrag,
  onToggle,
}: {
  cx: number;
  cy: number;
  closed: boolean;
  color: string;
  draggable?: boolean;
  onDrag?: (e: React.PointerEvent) => void;
  onToggle?: () => void;
}) {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={closed ? color : "white"}
        stroke={color}
        strokeWidth="1.75"
      />
      {draggable && (
        // Larger transparent hit target for comfortable dragging on touch.
        <circle
          cx={cx}
          cy={cy}
          r={13}
          fill="transparent"
          style={{ cursor: "grab", touchAction: "none" }}
          onPointerDown={onDrag}
          onClick={onToggle}
        />
      )}
    </g>
  );
}

function isMode(v: unknown): v is Mode {
  return (
    typeof v === "string" &&
    ["P", "Q", "intersection", "union"].includes(v)
  );
}
