/**
 * Bayes Frequency Grid — conditional probability and Bayes' theorem shown as
 * counts of a real population (the "natural frequencies" approach), rather
 * than as areas.
 *
 * A population of 250 television sets is drawn as a grid of icons, each
 * coloured by where its tube was made (in-house vs bought-in) and outlined in
 * red if the tube is defective — the scenario of WU4's Example 49B. Three
 * sliders set the prior Pr(C) and the two defect rates Pr(D|C), Pr(D|C̄);
 * counts are rounded to whole sets so the picture is always exact integers.
 *
 * Clicking a category chip *conditions* the population: the grid dims every
 * set outside that subgroup, and the readout reports the conditional
 * probability of the other attribute as a fraction of the survivors.
 * Conditioning on "defective" versus "in-house" yields visibly different
 * fractions — the Pr(A|B) ≠ Pr(B|A) asymmetry that motivates Bayes' theorem.
 * A panel mirrors the Bayes-theorem computation with the live counts.
 *
 * Default-tier viz: lightweight 2D SVG, no heavy dependencies.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";

/**
 * Population size. 250 = 25 × 10, and divides so that Example 49B's rates
 * (0.8, 0.06, 0.08) land on whole-set counts — giving an exact Pr(C|D) = 0.75.
 */
const N = 250;
const COLS = 25;
const ROWS = N / COLS; // 10

// --- SVG cell geometry (viewBox units) ---
const CELL = 12;
const GAP = 4;
const PITCH = CELL + GAP;
const PAD = 3;
const VB_W = COLS * PITCH - GAP + 2 * PAD;
const VB_H = ROWS * PITCH - GAP + 2 * PAD;

const BLUE = "rgb(37, 99, 235)"; // made in-house (C)
const AMBER = "rgb(217, 119, 6)"; // bought in (C̄)
const RED = "rgb(220, 38, 38)"; // defective outline (D)

/** Which subgroup the grid is currently conditioned on. */
type Condition = "none" | "inhouse" | "bought" | "defective" | "ok";

/**
 * @param params.pc     — initial prior Pr(C), the in-house fraction. Default 0.8.
 * @param params.pdc    — initial Pr(D|C), the in-house defect rate. Default 0.06.
 * @param params.pdcbar — initial Pr(D|C̄), the bought-in defect rate. Default 0.08.
 */
export default function BayesGrid({ params }: { params: VizParams }) {
  const [pC, setPC] = useState(clamp01(toNum(params.pc, 0.8)));
  const [pDC, setPDC] = useState(clamp01(toNum(params.pdc, 0.06)));
  const [pDCbar, setPDCbar] = useState(clamp01(toNum(params.pdcbar, 0.08)));
  const [condition, setCondition] = useState<Condition>("none");

  // Whole-set counts. Everything downstream is derived from these integers,
  // so the grid and every readout always agree to the last set.
  const nC = Math.round(N * pC); // made in-house
  const nCbar = N - nC; // bought in
  const defC = Math.round(nC * pDC); // in-house & defective
  const defCbar = Math.round(nCbar * pDCbar); // bought & defective
  const okC = nC - defC;
  const okCbar = nCbar - defCbar;
  const defTotal = defC + defCbar;
  const okTotal = okC + okCbar;

  /** Source + condition of cell `i`, given the defective-first ordering. */
  function cellOf(i: number) {
    const inhouse = i < nC;
    const defective = inhouse ? i < defC : i - nC < defCbar;
    return { inhouse, defective };
  }

  /** Whether cell `i` survives the active conditioning. */
  function survives(inhouse: boolean, defective: boolean) {
    switch (condition) {
      case "inhouse":
        return inhouse;
      case "bought":
        return !inhouse;
      case "defective":
        return defective;
      case "ok":
        return !defective;
      default:
        return true;
    }
  }

  // The conditional probability the current conditioning asks for. Conditioning
  // on a source asks "what fraction is defective?"; conditioning on a test
  // result asks "what fraction is in-house?".
  const readout = readoutFor(condition, {
    nC,
    nCbar,
    defC,
    defCbar,
    okC,
    defTotal,
    okTotal,
  });

  // Bayes' theorem for Pr(C | D), in the natural-frequency form: of every
  // defective set, the share that was made in-house.
  const prCgivenD = defTotal > 0 ? defC / defTotal : 0;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-[color:var(--color-ink-500)]">
          A batch of <span className="font-semibold">{N}</span> television sets.
        </p>
        <VizGuide
          steps={[
            "Each square is one TV — blue if its tube was made in-house, amber if bought in.",
            "A red outline marks a defective tube.",
            "Drag the sliders to change the in-house share and the two defect rates.",
            "Click a category below to condition: the grid keeps only that subgroup and reads off the conditional probability.",
            "Compare 'Defective' with 'In-house' — the two fractions differ. That gap is what Bayes' theorem resolves.",
          ]}
        />
      </div>

      <div className="space-y-2">
        <Slider label="Pr(C) — made in-house" value={pC} onChange={setPC} />
        <Slider label="Pr(D | C) — in-house defect rate" value={pDC} onChange={setPDC} />
        <Slider label="Pr(D | C̄) — bought-in defect rate" value={pDCbar} onChange={setPDCbar} />
      </div>

      <div className="flex items-center justify-center">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full max-w-[420px]">
          {Array.from({ length: N }, (_, i) => {
            const { inhouse, defective } = cellOf(i);
            const lit = survives(inhouse, defective);
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            return (
              <rect
                key={i}
                x={PAD + col * PITCH}
                y={PAD + row * PITCH}
                width={CELL}
                height={CELL}
                rx={2.5}
                fill={inhouse ? BLUE : AMBER}
                fillOpacity={lit ? 0.9 : 0.12}
                stroke={defective ? RED : "transparent"}
                strokeWidth={defective ? 2 : 0}
                strokeOpacity={lit ? 1 : 0.18}
              />
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[color:var(--color-ink-500)]">
        <Swatch fill={BLUE}>In-house ({nC})</Swatch>
        <Swatch fill={AMBER}>Bought in ({nCbar})</Swatch>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-[3px] border-2"
            style={{ borderColor: RED }}
          />
          Defective ({defTotal})
        </span>
      </div>

      {/* Condition chips */}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-500)]">
          Condition on…
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={condition === "none"} onClick={() => setCondition("none")}>
            Whole batch
          </Chip>
          <Chip
            active={condition === "inhouse"}
            onClick={() => setCondition("inhouse")}
          >
            In-house
          </Chip>
          <Chip
            active={condition === "bought"}
            onClick={() => setCondition("bought")}
          >
            Bought in
          </Chip>
          <Chip
            active={condition === "defective"}
            onClick={() => setCondition("defective")}
          >
            Defective
          </Chip>
          <Chip active={condition === "ok"} onClick={() => setCondition("ok")}>
            Working
          </Chip>
        </div>
      </div>

      {/* Readout for the active conditioning */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2 text-[12px] leading-relaxed text-[color:var(--color-ink-700)]">
        {readout ? (
          <>
            <p>{readout.sentence}</p>
            <p className="mt-1 font-mono">
              {readout.expr} ={" "}
              <span className="font-semibold">
                {readout.den > 0 ? `${readout.num} / ${readout.den}` : "—"}
              </span>{" "}
              ={" "}
              <span className="font-semibold text-blue-700 tabular-nums">
                {readout.den > 0 ? (readout.num / readout.den).toFixed(2) : "undefined"}
              </span>
            </p>
          </>
        ) : (
          <p>
            Pick a category above to keep only that subgroup of the batch and
            read off a conditional probability.
          </p>
        )}
      </div>

      {/* Bayes' theorem — Pr(C | D) in natural-frequency form */}
      <div className="rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-[12px] text-[color:var(--color-ink-700)]">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
          Bayes&apos; theorem · Pr(C | D)
        </p>
        <p className="font-mono leading-relaxed">
          Pr(C | D) ={" "}
          <span className="whitespace-nowrap">
            (defective &amp; in-house) / (all defective)
          </span>
        </p>
        <p className="mt-0.5 font-mono">
          = {defC} / ({defC} + {defCbar}) ={" "}
          <span className="font-semibold text-indigo-700 tabular-nums">
            {defTotal > 0 ? prCgivenD.toFixed(2) : "undefined"}
          </span>
        </p>
        <p className="mt-1.5 text-[11px] text-[color:var(--color-ink-500)]">
          Conditioning swaps the question: Pr(in-house | defective) is{" "}
          <span className="font-semibold">not</span> the same as
          Pr(defective | in-house). Click both chips above to see the gap.
        </p>
      </div>
    </div>
  );
}

/** Counts the active conditioning needs, packaged for `readoutFor`. */
interface Counts {
  nC: number;
  nCbar: number;
  defC: number;
  defCbar: number;
  okC: number;
  defTotal: number;
  okTotal: number;
}

/** The conditional-probability sentence + fraction for a given conditioning. */
function readoutFor(
  condition: Condition,
  c: Counts,
): { sentence: string; expr: string; num: number; den: number } | null {
  switch (condition) {
    case "inhouse":
      return {
        sentence: `Of the ${c.nC} in-house sets, ${c.defC} are defective.`,
        expr: "Pr(D | C)",
        num: c.defC,
        den: c.nC,
      };
    case "bought":
      return {
        sentence: `Of the ${c.nCbar} bought-in sets, ${c.defCbar} are defective.`,
        expr: "Pr(D | C̄)",
        num: c.defCbar,
        den: c.nCbar,
      };
    case "defective":
      return {
        sentence: `Of the ${c.defTotal} defective sets, ${c.defC} were made in-house.`,
        expr: "Pr(C | D)",
        num: c.defC,
        den: c.defTotal,
      };
    case "ok":
      return {
        sentence: `Of the ${c.okTotal} working sets, ${c.okC} were made in-house.`,
        expr: "Pr(C | D̄)",
        num: c.okC,
        den: c.okTotal,
      };
    default:
      return null;
  }
}

/** Coloured legend swatch. */
function Swatch({ fill, children }: { fill: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-3 h-3 rounded-[3px]"
        style={{ backgroundColor: fill, opacity: 0.9 }}
      />
      {children}
    </span>
  );
}

/** Category button for the conditioning row. */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[12px] font-medium border transition-colors ${
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-indigo-400"
      }`}
    >
      {children}
    </button>
  );
}

/** Labelled 0–1 range slider, matching the project's slider styling. */
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
        <label className="text-[12px] text-[color:var(--color-ink-700)]">
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

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function toNum(v: unknown, fallback: number) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
