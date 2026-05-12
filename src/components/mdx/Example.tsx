/**
 * Callout for a worked example. The `title` defaults to "Example" so simple
 * cases need no props; supply one when several examples appear in a row and
 * need to be told apart, e.g. <Example title="Example 1: Fair coin">.
 */

import { ReactNode } from "react";
import { IconLightbulb } from "@/components/icons";

interface ExampleProps {
  title?: string;
  children: ReactNode;
}

export function Example({ title, children }: ExampleProps) {
  return (
    <aside className="my-5 rounded-xl bg-white border border-blue-200/70 overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2 bg-blue-50/70 border-b border-blue-200/60">
        <span className="grid place-items-center w-5 h-5 rounded-md bg-blue-500 text-white">
          <IconLightbulb size={11} strokeWidth={2.25} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          {title ?? "Example"}
        </span>
      </header>
      <div className="px-4 py-3 text-[14px] leading-relaxed text-[color:var(--color-ink-700)] [&>p]:mb-0 [&>p:not(:last-child)]:mb-2">
        {children}
      </div>
    </aside>
  );
}
