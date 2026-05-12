/**
 * Callout for a theorem or formal proposition. Visually quieter than
 * Definition/Example so that the mathematical statement itself reads as
 * the focal point, not the chrome around it. Used inside MDX:
 *
 *   <Theorem name="Bayes' Rule">
 *     For events $A, B$ with $P(B) > 0$, …
 *   </Theorem>
 */

import { ReactNode } from "react";
import { IconScale } from "@/components/icons";

interface TheoremProps {
  name: string;
  children: ReactNode;
}

export function Theorem({ name, children }: TheoremProps) {
  return (
    <aside className="my-5 rounded-xl bg-white border border-[color:var(--color-line-strong)] overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-[color:var(--color-line)]">
        <span className="grid place-items-center w-5 h-5 rounded-md bg-[color:var(--color-ink-900)] text-white">
          <IconScale size={11} strokeWidth={2.25} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-ink-700)]">
          Theorem
        </span>
      </header>
      <div className="px-4 py-3">
        <p className="font-semibold text-[color:var(--color-ink-900)] tracking-tight">
          {name}
        </p>
        <div className="mt-1 text-[14px] leading-relaxed text-[color:var(--color-ink-700)] [&>p]:mb-0 [&>p:not(:last-child)]:mb-2">
          {children}
        </div>
      </div>
    </aside>
  );
}
