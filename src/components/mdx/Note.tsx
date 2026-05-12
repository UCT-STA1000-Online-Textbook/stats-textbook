/**
 * Quiet sidebar note for asides and clarifications. Use sparingly — heavier
 * callouts (Definition/Theorem/Example) carry more weight and should be
 * preferred when the content is part of the core argument. Reserve `<Note>`
 * for "by the way" remarks that the student can skim past.
 */

import { ReactNode } from "react";
import { IconNote } from "@/components/icons";

export function Note({ children }: { children: ReactNode }) {
  return (
    <aside className="my-5 rounded-xl border border-[color:var(--color-line)] bg-slate-50/60 px-4 py-3 flex gap-3">
      <span className="flex-shrink-0 grid place-items-center w-6 h-6 rounded-md bg-white border border-[color:var(--color-line)] text-[color:var(--color-ink-500)]">
        <IconNote size={12} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-500)]">
          Note
        </p>
        <div className="mt-0.5 text-[13.5px] leading-relaxed text-[color:var(--color-ink-700)] [&>p]:mb-0 [&>p:not(:last-child)]:mb-2">
          {children}
        </div>
      </div>
    </aside>
  );
}
