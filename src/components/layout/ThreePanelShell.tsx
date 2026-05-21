/**
 * Top-level layout for a unit page.
 *
 * Wraps the three panels in `QuizProvider` so that both `Quiz` (an MDX button
 * inside the reading panel) and `QuizPanel` (hosted inside the viz panel)
 * share the same question list without prop drilling.
 *
 * The layout is adaptive (widths driven by Tailwind breakpoints + `uiStore`):
 *   - `lg`+  — three in-flow columns; the sidebar can collapse to an icon rail.
 *   - `md`   — sidebar becomes an off-canvas drawer; reading + viz stay paired.
 *   - `<md`  — single column; the viz panel becomes a slide-up bottom sheet.
 * On `<lg` a slim top bar carries the drawer and viz-sheet toggles.
 *
 * Receives validated frontmatter + compiled MDX from the Server Component
 * (`src/app/unit/[slug]/page.tsx`). All client state lives in Zustand stores;
 * this shell stays presentational.
 */

"use client";

import { Sidebar } from "./Sidebar";
import { ReadingPanel } from "./ReadingPanel";
import { VizPanel } from "./VizPanel";
import { QuizProvider } from "@/components/mdx/QuizContext";
import { useUiStore } from "@/store/uiStore";
import { IconMenu, IconChart } from "@/components/icons";
import type { UnitFrontmatter } from "@/lib/mdx";

interface ThreePanelShellProps {
  frontmatter: UnitFrontmatter;
  content: React.ReactNode;
}

export function ThreePanelShell({ frontmatter, content }: ThreePanelShellProps) {
  const navDrawerOpen = useUiStore((s) => s.navDrawerOpen);
  const vizSheetOpen = useUiStore((s) => s.vizSheetOpen);
  const setNavDrawerOpen = useUiStore((s) => s.setNavDrawerOpen);
  const setVizSheetOpen = useUiStore((s) => s.setVizSheetOpen);

  return (
    <QuizProvider slug={frontmatter.slug} questions={frontmatter.quiz}>
      <div className="flex flex-col h-screen overflow-hidden bg-[color:var(--color-paper)]">
        <MobileTopBar title={frontmatter.title} />

        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <ReadingPanel frontmatter={frontmatter} content={content} />
          <VizPanel />
        </div>

        {/* Drawer backdrop — tablet/phone only; tap to dismiss the nav. */}
        {navDrawerOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
            onClick={() => setNavDrawerOpen(false)}
            aria-hidden
          />
        )}
        {/* Bottom-sheet backdrop — phone only; tap to dismiss the viz sheet. */}
        {vizSheetOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
            onClick={() => setVizSheetOpen(false)}
            aria-hidden
          />
        )}
      </div>
    </QuizProvider>
  );
}

/**
 * Slim top bar shown only below `lg`. Carries the navigation-drawer toggle
 * (always, `<lg`) and the visualisation bottom-sheet toggle (`<md` only,
 * where the viz panel is not visible alongside the reading column).
 */
function MobileTopBar({ title }: { title: string }) {
  const setNavDrawerOpen = useUiStore((s) => s.setNavDrawerOpen);
  const vizSheetOpen = useUiStore((s) => s.vizSheetOpen);
  const setVizSheetOpen = useUiStore((s) => s.setVizSheetOpen);

  return (
    <header className="lg:hidden flex-shrink-0 flex items-center gap-2 h-12 px-3 border-b border-[color:var(--color-line)] bg-white">
      <button
        onClick={() => setNavDrawerOpen(true)}
        aria-label="Open navigation"
        className="grid place-items-center w-9 h-9 rounded-md text-[color:var(--color-ink-700)] hover:bg-slate-100 transition-colors"
      >
        <IconMenu size={18} strokeWidth={2} />
      </button>
      <span className="flex-1 min-w-0 truncate text-[13px] font-semibold tracking-tight text-[color:var(--color-ink-900)]">
        {title}
      </span>
      <button
        onClick={() => setVizSheetOpen(!vizSheetOpen)}
        aria-pressed={vizSheetOpen}
        className={`md:hidden inline-flex items-center gap-1.5 rounded-md px-2.5 h-9 text-[12px] font-medium transition-colors ${
          vizSheetOpen
            ? "bg-indigo-600 text-white"
            : "text-[color:var(--color-ink-700)] hover:bg-slate-100"
        }`}
      >
        <IconChart size={14} strokeWidth={2} />
        Visualisation
      </button>
    </header>
  );
}
