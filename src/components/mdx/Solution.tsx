/**
 * Collapsible solution reveal, designed to sit as the last child of an
 * <Example> block.
 *
 * Worked-example solutions are hidden behind a "Show solution" toggle so
 * students attempt the problem before seeing the answer. The example's
 * question text remains visible above this component at all times.
 */

"use client";

import { useState, type ReactNode } from "react";
import { IconChevronDown } from "@/components/icons";

interface SolutionProps {
  children: ReactNode;
}

/**
 * Renders a toggle button plus the collapsed solution body.
 *
 * @param children — the worked solution; shown only once the student
 *   clicks the toggle, hidden again on a second click.
 */
export function Solution({ children }: SolutionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 border-t border-blue-200/60 pt-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-blue-700 hover:text-blue-900 transition-colors"
      >
        <IconChevronDown
          size={14}
          strokeWidth={2.5}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        {open ? "Hide solution" : "Show solution"}
      </button>

      {/* Mounted only when open so collapsed KaTeX/maths isn't measured or
          read out by assistive tech. */}
      {open && (
        <div className="mt-2 rounded-lg bg-blue-50/60 px-3 py-2.5 [&>p]:mb-0 [&>p:not(:last-child)]:mb-2">
          {children}
        </div>
      )}
    </div>
  );
}
