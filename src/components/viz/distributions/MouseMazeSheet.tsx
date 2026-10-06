/**
 * The mouse-maze experiment, simulated the way students build it in
 * Excel. Used by Module 4, WU2 (`m4-binomial`).
 *
 * Students simulate the experiment in a spreadsheet: one row per experiment, one column per mouse holding
 * =BINOM.INV(1, p, RAND()) (1 if that mouse got out), and X = SUM of the row.
 * They then count the rows with COUNTIF and compare the relative frequencies
 * with BINOM.DIST, and the AVERAGE and VAR.S of X with np and np(1 − p). This
 * viz is that sheet, wired to a picture of the maze and to the bar chart:
 *
 *   - "Run once" fills down one row and the maze shows those 8 mice running.
 *     "Run 500" fills down 500 rows at once.
 *   - "Recalculate (F9)" redraws every formula row, because RAND() is
 *     volatile in Excel too. "Load 1500 rows" pastes in 1500
 *     previously recorded experiments as values; values do not change on F9, just as in Excel.
 *   - Clicking a row replays it in the maze. Clicking a bar, or a row of the
 *     frequency table, toggles that value of X: the matching rows are tinted
 *     and the read-out gives Pr[X in the selection] next to the share of rows.
 *   - "Show formulas" swaps every cell's value for its formula, like Excel's
 *     Ctrl + ` (there is no formula bar).
 *
 * Changing p in cell M1 clears the sheet: rows drawn under one p say nothing
 * about another (the standing rule for every simulating viz).
 *
 * The experiment rows are virtualised (only the visible window is rendered),
 * so a few thousand rows stay smooth. When the panel is wide enough (Wide
 * view, or a large screen) the sheet sits beside the maze and chart; a CSS
 * container query on the panel's own width decides, not the Wide view flag.
 *
 * Default tier: SVG and HTML, no dependencies. The only animation is the
 * mice running, via `useReplayTween`, which stops drawing frames when done.
 */

"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { VizGuide } from "../VizGuide";
import { VIZ_TEXT, VizHint } from "../shared";
import { sampleBinomialTrials } from "../sampling";
import { binomialPmf } from "../binomial";
import { useReplayTween } from "../useReplayTween";
import { RECORDED_ROWS } from "../data/recordedMouseMaze";

const ACCENT = "rgb(37, 99, 235)"; // blue-600
const ACCENT_DARK = "rgb(29, 78, 216)"; // blue-700
/** Mean marker colour, shared with every other viz that marks a mean. */
const MEAN_C = "rgb(220, 38, 38)"; // red-600
/** Excel's selection green, used only for the selected-row outline. */
const EXCEL_GREEN = "rgb(33, 115, 70)";

/** Mice per experiment. Fixed: the sheet has one column per mouse (B to I). */
const MICE = 8;
/** The experiment's probability that a mouse finds its way out. */
const START_P = 0.3;
/** Most rows the sheet will hold. Past this the tally barely changes. */
const MAX_ROWS = 5000;
/** Height of one sheet row, in px. Fixed so the rows can be virtualised. */
const ROW_H = 22;
/** Extra rows rendered above and below the visible window, for smooth scrolling. */
const OVERSCAN = 6;
/** Column letters for the experiment block: A, B–I (the mice), J. */
const MOUSE_COLS = ["B", "C", "D", "E", "F", "G", "H", "I"];

/** The formula in every mouse cell. p lives in M1. */
const MOUSE_FORMULA = "=BINOM.INV(1,$M$1,RAND())";

// Maze SVG geometry (viewBox units).
const MAZE_W = 440;
const LANE_H = 17;
const MAZE_TOP = 22;
const MAZE_H = MAZE_TOP + MICE * LANE_H + 10;
const START_X = 48;
const EXIT_X = 404;

// Chart SVG geometry (viewBox units).
const CH_W = 440;
const CH_H = 210;
const CH_X0 = 40;
const CH_X1 = 430;
/** Room above the tallest bar for its value label, with the μ label above that. */
const CH_Y0 = 30;
const CH_AXIS = 182;

/** One experiment: bit 7 is Mouse #1, bit 0 is Mouse #8; 1 means it got out. */
type Row = number;

function drawRow(p: number): Row {
  return sampleBinomialTrials(MICE, p).reduce((bits, ok, i) => bits | (ok ? 1 << (7 - i) : 0), 0);
}

/** Whether mouse `m` (0-based) got out in a row. */
function mouseOut(row: Row, m: number): boolean {
  return ((row >> (7 - m)) & 1) === 1;
}

/** X for a row: how many of the 8 mice got out. */
function countOut(row: Row): number {
  let x = 0;
  for (let m = 0; m < MICE; m++) if (mouseOut(row, m)) x += 1;
  return x;
}

/** The recorded experiments, packed into the same bit layout. */
const RECORDED: Row[] = RECORDED_ROWS.map((mice) =>
  mice.reduce((bits, ok, i) => bits | (ok ? 1 << (7 - i) : 0), 0),
);

/** Every whole number from `from` to `to`, inclusive. */
function rangeOf(from: number, to: number): number[] {
  const out: number[] = [];
  for (let x = from; x <= to; x++) out.push(x);
  return out;
}

/**
 * Where a failed mouse gives up, as a share of the way to the exit. Fixed per
 * mouse so the maze looks the same run to run; only who gets out changes.
 */
const DEAD_END = [0.42, 0.63, 0.35, 0.74, 0.52, 0.3, 0.68, 0.47];

/**
 * Spreadsheet simulation of the mouse maze, linked to a picture of the maze
 * and to the Binomial bar chart.
 *
 * Takes no params: it always opens on the experiment's p = 0.3 with an empty
 * sheet, so the `params` every viz is handed are simply not read.
 */
export default function MouseMazeSheet() {

  const [p, setP] = useState(START_P);
  /** What is typed in cell M1, which may be half-finished ("0.") for a moment. */
  const [pText, setPText] = useState(String(START_P));
  const [rows, setRows] = useState<Row[]>([]);
  /**
   * How many leading rows were pasted in as values (the recorded experiments).
   * Their mouse cells show values even in formula view and are left alone by
   * F9; their X cells are still =SUM, as they would be in Excel.
   */
  const [pasted, setPasted] = useState(0);
  /** The row the maze is showing, as an index into `rows`. */
  const [selRow, setSelRow] = useState<number | null>(null);
  /** Values of X picked on the chart or in the frequency table. */
  const [chosen, setChosen] = useState<Set<number>>(() => new Set(rangeOf(3, MICE)));
  const [showFormulas, setShowFormulas] = useState(false);
  /** Bumped by each single run, to replay the mice running. */
  const [runId, setRunId] = useState(0);
  /** The row added by the latest single run: the only row that animates. */
  const [animRow, setAnimRow] = useState<number | null>(null);
  const run01 = useReplayTween([runId], 900);
  const [scrollTop, setScrollTop] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const pmf = useMemo(() => binomialPmf(MICE, p), [p]);
  const counts = useMemo(() => {
    const c = new Array<number>(MICE + 1).fill(0);
    for (const r of rows) c[countOut(r)] += 1;
    return c;
  }, [rows]);
  const total = rows.length;
  /** Last data row in sheet terms (row 1 holds the headers). */
  const lastRow = Math.max(2, total + 1);
  const range = `$J$2:$J$${lastRow}`;

  const mean = total > 0 ? counts.reduce((s, c, x) => s + c * x, 0) / total : null;
  const variance =
    total > 1 && mean !== null
      ? counts.reduce((s, c, x) => s + c * (x - mean) ** 2, 0) / (total - 1)
      : null;

  const picked = [...chosen].sort((a, b) => a - b);
  const theorySel = picked.reduce((s, x) => s + pmf[x], 0);
  const observedSel = picked.reduce((s, x) => s + counts[x], 0);

  // --- Actions ---

  /** Show the newest row in the maze and scroll the sheet down to it. */
  function focusLast(nextRows: Row[]) {
    setSelRow(nextRows.length - 1);
    requestAnimationFrame(() => {
      const el = sheetRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  /** Fill down `times` new rows, as dragging the fill handle would. */
  function run(times: number) {
    const room = MAX_ROWS - rows.length;
    if (room <= 0) return;
    const fresh = Array.from({ length: Math.min(times, room) }, () => drawRow(p));
    const next = [...rows, ...fresh];
    setRows(next);
    focusLast(next);
    if (times === 1) {
      setAnimRow(next.length - 1);
      setRunId((k) => k + 1);
    } else {
      setAnimRow(null);
    }
  }

  /** F9: every formula row draws again. Pasted values stay as they are. */
  function recalculate() {
    if (rows.length === pasted) return;
    setRows(rows.map((r, i) => (i < pasted ? r : drawRow(p))));
    setAnimRow(null);
  }

  /** Paste the 1500 recorded experiments over the sheet, as values. */
  function loadRecorded() {
    setP(START_P);
    setPText(String(START_P));
    setRows(RECORDED);
    setPasted(RECORDED.length);
    setAnimRow(null);
    setSelRow(0);
    requestAnimationFrame(() => {
      if (sheetRef.current) sheetRef.current.scrollTop = 0;
    });
  }

  function reset() {
    setRows([]);
    setPasted(0);
    setSelRow(null);
    setAnimRow(null);
  }

  /**
   * Typing in M1. A new p clears the sheet, because rows drawn under the old
   * p would be compared against the new BINOM.DIST column.
   */
  function editP(text: string) {
    setPText(text);
    const v = Number(text);
    if (text.trim() !== "" && Number.isFinite(v) && v > 0 && v < 1 && v !== p) {
      setP(v);
      reset();
    }
  }

  /** Toggle one value of X, and bring the first matching row into view. */
  function toggleX(x: number) {
    const adding = !chosen.has(x);
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(x)) next.delete(x);
      else next.add(x);
      return next;
    });
    if (adding) {
      const first = rows.findIndex((r) => countOut(r) === x);
      if (first >= 0 && sheetRef.current) {
        sheetRef.current.scrollTop = Math.max(0, first * ROW_H - ROW_H * 2);
      }
    }
  }

  function onSheetKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "F9") {
      e.preventDefault();
      recalculate();
    }
  }

  // --- The maze ---

  const shownRow = selRow !== null && selRow < rows.length ? rows[selRow] : null;
  // Only the newest row of a single run is animated; any other row (picked by
  // clicking, or the last of a batch) is shown where the mice ended up.
  const animate = shownRow !== null && selRow === animRow && run01 < 1;
  const t = animate ? run01 : 1;

  const maze = (
    <svg viewBox={`0 0 ${MAZE_W} ${MAZE_H}`} className="w-full h-auto select-none">
      <title>
        {shownRow === null
          ? "The maze, with 8 mice waiting at the start."
          : `Experiment ${selRow! + 1}: ${countOut(shownRow)} of the 8 mice got out.`}
      </title>
      <text x={START_X - 12} y={13} fontSize={VIZ_TEXT.caption} fontWeight="600" fill="var(--color-ink-700)">
        {shownRow === null ? "The maze" : `Experiment ${selRow! + 1} (row ${selRow! + 2})`}
      </text>
      {/* Outer walls, with the exit gap on the right */}
      <rect
        x={START_X - 14}
        y={MAZE_TOP - 4}
        width={EXIT_X - START_X + 14}
        height={MICE * LANE_H + 8}
        rx={4}
        fill="rgb(248, 250, 252)"
        stroke="var(--color-ink-500)"
        strokeWidth="1.5"
      />
      <rect x={EXIT_X - 2} y={MAZE_TOP + 4} width={6} height={MICE * LANE_H - 8} fill="white" />
      <text x={EXIT_X + 8} y={MAZE_TOP + (MICE * LANE_H) / 2 + 4} fontSize={VIZ_TEXT.caption} fontWeight="700" fill={ACCENT_DARK}>
        OUT
      </text>
      {/* Inner walls: staggered baffles, purely to read as a maze */}
      {[0.22, 0.4, 0.58, 0.76].map((f, k) => {
        const x = START_X + (EXIT_X - START_X) * f;
        const fromTop = k % 2 === 0;
        return (
          <line
            key={f}
            x1={x}
            y1={fromTop ? MAZE_TOP - 4 : MAZE_TOP + LANE_H * 2.5}
            x2={x}
            y2={fromTop ? MAZE_TOP + LANE_H * 5.5 : MAZE_TOP + MICE * LANE_H + 4}
            stroke="var(--color-line)"
            strokeWidth="3"
          />
        );
      })}

      {Array.from({ length: MICE }, (_, m) => {
        const y = MAZE_TOP + m * LANE_H + LANE_H / 2;
        const out = shownRow !== null && mouseOut(shownRow, m);
        const target = shownRow === null ? START_X : out ? EXIT_X - 10 : START_X + (EXIT_X - START_X) * DEAD_END[m];
        const x = START_X + (target - START_X) * t;
        const done = shownRow !== null && t >= 1;
        const fill = shownRow === null ? "var(--color-ink-500)" : out ? ACCENT : "rgb(148, 163, 184)";
        return (
          <g key={m}>
            <text x={START_X - 18} y={y + 3} textAnchor="end" fontSize={9} fontWeight="600" fill="var(--color-ink-700)">
              #{m + 1}
            </text>
            {/* A simple mouse: body, ear, tail */}
            <g transform={`translate(${x} ${y})`}>
              <path d="M -7 1 q -6 0 -9 4" fill="none" stroke={fill} strokeWidth="1.2" />
              <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={fill} />
              <circle cx={4} cy={-3.5} r={2.4} fill={fill} />
            </g>
            {done && !out && (
              <text x={x + 10} y={y + 3} fontSize={8} fill="var(--color-ink-500)">
                stuck
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );

  // --- The bar chart ---

  const observed = total > 0 ? counts.map((c) => c / total) : null;
  const pmfMax = Math.max(...pmf);
  // As in BinomialExplorer: rings may outgrow the bars early on, but the axis
  // never grows past twice the tallest bar, or the first run would flatten it.
  const yTop = Math.min(Math.max(pmfMax, ...(observed ?? [])), pmfMax * 2) * 1.12;
  const slot = (CH_X1 - CH_X0) / (MICE + 1);
  const barW = Math.min(slot * 0.68, 34);
  const cx = (x: number) => CH_X0 + slot * (x + 0.5);
  const yOf = (v: number) => CH_AXIS - (Math.min(v, yTop) / yTop) * (CH_AXIS - CH_Y0);
  const shownX = shownRow === null ? null : countOut(shownRow);

  const chart = (
    <svg viewBox={`0 0 ${CH_W} ${CH_H}`} className="w-full h-auto select-none">
      <title>
        BINOM.DIST bars for B(8, {p}) with {total} experiments drawn over them as rings; click a
        bar to select it.
      </title>
      <line x1={CH_X0} y1={CH_AXIS} x2={CH_X1} y2={CH_AXIS} stroke="var(--color-ink-900)" />
      <text
        x={11}
        y={(CH_Y0 + CH_AXIS) / 2}
        fontSize={VIZ_TEXT.label}
        fill="var(--color-ink-700)"
        textAnchor="middle"
        transform={`rotate(-90 11 ${(CH_Y0 + CH_AXIS) / 2})`}
      >
        p(x)
      </text>
      {pmf.map((prob, x) => {
        const on = chosen.has(x);
        return (
          <g key={x} className="cursor-pointer" onClick={() => toggleX(x)}>
            <rect x={cx(x) - slot / 2} y={CH_Y0} width={slot} height={CH_AXIS - CH_Y0} fill="transparent" />
            <rect
              x={cx(x) - barW / 2}
              y={yOf(prob)}
              width={barW}
              height={CH_AXIS - yOf(prob)}
              rx="2"
              fill={ACCENT}
              fillOpacity={on ? 0.85 : 0.22}
              stroke={shownX === x ? EXCEL_GREEN : "none"}
              strokeWidth={2}
            />
            {prob >= 0.001 && (
              <text
                x={cx(x)}
                y={yOf(prob) - 5}
                textAnchor="middle"
                fontSize={VIZ_TEXT.axisTick}
                fill="var(--color-ink-700)"
                className="tabular-nums"
              >
                {prob.toFixed(3)}
              </text>
            )}
            <text
              x={cx(x)}
              y={CH_AXIS + 14}
              textAnchor="middle"
              fontSize={VIZ_TEXT.axisTick}
              fill={on ? ACCENT_DARK : "var(--color-ink-500)"}
              className="tabular-nums"
            >
              {x}
            </text>
            {/* Observed relative frequency: a hollow ring over the bar */}
            {observed && observed[x] > 0 && (
              <circle cx={cx(x)} cy={yOf(observed[x])} r={4.5} fill="white" stroke={ACCENT_DARK} strokeWidth="2" />
            )}
          </g>
        );
      })}
      {/* Mean: np in theory, red and dashed as on every other viz */}
      <line
        x1={cx(MICE * p)}
        y1={12}
        x2={cx(MICE * p)}
        y2={CH_AXIS}
        stroke={MEAN_C}
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <text
        // Near the right edge the label goes on the left of its line, so a
        // high p (np close to 8) never pushes it off the chart.
        x={cx(MICE * p) + (cx(MICE * p) > CH_W - 90 ? -4 : 4)}
        textAnchor={cx(MICE * p) > CH_W - 90 ? "end" : "start"}
        y={10}
        fontSize={VIZ_TEXT.axisTick}
        fontWeight="600"
        fill={MEAN_C}
        stroke="white"
        strokeWidth="3"
        paintOrder="stroke"
      >
        μ = np = {fmt(MICE * p, 2)}
      </text>
      <text x={(CH_X0 + CH_X1) / 2} y={CH_H - 4} textAnchor="middle" fontSize={VIZ_TEXT.label} fill="var(--color-ink-700)">
        x, the number of mice that got out
      </text>
    </svg>
  );

  // --- The spreadsheet ---

  // Enough rows to fill the tallest the box gets (about 700px side by side).
  const viewRows = Math.ceil(700 / ROW_H) + OVERSCAN * 2;
  // Clamped so a stale scroll position (the sheet just shrank) can never
  // start the window past the last row and render nothing.
  const start = Math.max(0, Math.min(Math.floor(scrollTop / ROW_H) - OVERSCAN, total - viewRows));
  const end = Math.min(total, start + viewRows);
  const colW = showFormulas ? "w-[176px] min-w-[176px]" : "w-[32px] min-w-[32px]";
  const cell = "h-[22px] border-r border-b border-slate-200 px-1 text-[11px] tabular-nums whitespace-nowrap overflow-hidden text-ellipsis";
  const headCell = "h-[20px] border-r border-b border-slate-300 bg-slate-100 text-[10px] text-slate-500 text-center font-normal";

  const sheet = (
    <div className="rounded-md border border-slate-300 bg-white overflow-hidden flex flex-col min-h-0">
      <div
        ref={sheetRef}
        tabIndex={0}
        onKeyDown={onSheetKey}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        // A definite height in both layouts: an auto height would grow to fit
        // every row, leaving nothing to scroll (and losing the position).
        className="overflow-auto outline-none h-[260px] @min-[780px]:h-[540px]"
        aria-label="Simulation spreadsheet, one row per experiment"
        role="region"
      >
        <div className="min-w-max">
          {/* Column letters, then row 1's headers, both pinned while scrolling */}
          <div className="sticky top-0 z-10">
            <div className="flex">
              <div className={`${headCell} w-[34px] min-w-[34px]`} />
              <div className={`${headCell} w-[60px] min-w-[60px]`}>A</div>
              {MOUSE_COLS.map((c) => (
                <div key={c} className={`${headCell} ${colW}`}>
                  {c}
                </div>
              ))}
              <div className={`${headCell} ${showFormulas ? "w-[120px] min-w-[120px]" : "w-[40px] min-w-[40px]"}`}>J</div>
            </div>
            {/* Row 1 is taller with wrapped text, as Excel's "Wrap Text" does,
                so "Mouse #1" fits a column only wide enough for a 0 or 1. */}
            <div className="flex bg-white">
              <div className={`${headCell} w-[34px] min-w-[34px] !h-[32px] leading-[32px]`}>1</div>
              <div className={`${HEAD1} w-[60px] min-w-[60px]`}>Experiment #</div>
              {MOUSE_COLS.map((c, m) => (
                <div key={c} className={`${HEAD1} ${colW} text-center !text-[9px]`}>
                  Mouse #{m + 1}
                </div>
              ))}
              <div className={`${HEAD1} ${showFormulas ? "w-[120px] min-w-[120px]" : "w-[40px] min-w-[40px]"} text-center`}>
                X
              </div>
            </div>
          </div>

          {total === 0 && (
            <p className="px-3 py-6 text-[12px] text-slate-500">
              No experiments yet. Press <strong>Run once</strong> to fill down the first row.
            </p>
          )}

          {/* Spacer standing in for the rows above the rendered window */}
          <div style={{ height: start * ROW_H }} />
          {Array.from({ length: end - start }, (_, k) => {
            const i = start + k;
            const r = rows[i];
            const x = countOut(r);
            const sheetRow = i + 2;
            const isSel = i === selRow;
            const isValue = i < pasted;
            const tinted = chosen.has(x);
            return (
              <div
                key={i}
                onClick={() => setSelRow(i)}
                className="flex cursor-pointer hover:bg-slate-50"
                style={isSel ? { outline: `2px solid ${EXCEL_GREEN}`, outlineOffset: "-2px" } : undefined}
              >
                <div className={`${headCell} w-[34px] min-w-[34px] leading-[22px] !h-[22px]`}>{sheetRow}</div>
                <div className={`${cell} w-[60px] min-w-[60px] text-right text-slate-700`}>{i + 1}</div>
                {MOUSE_COLS.map((c, m) => {
                  const out = mouseOut(r, m);
                  return (
                    <div
                      key={c}
                      className={`${cell} ${colW} ${showFormulas && !isValue ? "text-left text-slate-600" : "text-right"} ${
                        out ? "text-blue-700 font-semibold" : "text-slate-500"
                      }`}
                    >
                      {showFormulas && !isValue ? MOUSE_FORMULA : out ? 1 : 0}
                    </div>
                  );
                })}
                <div
                  className={`${cell} ${showFormulas ? "w-[120px] min-w-[120px] text-left" : "w-[40px] min-w-[40px] text-right"} font-semibold ${
                    tinted ? "bg-blue-50 text-blue-700" : "text-slate-800"
                  }`}
                >
                  {showFormulas ? `=SUM(B${sheetRow}:I${sheetRow})` : x}
                </div>
              </div>
            );
          })}
          <div style={{ height: Math.max(0, total - end) * ROW_H }} />
        </div>
      </div>
    </div>
  );

  /** A small fixed block of cells, drawn the same way as the main sheet. */
  const summary = (
    <div className="flex flex-wrap items-start gap-3 overflow-x-auto max-w-full">
      {/* Parameters and summaries: columns L and M */}
      <table className="border-collapse text-[11px] tabular-nums">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-slate-100 px-1 text-[10px] font-normal text-slate-500" />
            <th className="border border-slate-300 bg-slate-100 px-2 text-[10px] font-normal text-slate-500">L</th>
            <th className="border border-slate-300 bg-slate-100 px-2 text-[10px] font-normal text-slate-500">M</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <SheetRowNum n={1} />
            <td className="border border-slate-200 px-2 font-semibold">p</td>
            <td className="border border-slate-200 p-0">
              <input
                value={pText}
                onChange={(e) => editP(e.target.value)}
                onBlur={() => setPText(String(p))}
                inputMode="decimal"
                aria-label="p, the probability a mouse gets out (cell M1)"
                className="w-[84px] px-2 py-0.5 text-right font-semibold text-blue-700 outline-none focus:ring-2 focus:ring-inset focus:ring-[rgb(33,115,70)]"
              />
            </td>
          </tr>
          <tr>
            <SheetRowNum n={2} />
            <td className="border border-slate-200 px-2 font-semibold">Mean</td>
            <td className="border border-slate-200 px-2 text-right">
              {showFormulas ? `=AVERAGE(${range})` : mean === null ? "#DIV/0!" : mean.toFixed(4)}
            </td>
          </tr>
          <tr>
            <SheetRowNum n={3} />
            <td className="border border-slate-200 px-2 font-semibold">Variance</td>
            <td className="border border-slate-200 px-2 text-right">
              {showFormulas ? `=VAR.S(${range})` : variance === null ? "#DIV/0!" : variance.toFixed(4)}
            </td>
          </tr>
          <tr>
            <SheetRowNum n={4} />
            <td className="border border-slate-200 px-2 font-semibold">np</td>
            {/* np is what the red dashed line on the chart marks */}
            <td className="border border-slate-200 px-2 text-right" style={{ color: MEAN_C }}>
              {showFormulas ? "=8*M1" : (MICE * p).toFixed(4)}
            </td>
          </tr>
          <tr>
            <SheetRowNum n={5} />
            <td className="border border-slate-200 px-2 font-semibold">np(1 − p)</td>
            <td className="border border-slate-200 px-2 text-right">
              {showFormulas ? "=8*M1*(1-M1)" : (MICE * p * (1 - p)).toFixed(4)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Frequency table: columns O to R */}
      <table className="border-collapse text-[11px] tabular-nums">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-slate-100 px-1 text-[10px] font-normal text-slate-500" />
            {["O", "P", "Q", "R"].map((c) => (
              <th key={c} className="border border-slate-300 bg-slate-100 px-2 text-[10px] font-normal text-slate-500">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <SheetRowNum n={1} />
            <td className="border border-slate-200 px-2 font-semibold">x</td>
            <td className="border border-slate-200 px-2 font-semibold">Count</td>
            <td className="border border-slate-200 px-2 font-semibold">Rel. freq</td>
            <td className="border border-slate-200 px-2 font-semibold">BINOM.DIST</td>
          </tr>
          {pmf.map((prob, x) => {
            const r = x + 2;
            const on = chosen.has(x);
            return (
              <tr
                key={x}
                onClick={() => toggleX(x)}
                className={`cursor-pointer ${on ? "bg-blue-50" : "hover:bg-slate-50"}`}
                style={shownX === x ? { outline: `2px solid ${EXCEL_GREEN}`, outlineOffset: "-2px" } : undefined}
              >
                <SheetRowNum n={r} />
                <td className={`border border-slate-200 px-2 text-right ${on ? "text-blue-700 font-semibold" : ""}`}>{x}</td>
                <td className="border border-slate-200 px-2 text-right">
                  {showFormulas ? `=COUNTIF(${range},O${r})` : counts[x]}
                </td>
                <td className="border border-slate-200 px-2 text-right">
                  {showFormulas ? `=P${r}/COUNT(${range})` : total === 0 ? "#DIV/0!" : (counts[x] / total).toFixed(4)}
                </td>
                <td className="border border-slate-200 px-2 text-right">
                  {showFormulas ? `=BINOM.DIST(O${r},8,$M$1,FALSE)` : prob.toFixed(4)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // --- Read-out ---

  const isRun = picked.length > 1 && picked[picked.length - 1] - picked[0] === picked.length - 1;
  const pickedLabel =
    picked.length === 0
      ? null
      : picked.length === 1
        ? `X = ${picked[0]}`
        : isRun
          ? `${picked[0]} ≤ X ≤ ${picked[picked.length - 1]}`
          : `X ∈ {${picked.join(", ")}}`;
  // The working, as BinomialExplorer writes it: the terms when there are a
  // few, otherwise the complement, which is shorter.
  const working = (() => {
    if (picked.length <= 1) return null;
    if (picked.length <= 4) return picked.map((x) => pmf[x].toFixed(4)).join(" + ");
    const left = rangeOf(0, MICE).filter((x) => !chosen.has(x));
    if (left.length > 0 && left.length <= 4) return `1 − ${left.map((x) => pmf[x].toFixed(4)).join(" − ")}`;
    return null;
  })();

  const interpretation =
    total === 0
      ? "Each row of the sheet is one experiment of 8 mice. Fill down some rows and watch the rings settle onto the BINOM.DIST bars."
      : total < 100
        ? "With only a few rows the rings jump around the bars. Run 500 to see the pattern."
        : `With ${total.toLocaleString()} rows the relative frequencies sit close to BINOM.DIST, and the mean of X close to np: the model coming true.`;

  const controls = (
    <div className="rounded-lg border border-[color:var(--color-line)] px-3 py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mr-0.5">Run it</span>
        <button onClick={() => run(1)} className={RUN_BTN} disabled={total >= MAX_ROWS}>
          Run once
        </button>
        <button onClick={() => run(500)} className={RUN_BTN} disabled={total >= MAX_ROWS}>
          Run 500
        </button>
        <button onClick={reset} className={PLAIN_BTN}>
          Reset
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-0.5">Sheet</span>
        <button
          onClick={recalculate}
          className={PLAIN_BTN}
          disabled={total === pasted}
          title="Excel's F9: every RAND() draws again"
        >
          Recalculate (F9)
        </button>
        <button onClick={loadRecorded} className={PLAIN_BTN} title="Paste in 1500 previously recorded experiments">
          Load 1500 rows
        </button>
        <button onClick={() => setShowFormulas((s) => !s)} className={PLAIN_BTN} aria-pressed={showFormulas}>
          {showFormulas ? "Show values" : "Show formulas"}
        </button>
      </div>
    </div>
  );

  const readout = (
    <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
          Mouse maze: X ~ B(8, {p})
        </p>
        <VizGuide
          steps={[
            "Press Run once. A new row is filled down in the sheet: each mouse cell is =BINOM.INV(1, p, RAND()), 1 if that mouse got out, and X adds up the row. The maze shows those 8 mice.",
            "Press Run 500 to fill down 500 rows at once. Each ring on the chart is the relative frequency of that x in the sheet, against the BINOM.DIST bar.",
            "Click any row to replay it in the maze. Click a bar, or a row of the frequency table, to select that value of X: its rows are tinted in column J.",
            "Recalculate (F9) redraws every RAND(), just as Excel does. Load 1500 rows pastes in 1500 previously recorded experiments as values, which do not change.",
            "Show formulas reveals what is typed in each cell. Change p in cell M1 to start a new sheet with a different probability.",
            "Compare Mean and Variance (=AVERAGE and =VAR.S of column J) with np and np(1 − p).",
          ]}
        />
      </div>
      <p className="mt-1 text-[15px] text-[color:var(--color-ink-900)] tabular-nums">
        {pickedLabel === null ? (
          "No bars selected"
        ) : (
          <>
            Pr[{pickedLabel}] = {working ? `${working} = ` : ""}
            <span className="font-semibold">{theorySel.toFixed(4)}</span>
          </>
        )}
      </p>
      <p className="mt-1 text-[12px] text-[color:var(--color-ink-700)] tabular-nums">
        {total > 0 && pickedLabel !== null && (
          <>
            In the sheet: {observedSel.toLocaleString()} of {total.toLocaleString()} rows ={" "}
            {(observedSel / total).toFixed(4)} &nbsp;·&nbsp;{" "}
          </>
        )}
        Mean of X: {mean === null ? "none yet" : mean.toFixed(4)} vs np ={" "}
        {/* Red to match the dashed np line on the chart */}
        <span style={{ color: MEAN_C }}>{fmt(MICE * p, 4)}</span>
      </p>
      <p className="mt-1 text-[12px] text-[color:var(--color-ink-500)]">{interpretation}</p>
    </div>
  );

  const hint = (
    <VizHint>
      Press <strong className="font-semibold">Run once</strong> to fill down one experiment, and
      watch the 8 mice and the new row in the sheet.
    </VizHint>
  );

  // One tree for every width, so the sheet's scroll box is never rebuilt
  // (rebuilding it would lose its scroll position). The panel is a CSS
  // container: below 780px wide everything stacks; from 780px (Wide view, or
  // a large screen) the sheet and its tables move into a right-hand column.
  // Laying out from the panel's own width, not the Wide view flag, means the
  // two columns only appear when they actually fit.
  return (
    <div className="@container h-full overflow-y-auto overflow-x-hidden">
      <div className={LAYOUT}>
        <div className="[grid-area:hint] min-w-0">{hint}</div>
        <div className="[grid-area:controls] min-w-0">{controls}</div>
        <div className="[grid-area:maze] min-w-0">{maze}</div>
        <div className="[grid-area:sheet] min-w-0">{sheet}</div>
        <div className="[grid-area:summary] min-w-0">{summary}</div>
        <div className="[grid-area:chart] min-w-0">{chart}</div>
        <div className="[grid-area:readout] min-w-0">{readout}</div>
      </div>
    </div>
  );
}

/**
 * Grid areas for the two layouts. Stacked: maze, then the sheet and its
 * tables, then the chart and read-out. Side by side: the 540px sheet runs
 * beside the hint, controls, maze and chart (about the same height, so no
 * gaps open on the left), and the summary tables sit beside the read-out.
 */
const LAYOUT =
  "grid gap-3 grid-cols-1 [grid-template-areas:'hint'_'controls'_'maze'_'sheet'_'summary'_'chart'_'readout'] " +
  "@min-[780px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] @min-[780px]:gap-x-4 " +
  "@min-[780px]:[grid-template-areas:'hint_sheet'_'controls_sheet'_'maze_sheet'_'chart_sheet'_'readout_summary'] @min-[780px]:items-start";

/** Row 1 of the experiment sheet: bold, wrapped onto up to two lines. */
const HEAD1 =
  "h-[32px] border-r border-b border-slate-200 px-1 flex items-center justify-center text-[10px] leading-tight font-semibold text-slate-700 whitespace-normal";
const RUN_BTN =
  "px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-600 bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-40";
const PLAIN_BTN =
  "px-2.5 py-1 rounded-md text-[11px] font-medium border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-700)] transition-colors hover:border-blue-400 disabled:opacity-40";

/** A grey row-number cell, as at the left edge of an Excel sheet. */
function SheetRowNum({ n }: { n: number }) {
  return (
    <td className="border border-slate-300 bg-slate-100 px-1 text-center text-[10px] text-slate-500">{n}</td>
  );
}

/** A number to at most `dp` decimals, without trailing zeros: 2.4, not 2.40. */
function fmt(v: number, dp: number): string {
  return String(Number(v.toFixed(dp)));
}
