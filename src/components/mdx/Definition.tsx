/**
 * Callout for a formal definition. The `term` is the headword being defined;
 * the body (children) carries the definition text. Used inside MDX:
 *
 *   <Definition term="Sample space">
 *     The set of all possible outcomes of an experiment.
 *   </Definition>
 */

import { ReactNode } from "react";
import { IconBookOpen } from "@/components/icons";

interface DefinitionProps {
  term: string;
  children: ReactNode;
}

export function Definition({ term, children }: DefinitionProps) {
  return (
    <aside className="my-5 rounded-xl bg-white border border-emerald-200/70 overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2 bg-emerald-50/70 border-b border-emerald-200/60">
        <span className="grid place-items-center w-5 h-5 rounded-md bg-emerald-500 text-white">
          <IconBookOpen size={11} strokeWidth={2.25} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
          Definition
        </span>
      </header>
      <div className="px-4 py-3">
        <p className="font-semibold text-[color:var(--color-ink-900)] tracking-tight">
          {term}
        </p>
        {/* Strip the trailing margin from the last paragraph so the card
            doesn't have asymmetric internal whitespace. */}
        <div className="mt-1 text-[14px] leading-relaxed text-[color:var(--color-ink-700)] [&>p]:mb-0 [&>p:not(:last-child)]:mb-2">
          {children}
        </div>
      </div>
    </aside>
  );
}
