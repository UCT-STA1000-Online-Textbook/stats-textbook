/**
 * Relative-frequency convergence demo.
 *
 * Implements the law-of-large-numbers intuition that closes WU2's "Relative
 * frequencies" section: as n grows, the observed proportion r/n approaches
 * the true probability. Two experiments are supported — flipping a fair
 * coin (Pr(heads) = 0.5) and rolling a fair die (Pr(roll = 6) = 1/6).
 *
 * To stay responsive at large n, the trial buffer is downsampled to ≤500
 * points before being handed to Plot — the convergence trend is preserved
 * but the chart no longer redraws a line of thousands of nodes.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import * as Plot from "@observablehq/plot";
import type { VizParams } from "@/store/vizStore";

type Experiment = "coin" | "die";

interface Trial {
  n: number;
  cumulative: number;
  freq: number;
}

const TRUE_PROB: Record<Experiment, { value: number; label: string }> = {
  coin: { value: 0.5, label: "Pr(heads) = 0.5" },
  die: { value: 1 / 6, label: "Pr(roll a 6) ≈ 0.167" },
};

const MAX_PLOT_POINTS = 500;

/**
 * @param params.experiment — initial experiment ("coin" | "die"); default "coin".
 */
export default function RelativeFrequency({ params }: { params: VizParams }) {
  const initialExp: Experiment =
    params.experiment === "die" ? "die" : "coin";
  const [experiment, setExperiment] = useState<Experiment>(initialExp);
  const [trials, setTrials] = useState<Trial[]>([]);

  // VizPanel re-keys on params change so a different TryThis prompt remounts
  // this component with the right experiment selected.

  const plotRef = useRef<HTMLDivElement>(null);

  // Render the Plot chart whenever trials change, and on container resize so
  // the chart stays full-width inside the right panel.
  useEffect(() => {
    const container = plotRef.current;
    if (!container) return;

    const render = () => {
      container.innerHTML = "";
      const width = container.clientWidth || 380;
      const height = container.clientHeight || 220;

      if (trials.length === 0) {
        const empty = document.createElement("div");
        empty.className =
          "h-full grid place-items-center text-[12px] text-[color:var(--color-ink-500)]";
        empty.textContent = "Click +1, +10 or +100 below to run trials.";
        container.appendChild(empty);
        return;
      }

      const trueProb = TRUE_PROB[experiment].value;
      const last = trials[trials.length - 1];
      const chart = Plot.plot({
        width,
        height,
        marginLeft: 48,
        marginBottom: 32,
        marginTop: 18,
        marginRight: 16,
        x: {
          label: "Number of trials (n)",
          grid: true,
          // Switch to log scale once we have enough trials so the early
          // wild swings stay visible while the long tail compresses.
          type: last.n > 200 ? "log" : "linear",
        },
        y: {
          label: "r / n",
          domain: [0, 1],
          grid: true,
          ticks: 5,
        },
        marks: [
          Plot.ruleY([trueProb], {
            stroke: "rgb(15, 23, 42)",
            strokeDasharray: "4 3",
          }),
          Plot.line(trials, {
            x: "n",
            y: "freq",
            stroke: "rgb(37, 99, 235)",
            strokeWidth: 2,
          }),
          Plot.dot([last], {
            x: "n",
            y: "freq",
            r: 4,
            fill: "rgb(37, 99, 235)",
          }),
        ],
      });
      container.appendChild(chart);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(container);
    return () => observer.disconnect();
  }, [trials, experiment]);

  /** One Bernoulli trial under the current experiment. */
  function singleTrial(): boolean {
    if (experiment === "coin") return Math.random() < 0.5;
    return Math.floor(Math.random() * 6) + 1 === 6;
  }

  /** Append k trials in sequence, downsampling if we exceed MAX_PLOT_POINTS. */
  function addTrials(k: number) {
    setTrials((prev) => {
      const start =
        prev.length > 0
          ? prev[prev.length - 1]
          : { n: 0, cumulative: 0, freq: 0 };
      let { n, cumulative } = start;
      const next: Trial[] = [];
      for (let i = 0; i < k; i++) {
        n += 1;
        if (singleTrial()) cumulative += 1;
        next.push({ n, cumulative, freq: cumulative / n });
      }
      const combined = [...prev, ...next];
      if (combined.length <= MAX_PLOT_POINTS) return combined;
      // Even-stride decimation, with the final point always preserved so the
      // current relative frequency is shown exactly.
      const stride = Math.ceil(combined.length / MAX_PLOT_POINTS);
      const decimated = combined.filter(
        (_, i) => i % stride === 0 || i === combined.length - 1,
      );
      return decimated;
    });
  }

  function reset() {
    setTrials([]);
  }

  const last =
    trials.length > 0
      ? trials[trials.length - 1]
      : { n: 0, cumulative: 0, freq: 0 };

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-[color:var(--color-line)] overflow-hidden">
          <button
            onClick={() => {
              setExperiment("coin");
              reset();
            }}
            className={`px-3 py-1 text-[11px] font-medium transition-colors ${
              experiment === "coin"
                ? "bg-blue-600 text-white"
                : "bg-white text-[color:var(--color-ink-700)] hover:bg-blue-50"
            }`}
          >
            Coin (heads)
          </button>
          <button
            onClick={() => {
              setExperiment("die");
              reset();
            }}
            className={`px-3 py-1 text-[11px] font-medium transition-colors ${
              experiment === "die"
                ? "bg-blue-600 text-white"
                : "bg-white text-[color:var(--color-ink-700)] hover:bg-blue-50"
            }`}
          >
            Die (roll a 6)
          </button>
        </div>
        <span className="text-[11px] text-[color:var(--color-ink-500)] font-mono">
          {TRUE_PROB[experiment].label}
        </span>
      </div>

      <div
        ref={plotRef}
        className="flex-1 min-h-0 rounded-lg border border-[color:var(--color-line)] bg-white p-1"
      />

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => addTrials(1)}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-colors"
        >
          +1 trial
        </button>
        <button
          onClick={() => addTrials(10)}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-colors"
        >
          +10 trials
        </button>
        <button
          onClick={() => addTrials(100)}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-colors"
        >
          +100 trials
        </button>
      </div>

      <div className="rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Trials (n)" value={String(last.n)} />
          <Stat label="Successes (r)" value={String(last.cumulative)} />
          <Stat
            label="r / n"
            value={last.n > 0 ? last.freq.toFixed(3) : "—"}
          />
        </div>
        <div className="mt-2 flex justify-end">
          <button
            onClick={reset}
            className="text-[11px] font-medium text-[color:var(--color-ink-500)] hover:text-[color:var(--color-ink-900)] transition-colors"
          >
            Reset trials
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
        {label}
      </p>
      <p className="text-[15px] font-mono text-[color:var(--color-ink-900)] tabular-nums">
        {value}
      </p>
    </div>
  );
}
