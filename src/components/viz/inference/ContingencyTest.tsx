/**
 * Chi-squared test of association viz, used by Module 5, WU9
 * (`m5-categorical-association`).
 *
 * A contingency table classifies each member of a sample by two variables.
 * Under H₀ (the variables are independent) the expected frequency of a cell
 * is column total × row total / grand total, and D² = Σ O²/E − n has
 * approximately the χ²-distribution with (r − 1)(c − 1) degrees of freedom.
 * The viz shows both halves of that:
 *
 *   - The table at the top holds the observed counts with the expected counts
 *     in brackets under them, as the text prints it. Each cell is shaded by
 *     its share (O − E)²/E of D²: blue where there are more than expected,
 *     grey where there are fewer, so the nature of the association can be read
 *     straight off the table. Clicking a cell shows how its E is worked out.
 *   - The chart below piles up the D² of runs made with H₀ true under the
 *     χ²-curve, with the 5% rejection region (from Excel's CHISQ.INV.RT)
 *     shaded and the example's D² drawn as a dark line. A run fills a table of
 *     the same size, each item's row and column drawn independently in the
 *     example's own row and column proportions, then works out E from the
 *     run's own totals, exactly as the test does with real data.
 *
 * Default tier: an HTML table (so the cells are real, focusable buttons) over
 * a hand-rolled SVG chart. The only animation is a single run's D² dropping
 * onto the axis, via `useReplayTween`.
 */

"use client";

import { useState } from "react";
import type { VizParams } from "@/store/vizStore";
import { VizGuide } from "../VizGuide";
import { VIZ_TEXT, VizHint } from "../shared";
import { sampleCategory } from "../sampling";
import { chiSqInvRT, chiSqPdf, chiSqRightTail } from "../chisq";
import { useReplayTween } from "../useReplayTween";
import { ASSOCIATION_PRESETS, type AssociationPreset } from "../data/inferenceData";
import { fmt, pct, sub } from "./format";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
const INK = "rgb(15, 23, 42)"; // slate-900, the example's D²
/** Shading for cells with fewer than expected: slate-500, not red (red means "wrong"). */
const FEWER = "rgb(100, 116, 139)";

/**
 * A cell contributing this much to D² gets the full shade. Fixed rather than
 * scaled to the table, so a simulated table with small gaps looks as pale as
 * it should instead of being stretched to look as striking as the example.
 */
const CONTRIB_FULL = 4;

// SVG geometry of the D² chart (viewBox units).
const W = 440;
const PLOT_X0 = 20;
const PLOT_X1 = 420;
const PLOT_Y0 = 30;
const AXIS_Y = 150;
const H = AXIS_Y + 36;
const BINS = 40;
/** Runs needed before the bars, not just the curve, set the chart's height. */
const MIN_FOR_SCALE = 50;
/** Runs needed before the read-out quotes percentages. */
const MIN_FOR_PERCENT = 20;
const CURVE_STEPS = 200;

const sum = (xs: number[]) => xs.reduce((a, v) => a + v, 0);

/** A table of observed counts with everything the test derives from it. */
interface Worked {
  observed: number[][];
  rowTotals: number[];
  colTotals: number[];
  n: number;
  /** Column total × row total / grand total, for every cell. */
  expected: number[][];
  /** (O − E)²/E for every cell. */
  contrib: number[][];
  d2: number;
}

function work(observed: number[][]): Worked {
  const rowTotals = observed.map(sum);
  const colTotals = observed[0].map((_, j) => sum(observed.map((row) => row[j])));
  const n = sum(rowTotals);
  const expected = rowTotals.map((r) => colTotals.map((c) => (c * r) / n));
  // A simulated row or column can (very rarely) come out empty; its cells
  // then have E = 0 and O = 0, and add nothing to D².
  const contrib = observed.map((row, i) =>
    row.map((o, j) => (expected[i][j] > 0 ? (o - expected[i][j]) ** 2 / expected[i][j] : 0)),
  );
  return { observed, rowTotals, colTotals, n, expected, contrib, d2: sum(contrib.map(sum)) };
}

/**
 * Fills a fresh table of the example's size with H₀ true: each of the n items
 * gets a row and a column drawn independently, in the proportions of the
 * example's own row and column totals.
 */
function takeSample(base: Worked): Worked {
  const r = base.rowTotals.length;
  const c = base.colTotals.length;
  // Independence: Pr[row i and column j] = Pr[row i] × Pr[column j].
  const probs = base.rowTotals.flatMap((rt) => base.colTotals.map((ct) => (rt / base.n) * (ct / base.n)));
  const flat = new Array<number>(r * c).fill(0);
  for (let k = 0; k < base.n; k++) flat[sampleCategory(probs)] += 1;
  return work(base.rowTotals.map((_, i) => flat.slice(i * c, (i + 1) * c)));
}

/** Running tally of simulated D² values. */
interface Tally {
  /** How many D² values fell in each bin, from 0. */
  counts: number[];
  /** Every run, including any whose D² fell off the chart. */
  total: number;
  /** Runs beyond the 5% point. */
  beyondCut: number;
  /** Runs with a D² at least as big as the example's. */
  asBig: number;
}

function emptyTally(): Tally {
  return { counts: new Array<number>(BINS).fill(0), total: 0, beyondCut: 0, asBig: 0 };
}

/**
 * Test for association in a contingency table, then run the test over and
 * over with the two variables independent and pile up D² against the χ²-curve
 * with (r − 1)(c − 1) degrees of freedom.
 *
 * @param params.preset — id of the worked example to open with, from
 *   `ASSOCIATION_PRESETS`; defaults to the firms of Example 5A.
 */
export default function ContingencyTest({ params }: { params: VizParams }) {
  const initial = ASSOCIATION_PRESETS.find((p) => p.id === params.preset) ?? ASSOCIATION_PRESETS[0];

  const [preset, setPreset] = useState<AssociationPreset>(initial);
  const [tally, setTally] = useState<Tally>(emptyTally);
  /** The most recent single run; null after a batch or a reset. */
  const [last, setLast] = useState<Worked | null>(null);
  /** The cell whose expected frequency is worked out under the table. */
  const [picked, setPicked] = useState<[number, number]>([0, 0]);
  const [runId, setRunId] = useState(0);
  const drop = useReplayTween([runId], 420);

  const base = work(preset.observed);
  const r = preset.rows.length;
  const c = preset.cols.length;
  const df = (r - 1) * (c - 1);
  const cut = chiSqInvRT(preset.alpha, df);
  const d2 = base.d2;
  const p = chiSqRightTail(d2, df);
  const rejects = d2 > cut;
  const binW = preset.maxD2 / BINS;

  function clearTally() {
    setTally(emptyTally());
    setLast(null);
  }

  /** Fill `times` fresh tables with H₀ true and score each D². */
  function run(times: number) {
    const counts = tally.counts.slice();
    let { total, beyondCut, asBig } = tally;
    let sample: Worked | null = null;
    for (let k = 0; k < times; k++) {
      sample = takeSample(base);
      const bin = Math.floor(sample.d2 / binW);
      if (bin < BINS) counts[bin] += 1;
      total += 1;
      if (sample.d2 > cut) beyondCut += 1;
      if (sample.d2 >= d2) asBig += 1;
    }
    setTally({ counts, total, beyondCut, asBig });
    if (times === 1) {
      setLast(sample);
      setRunId((id) => id + 1);
    } else {
      setLast(null);
    }
  }

  function loadPreset(next: AssociationPreset) {
    setPreset(next);
    setPicked([0, 0]);
    clearTally();
  }

  // --- Table: the example's counts, or the latest single run ---
  const shown = last ?? base;
  const [pi, pj] = picked;
  const pickedWorking =
    `${preset.rows[pi]}, ${preset.cols[pj]}: E = ${shown.colTotals[pj]} × ${shown.rowTotals[pi]} / ${shown.n} = ` +
    `${fmt(shown.expected[pi][pj], 2)}, so (O − E)²/E = (${shown.observed[pi][pj]} − ${fmt(shown.expected[pi][pj], 2)})²/${fmt(shown.expected[pi][pj], 2)} = ${fmt(shown.contrib[pi][pj], 3)}`;

  // --- D² chart ---
  const xOf = (v: number) => PLOT_X0 + (v / preset.maxD2) * (PLOT_X1 - PLOT_X0);
  const clampX = (v: number) => Math.min(PLOT_X1, xOf(v));
  const density = (count: number) => (tally.total > 0 ? count / (tally.total * binW) : 0);
  const maxObserved = tally.counts.reduce((m, v) => Math.max(m, density(v)), 0);
  // Highest point of the curve: at its mode, df − 2, from 3 df up; at 0 for
  // df = 2. Every table here is at least 2 × 3, so df is never 1.
  const curveTop = df === 2 ? 0.5 : chiSqPdf(df - 2, df);
  const top = Math.max(curveTop, tally.total >= MIN_FOR_SCALE ? Math.min(maxObserved, 2 * curveTop) : 0) * 1.12;
  const yOf = (f: number) => AXIS_Y - Math.min(1, f / top) * (AXIS_Y - PLOT_Y0);
  // Start just right of 0, where χ²₂'s density is 0.5 but the formula divides by x.
  const curvePoints = (from: number, to: number) =>
    Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
      const x = Math.max(1e-6, from + (i / CURVE_STEPS) * (to - from));
      return `${xOf(x).toFixed(1)} ${yOf(chiSqPdf(x, df)).toFixed(1)}`;
    });
  const curvePath = `M ${curvePoints(0, preset.maxD2).join(" L ")}`;
  const tailPath = `M ${xOf(cut)} ${AXIS_Y} L ${curvePoints(cut, preset.maxD2).join(" L ")} L ${xOf(preset.maxD2)} ${AXIS_Y} Z`;
  const ticks = Array.from({ length: Math.floor(preset.maxD2 / 5) + 1 }, (_, i) => i * 5);
  const dotY = PLOT_Y0 + (AXIS_Y - 4 - PLOT_Y0) * drop;
  const lastBin = last ? Math.floor(last.d2 / binW) : -1;

  // --- Read-out ---
  // The short-cut formula, as the text writes it: first two terms, last two.
  const terms = base.observed.flatMap((row, i) => row.map((o, j) => `${o}²/${fmt(base.expected[i][j], 2)}`));
  const working = `D² = (${terms.slice(0, 2).join(" + ")} + ⋯ + ${terms.slice(-2).join(" + ")}) − ${base.n} = `;
  const dfWorking = `(r − 1)(c − 1) = (${r} − 1)(${c} − 1) = ${df}`;
  const excel = `=CHISQ.INV.RT(${preset.alpha}, ${df}) = ${fmt(cut, 3)}`;
  const decision = `${fmt(d2, 2)} ${rejects ? ">" : "<"} ${fmt(cut, 3)}: ${rejects ? "reject" : "do not reject"} H₀`;
  // A p-value this small would print as 0.0000, so say how small instead.
  const pValue = p < 0.0001 ? "< 0.0001" : `= ${fmt(p, 4)}`;
  const pText = `p-value =CHISQ.DIST.RT(${fmt(d2, 2)}, ${df}) ${pValue}`;
  const runText = last ? `This run: D² = ${fmt(last.d2, 2)}. ` : "";
  const tallyText =
    tally.total >= MIN_FOR_PERCENT
      ? `${tally.total.toLocaleString()} runs with H₀ true: ${pct(tally.beyondCut / tally.total)} above ${fmt(cut, 3)} (should be ${Math.round(preset.alpha * 100)}%), ${pct(tally.asBig / tally.total)} at or above the example's ${fmt(d2, 2)} (${pText}).`
      : `${pText}.`;
  /** One plain sentence on what the picture currently means. */
  const interpretation = last
    ? "This table was filled with the two variables independent, so its gaps between O and E are chance alone."
    : rejects
      ? preset.finding
      : "The gaps between observed and expected counts are the size chance alone produces, so there is no evidence of an association.";

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-[color:var(--color-ink-700)] border-[color:var(--color-line)] hover:border-blue-400"
    }`;
  const runButton =
    "px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700";

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="flex flex-wrap gap-1.5">
        {ASSOCIATION_PRESETS.map((q) => (
          <button key={q.id} onClick={() => loadPreset(q)} className={chip(preset.id === q.id)}>
            {q.label}
          </button>
        ))}
      </div>

      <VizHint>
        Click any cell to see where its expected count comes from, then press{" "}
        <strong className="font-semibold">{preset.drawOne}</strong> to fill a table with the two variables independent.
      </VizHint>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mr-0.5">Run it</span>
        <button onClick={() => run(1)} className={runButton}>
          {preset.drawOne}
        </button>
        <button onClick={() => run(500)} className={runButton}>
          Repeat 500 times
        </button>
        <button
          onClick={clearTally}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-500)] transition-colors hover:border-blue-400"
        >
          Reset
        </button>
      </div>

      {/* ---- Contingency table ---- */}
      <div>
        <p className="text-[12px] font-semibold text-[color:var(--color-ink-700)]">
          {last ? "One run's table" : "The example's table"}: observed O, (expected E)
        </p>
        <p className="text-[11px] text-[color:var(--color-ink-500)]">
          Shading is each cell&apos;s (O − E)²/E: <span style={{ color: ACCENT_DARK }}>blue, more than expected</span>;{" "}
          <span style={{ color: FEWER }}>grey, fewer</span>.
        </p>
        <table className="mt-1.5 w-full table-fixed border-collapse text-[12px] tabular-nums">
          <caption className="sr-only">
            {`${preset.rowTitle} against ${preset.colTitle.toLowerCase()}: observed counts with expected counts in brackets.`}
          </caption>
          <thead>
            <tr>
              <th className="w-[26%] p-1 text-left text-[10px] font-medium text-[color:var(--color-ink-500)]">
                {preset.rowTitle}
              </th>
              {preset.cols.map((col) => (
                <th key={col} className="p-1 text-center font-semibold text-[color:var(--color-ink-700)]">
                  {col}
                </th>
              ))}
              <th className="p-1 text-center font-medium text-[color:var(--color-ink-500)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {preset.rows.map((row, i) => (
              <tr key={row}>
                <th className="p-1 text-left font-semibold leading-tight text-[color:var(--color-ink-700)]">{row}</th>
                {preset.cols.map((col, j) => {
                  const more = shown.observed[i][j] > shown.expected[i][j];
                  const shade = Math.min(1, shown.contrib[i][j] / CONTRIB_FULL) * 0.45;
                  const isPicked = pi === i && pj === j;
                  return (
                    <td key={col} className="p-0.5">
                      <button
                        onClick={() => setPicked([i, j])}
                        aria-pressed={isPicked}
                        aria-label={`${row}, ${col}: observed ${shown.observed[i][j]}, expected ${fmt(shown.expected[i][j], 1)}`}
                        className={`w-full rounded-md border px-1 py-1 text-center transition-colors ${
                          isPicked ? "border-blue-600 ring-2 ring-blue-600/40" : "border-[color:var(--color-line)] hover:border-blue-400"
                        }`}
                        style={{
                          // Colour with alpha, rather than opacity, so the text stays solid.
                          backgroundColor: (more ? ACCENT : FEWER).replace("rgb(", "rgba(").replace(")", `, ${shade})`),
                        }}
                      >
                        <span className="block text-[14px] font-semibold text-[color:var(--color-ink-900)]">
                          {shown.observed[i][j]}
                        </span>
                        <span className="block text-[11px] text-[color:var(--color-ink-700)]">
                          ({fmt(shown.expected[i][j], 1)})
                        </span>
                      </button>
                    </td>
                  );
                })}
                <td className="p-1 text-center text-[color:var(--color-ink-500)]">{shown.rowTotals[i]}</td>
              </tr>
            ))}
            <tr>
              <th className="p-1 text-left font-medium text-[color:var(--color-ink-500)]">Total</th>
              {shown.colTotals.map((t, j) => (
                <td key={j} className="p-1 text-center text-[color:var(--color-ink-500)]">
                  {t}
                </td>
              ))}
              <td className="p-1 text-center font-semibold text-[color:var(--color-ink-700)]">{shown.n}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">{pickedWorking}</p>
      </div>

      {/* ---- D² chart ---- */}
      <div className="shrink-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[300px] select-none">
          <title>
            {`${tally.total} simulated D² values against the chi-squared distribution with ${df} degrees of freedom, with the 5% point ${fmt(cut, 3)} shaded and the example's D² = ${fmt(d2, 2)} marked.`}
          </title>
          <text x={PLOT_X0} y={12} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
            D² from every run, against <tspan fill={ACCENT_DARK}>χ²{sub(df)}</tspan>
          </text>

          {/* Simulated D² values as pale bars, under everything else */}
          {tally.counts.map((count, i) => {
            // A single run's bar waits for its dot to land.
            const h = count - (last && drop < 1 && i === lastBin ? 1 : 0);
            if (h <= 0) return null;
            const y = yOf(density(h));
            return (
              <rect
                key={i}
                x={xOf(i * binW)}
                y={y}
                width={Math.max(0.5, xOf(binW) - xOf(0) - 0.5)}
                height={AXIS_Y - y}
                fill={ACCENT}
                fillOpacity={0.2}
              />
            );
          })}

          <path d={tailPath} fill={ACCENT} fillOpacity={0.35} />
          <path d={curvePath} fill="none" stroke={ACCENT_DARK} strokeWidth="2" />

          {/* The example's own D² */}
          <line x1={clampX(d2)} y1={PLOT_Y0 + 4} x2={clampX(d2)} y2={AXIS_Y} stroke={INK} strokeWidth="2" />
          <text
            x={clampX(d2)}
            y={PLOT_Y0}
            textAnchor={xOf(d2) > PLOT_X1 - 50 ? "end" : "middle"}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={INK}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            example: D² = {fmt(d2, 2)}
          </text>

          {/* The 5% point, drawn after the example's line so its halo keeps
              the label legible where the two cross. */}
          <line x1={xOf(cut)} y1={AXIS_Y} x2={xOf(cut)} y2={PLOT_Y0 + 34} stroke={ACCENT_DARK} strokeDasharray="3 3" />
          <text
            x={xOf(cut) + 4}
            y={PLOT_Y0 + 32}
            fontSize={VIZ_TEXT.axisTick}
            fontWeight="600"
            fill={ACCENT_DARK}
            stroke="white"
            strokeWidth="3"
            paintOrder="stroke"
          >
            {Math.round(preset.alpha * 100)}%: {fmt(cut, 3)}
          </text>

          {/* A single run's D² dropping onto the axis */}
          {last && (
            <circle
              cx={clampX(last.d2)}
              cy={drop < 1 ? dotY : AXIS_Y - 4}
              r={4}
              fill={ACCENT_DARK}
              stroke="white"
              strokeWidth="1"
            />
          )}

          <line x1={PLOT_X0} y1={AXIS_Y} x2={PLOT_X1} y2={AXIS_Y} stroke="var(--color-ink-900)" />
          {ticks.map((v) => (
            <text
              key={v}
              x={xOf(v)}
              y={AXIS_Y + 13}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill="var(--color-ink-700)"
              className="tabular-nums"
            >
              {v}
            </text>
          ))}
          <text x={(PLOT_X0 + PLOT_X1) / 2} y={AXIS_Y + 30} textAnchor="middle" fontSize={VIZ_TEXT.label} fill="var(--color-ink-700)">
            test statistic D²
          </text>
        </svg>
      </div>

      {/* Read-out */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">{preset.source}</p>
          <VizGuide
            steps={[
              "Pick a worked example along the top. The table shows its observed counts, with the counts expected under independence in brackets.",
              "Click any cell. The line under the table works out its expected count, column total × row total / grand total, and its share (O − E)²/E of D².",
              "Read the shading: blue cells have more than expected, grey cells fewer, and the darker the cell the more it adds to D². This is how the text describes the nature of an association.",
              "The chart is the χ²-curve with (r − 1)(c − 1) degrees of freedom. The shaded tail beyond the 5% point is the rejection region; the dark line is the example's D².",
              "Press the first run button to fill a table of the same size with the two variables independent. Its counts replace the example's, and its D² drops onto the chart. O and E still differ: that is chance.",
              "Press Repeat 500 times. The D² values pile up under the curve, and about 5% land in the shaded region.",
            ]}
          />
        </div>
        {/* The working, then the answer. */}
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          {working}
          <span className="font-semibold">{fmt(d2, 2)}</span>
        </p>
        <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
          df = {dfWorking}, <span className="font-semibold text-blue-700">{excel}</span>, so{" "}
          <span className="font-semibold">{decision}</span>
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
          {runText}
          {tallyText}
        </p>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{interpretation}</p>
      </div>
    </div>
  );
}
