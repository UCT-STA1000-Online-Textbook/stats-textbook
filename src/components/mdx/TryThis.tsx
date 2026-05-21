/**
 * Inline prompt embedded in MDX content. Clicking it loads a registered
 * visualisation into the right panel via `vizStore.setViz`.
 *
 * Usage in MDX:
 *   <TryThis vizId="histogram" params={{ bins: 12 }} description="…" />
 *
 * The card highlights itself when its `vizId` matches the currently active
 * visualisation, giving the student a clear visual tether between the prose
 * and what's being shown on the right.
 */

"use client";

import { useVizStore, VizParams } from "@/store/vizStore";
import { useUiStore } from "@/store/uiStore";
import { IconSparkles, IconArrowRight } from "@/components/icons";

interface TryThisProps {
  /** Key into `VIZ_REGISTRY` — must match a registered component. */
  vizId: string;
  /** Parameters forwarded to the viz component (each viz supplies defaults). */
  params?: VizParams;
  /** Button label. Defaults to "Try this". */
  label?: string;
  /** Optional one-line description shown above the button. */
  description?: string;
}

export function TryThis({
  vizId,
  params = {},
  label = "Try this",
  description,
}: TryThisProps) {
  const setViz = useVizStore((s) => s.setViz);
  const activeViz = useVizStore((s) => s.activeViz);
  const setVizSheetOpen = useUiStore((s) => s.setVizSheetOpen);
  const isActive = activeViz === vizId;

  /**
   * Load the viz and, on phone widths, raise the bottom sheet so the result
   * is actually visible. The sheet flag is inert on `md`+, where the viz
   * panel is always on screen.
   */
  function handleClick() {
    setViz(vizId, params);
    setVizSheetOpen(true);
  }

  return (
    <div
      className={`my-5 rounded-xl border p-4 transition-colors ${
        isActive
          ? "bg-indigo-50/60 border-indigo-200"
          : "bg-white border-[color:var(--color-line)] hover:border-indigo-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex-shrink-0 grid place-items-center w-8 h-8 rounded-lg transition-colors ${
            isActive
              ? "bg-indigo-600 text-white"
              : "bg-indigo-50 text-indigo-600"
          }`}
        >
          <IconSparkles size={15} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
            Interactive
          </p>
          {description && (
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-[color:var(--color-ink-700)]">
              {description}
            </p>
          )}
          <button
            onClick={handleClick}
            className="mt-2.5 group inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            {label}
            <IconArrowRight
              size={13}
              strokeWidth={2.25}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
          {isActive && (
            <p className="mt-2 text-[11px] font-medium text-indigo-700">
              Active in the right panel →
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
