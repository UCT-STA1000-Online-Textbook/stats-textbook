/**
 * Right panel: interactive visualisations + the section quiz.
 *
 * Subscribes to `vizStore`. When `activeViz` is set, looks up the matching
 * lazy component in `VIZ_REGISTRY` and renders it inside a `<Suspense>`
 * boundary, itself wrapped in an error boundary so a failed chunk load or a
 * runtime error in a visualisation shows a readable message instead of
 * blanking the panel or crashing the app.
 *
 * When `quizOpen` is true the panel hosts `QuizPanel` too, in one of two
 * layouts (`quizExpanded`):
 *   - split    — the viz keeps a fixed, comfortable height on top and the
 *                quiz fills the space below; both stay usable at once.
 *   - expanded — the quiz fills the panel and the viz collapses to a thin
 *                "Show visualisation" strip, one tap from being restored.
 * The split is chosen per device on open: phones default to expanded (a
 * split leaves the quiz too short), larger screens default to split.
 *
 * Responsive behaviour (driven by `uiStore`):
 *   - `md`+  — an in-flow column to the right of the reading area.
 *   - `<md`  — a slide-up bottom sheet toggled by `vizSheetOpen`.
 */

"use client";

import { Component, Suspense, useState, type ReactNode } from "react";
import { useVizStore } from "@/store/vizStore";
import { useUiStore } from "@/store/uiStore";
import { VIZ_REGISTRY } from "@/components/viz/VizRegistry";
import { QuizPanel } from "./QuizPanel";
import {
  IconChart,
  IconChevronDown,
  IconClose,
  IconRefresh,
  IconSparkles,
} from "@/components/icons";

/**
 * Catches render-time and lazy-load failures from a visualisation component.
 * A 3D/WebGL viz can legitimately fail on some devices, and a stale dev server
 * can reject the lazy `import()` — without this the error would unmount the
 * whole panel tree with no on-screen explanation. Re-key this boundary (on the
 * active viz id) so picking a different visualisation clears a prior error.
 */
class VizErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface the full stack in the console for debugging.
    console.error("Visualisation failed:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full grid place-items-center p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-[color:var(--color-ink-900)]">
              This visualisation failed to load
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[color:var(--color-ink-500)]">
              {this.state.error.message}
            </p>
            <p className="mt-2 text-[11px] text-[color:var(--color-ink-400)]">
              See the browser console for details.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      {/* Re-key the boundary on viz + params so every `<TryThis>` click
          clears any error from a previous visualisation. */}
      <VizErrorBoundary key={`${activeViz}:${JSON.stringify(vizParams)}`}>
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
      </VizErrorBoundary>
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
  const vizSheetOpen = useUiStore((s) => s.vizSheetOpen);
  const setVizSheetOpen = useUiStore((s) => s.setVizSheetOpen);
  const quizOpen = useVizStore((s) => s.quizOpen);

  /**
   * Quiz layout within the panel. `false` → split (viz fixed on top, quiz
   * below); `true` → quiz fills the panel and the viz collapses to a strip.
   */
  const [quizExpanded, setQuizExpanded] = useState(false);

  // Default the layout per device the moment the quiz opens — phones expanded,
  // larger screens split (see file header). This is React's "adjust state on
  // a changing input" pattern: the transition is detected and state set during
  // render, so there is no effect round-trip. `window` is only read on the
  // open transition, which can only happen on the client.
  const [prevQuizOpen, setPrevQuizOpen] = useState(quizOpen);
  if (quizOpen !== prevQuizOpen) {
    setPrevQuizOpen(quizOpen);
    if (quizOpen) setQuizExpanded(window.innerWidth < 768);
  }

  return (
    <aside
      className={`fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden rounded-t-2xl border-t border-[color:var(--color-line)] bg-white shadow-2xl transition-transform duration-300 h-[82dvh] md:static md:z-auto md:h-auto md:translate-y-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none md:transition-none md:flex-shrink-0 md:w-[420px] lg:w-[540px] xl:w-[600px] ${
        vizSheetOpen ? "translate-y-0" : "translate-y-full"
      }`}
    >
      {/* Bottom-sheet grabber — phone only; the close button dismisses the sheet. */}
      <div className="md:hidden relative flex-shrink-0 flex items-center justify-center py-2 border-b border-[color:var(--color-line)]">
        <span className="h-1 w-9 rounded-full bg-slate-300" aria-hidden />
        <button
          onClick={() => setVizSheetOpen(false)}
          aria-label="Close panel"
          className="absolute right-2 grid place-items-center w-7 h-7 rounded-md text-[color:var(--color-ink-400)] hover:bg-slate-100 hover:text-[color:var(--color-ink-900)] transition-colors"
        >
          <IconClose size={14} strokeWidth={2} />
        </button>
      </div>

      {quizOpen ? (
        <div className="flex-1 min-h-0 flex flex-col">
          {quizExpanded ? (
            // Collapsed viz — a one-tap strip back to the split layout.
            <button
              onClick={() => setQuizExpanded(false)}
              className="flex-shrink-0 flex items-center gap-2 px-4 h-9 border-b border-[color:var(--color-line)] bg-slate-50 text-[12px] font-medium text-[color:var(--color-ink-700)] hover:bg-slate-100 transition-colors"
            >
              <IconChart
                size={13}
                strokeWidth={2}
                className="text-[color:var(--color-ink-500)]"
              />
              Show visualisation
              <IconChevronDown
                size={13}
                strokeWidth={2}
                className="ml-auto text-[color:var(--color-ink-400)]"
              />
            </button>
          ) : (
            // Split — the viz keeps a fixed, comfortable height so it is
            // never squashed; the quiz below takes the remaining space.
            <div className="flex-shrink-0 grow-0 basis-[clamp(380px,48%,520px)] border-b border-[color:var(--color-line)]">
              <VizArea />
            </div>
          )}
          <div className="flex-1 min-h-0">
            <QuizPanel
              expanded={quizExpanded}
              onToggleExpanded={() => setQuizExpanded((e) => !e)}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <VizArea />
        </div>
      )}
    </aside>
  );
}
