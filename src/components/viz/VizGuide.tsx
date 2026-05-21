/**
 * Compact "how to use" helper shown inside a visualisation.
 *
 * Interactive viz can leave students unsure what they can touch. `VizGuide`
 * renders a small button that toggles a short numbered list of instructions —
 * a consistent, low-clutter explainer used by every viz in `VIZ_REGISTRY`.
 *
 * The popover opens toward whichever side of the button has more room (so a
 * guide near the bottom of the panel doesn't run off-screen), and a tap
 * anywhere outside it closes it.
 */

"use client";

import { useRef, useState } from "react";

interface VizGuideProps {
  /** Short instruction lines, shown numbered in the order given. */
  steps: string[];
}

/** Toggle button + popover panel listing how to operate the visualisation. */
export function VizGuide({ steps }: VizGuideProps) {
  const [open, setOpen] = useState(false);
  /** Whether the panel opens upward (true) or downward (false). */
  const [openUp, setOpenUp] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    // Decide direction the moment we open: drop toward the larger gap so the
    // panel stays fully on screen wherever the button sits in the panel.
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setOpenUp(rect.top > window.innerHeight - rect.bottom);
    }
    setOpen((o) => !o);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md border border-[color:var(--color-line)] bg-white px-2 py-1 text-[11px] font-medium text-[color:var(--color-ink-500)] transition-colors hover:border-indigo-300 hover:text-[color:var(--color-ink-900)]"
      >
        <span className="grid place-items-center w-3.5 h-3.5 rounded-full bg-indigo-500 text-[9px] font-bold text-white">
          i
        </span>
        How to use
      </button>

      {open && (
        <>
          {/* Full-screen catcher — a tap anywhere outside the panel closes it. */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute right-0 z-20 w-[252px] rounded-lg border border-[color:var(--color-line)] bg-white p-3 shadow-lg ${
              openUp ? "bottom-full mb-1" : "top-full mt-1"
            }`}
          >
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
              How this works
            </p>
            <ol className="space-y-1.5 text-[12px] leading-snug text-[color:var(--color-ink-700)]">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="font-semibold text-indigo-500">
                    {i + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
