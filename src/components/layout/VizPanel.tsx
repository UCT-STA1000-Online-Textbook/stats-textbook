/**
 * Right panel: interactive visualisations + quiz overlay.
 *
 * Subscribes to `vizStore`. When `activeViz` is set, looks up the matching
 * lazy component in `VIZ_REGISTRY` and renders it inside a `<Suspense>`
 * boundary. When `quizOpen` is true the panel splits 50/50 — the
 * visualisation stays visible on top and `QuizPanel` is mounted underneath,
 * so students can refer back to the plot while answering.
 */

"use client";

import { Suspense } from "react";
import { useVizStore } from "@/store/vizStore";
import { VIZ_REGISTRY } from "@/components/viz/VizRegistry";
import { QuizPanel } from "./QuizPanel";
import { IconChart, IconRefresh, IconSparkles } from "@/components/icons";

/**
 * Renders the active visualisation, or the placeholder if nothing is active.
 * Header bar shows the registered `vizId` and offers a Reset action that
 * clears the store back to the unit's default state.
 */
function VizArea() {
  const { activeViz, vizParams, resetViz } = useVizStore();
  const VizComponent = activeViz ? VIZ_REGISTRY[activeViz] : null;

  if (!VizComponent) return <VizPlaceholder />;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[color:var(--color-line)] bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid place-items-center w-6 h-6 rounded-md bg-slate-100 text-[color:var(--color-ink-700)]">
            <IconChart size={13} strokeWidth={2} />
          </span>
          <span className="text-[12px] font-mono text-[color:var(--color-ink-700)] truncate">
            {activeViz}
          </span>
        </div>
        <button
          onClick={resetViz}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--color-ink-500)] hover:text-[color:var(--color-ink-900)] transition-colors"
          title="Reset visualisation"
        >
          <IconRefresh size={12} strokeWidth={2} />
          Reset
        </button>
      </div>
      <Suspense fallback={<VizSkeleton />}>
        <div className="flex-1 min-h-0 p-4">
          {/* Re-key on params so a fresh `<TryThis>` click resets the
              component to the new initial state. Local interactions inside
              the viz don't change `vizParams`, so user input is preserved
              between TryThis fires. */}
          <VizComponent
            key={`${activeViz}:${JSON.stringify(vizParams)}`}
            params={vizParams}
          />
        </div>
      </Suspense>
    </div>
  );
}

/** Shimmering placeholder shown while a lazy-loaded viz component is fetching. */
function VizSkeleton() {
  return (
    <div className="flex-1 p-4">
      <div className="w-full h-full rounded-xl border border-[color:var(--color-line)] skeleton-shimmer" />
    </div>
  );
}

/**
 * Empty state shown before the student clicks any "Try this" prompt — also
 * the state for placeholder units that have no visualisations yet. Doubles
 * as a brief explanation of how the right panel is meant to be used.
 */
function VizPlaceholder() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center">
      <div className="mb-5 grid place-items-center w-16 h-16 rounded-2xl bg-white border border-[color:var(--color-line)] text-[color:var(--color-ink-500)]">
        <IconChart size={26} strokeWidth={1.6} />
      </div>

      <p className="text-sm font-semibold text-[color:var(--color-ink-900)]">
        Interactive panel
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--color-ink-500)] max-w-[260px]">
        Click a{" "}
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium text-[12px] align-baseline">
          <IconSparkles size={10} strokeWidth={2} />
          Try this
        </span>{" "}
        prompt in the reading panel to load a live visualisation here.
      </p>

      <ul className="mt-6 w-full max-w-[260px] space-y-1.5 text-left">
        {[
          "Adjust parameters and watch the plot update",
          "Toggle assumptions to build intuition",
          "Open the quiz to lock in your understanding",
        ].map((line, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[12px] text-[color:var(--color-ink-500)]"
          >
            <span className="mt-1.5 w-1 h-1 rounded-full bg-[color:var(--color-ink-300)] flex-shrink-0" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VizPanel() {
  const quizOpen = useVizStore((s) => s.quizOpen);

  return (
    <aside className="w-[440px] flex-shrink-0 border-l border-[color:var(--color-line)] bg-white overflow-hidden flex flex-col">
      {quizOpen ? (
        // Split view: viz on top, quiz on bottom. Equal halves keep the plot
        // visible so students can reference it while answering.
        <>
          <div className="h-1/2 border-b border-[color:var(--color-line)] overflow-hidden">
            <VizArea />
          </div>
          <div className="h-1/2 overflow-hidden">
            <QuizPanel />
          </div>
        </>
      ) : (
        <div className="h-full">
          <VizArea />
        </div>
      )}
    </aside>
  );
}
