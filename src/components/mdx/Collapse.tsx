/**
 * Generic collapsible section with a clickable title bar.
 *
 * Used in MDX to fold long, secondary content — exercise lists and their
 * solution sets — so the reading flow isn't dominated by problem sets the
 * student works through separately. Distinct from <Solution>, which is the
 * smaller in-example reveal; <Collapse> is a standalone section accordion.
 */

"use client";

import { useState, type ReactNode } from "react";
import { IconChevronDown } from "@/components/icons";

interface CollapseProps {
  /** Heading shown on the always-visible toggle bar. */
  title: string;
  /** Optional faint hint beside the title, e.g. a question count. */
  hint?: string;
  children: ReactNode;
}

/**
 * Renders a title bar that toggles the visibility of its children.
 *
 * @param title — bar label, always visible.
 * @param hint — optional secondary text (e.g. "9 questions"); omit if not useful.
 * @param children — the foldable content; collapsed by default.
 */
export function Collapse({ title, hint, children }: CollapseProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="my-6 rounded-xl border border-[color:var(--color-line)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left"
      >
        <IconChevronDown
          size={16}
          strokeWidth={2.25}
          className={`shrink-0 text-[color:var(--color-ink-500)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
        <span className="text-[14px] font-semibold text-[color:var(--color-ink-900)]">
          {title}
        </span>
        {hint && (
          <span className="text-[12px] text-[color:var(--color-ink-400)]">
            {hint}
          </span>
        )}
      </button>

      {/* Mounted only when open so collapsed maths isn't measured up-front. */}
      {open && (
        <div className="px-4 pb-1 border-t border-[color:var(--color-line)]">
          {children}
        </div>
      )}
    </div>
  );
}
