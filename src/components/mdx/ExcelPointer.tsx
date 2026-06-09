/**
 * "Excel pointer" callout for the data-handling units.
 *
 * STA1000 students do their frequency tables, charts and histograms in Excel,
 * so the notes pair each construction with a step-by-step Excel recipe. This
 * box carries those written steps now and reserves a clearly-marked dashed
 * slot for a screenshot the lecturer drops in later — matching the WU brief to
 * "leave blank boxes to be filled in later for Excel pointers". Its distinct
 * green styling makes every Excel aside easy to spot (and easy to find when
 * adding the screenshots).
 *
 * Usage in MDX:
 *   <ExcelPointer title="Frequency table with COUNTIF">
 *     1. Type the category labels into column A …
 *   </ExcelPointer>
 *
 * Set `screenshot={false}` for a pointer that is purely textual and needs no
 * image placeholder.
 */

import { ReactNode } from "react";
import { IconTable } from "@/components/icons";

interface ExcelPointerProps {
  /** Short label for what this Excel recipe produces. */
  title: string;
  /** Whether to show the dashed "screenshot to be added" slot. Defaults to true. */
  screenshot?: boolean;
  children: ReactNode;
}

/** Green-accented Excel how-to box with an optional screenshot placeholder. */
export function ExcelPointer({ title, screenshot = true, children }: ExcelPointerProps) {
  return (
    <aside className="my-5 rounded-xl bg-white border border-emerald-300/70 overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2 bg-emerald-50/80 border-b border-emerald-200/60">
        <span className="grid place-items-center w-5 h-5 rounded-md bg-emerald-600 text-white">
          <IconTable size={11} strokeWidth={2} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
          Excel pointer
        </span>
        <span className="text-[12px] font-medium text-[color:var(--color-ink-700)]">
          · {title}
        </span>
      </header>
      <div className="px-4 py-3">
        <div className="text-[13.5px] leading-relaxed text-[color:var(--color-ink-700)] [&>p]:mb-0 [&>p:not(:last-child)]:mb-2 [&_ol]:mt-1 [&_ol]:space-y-1 [&_code]:rounded [&_code]:bg-emerald-50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12.5px] [&_code]:text-emerald-800">
          {children}
        </div>
        {screenshot && (
          // Placeholder for the lecturer's Excel screenshot, added later.
          <div className="mt-3 grid place-items-center rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 py-5 text-center">
            <p className="text-[12px] font-medium text-emerald-700">
              Excel screenshot to be added
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
