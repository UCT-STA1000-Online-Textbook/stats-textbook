/**
 * Top-level layout for a unit page.
 *
 * Wraps the three panels in `QuizProvider` so that both `Quiz` (an MDX button
 * inside the reading panel) and `QuizPanel` (the quiz UI inside the viz
 * panel) share the same question list without prop drilling.
 *
 * Receives validated frontmatter + compiled MDX from the Server Component
 * (`src/app/unit/[slug]/page.tsx`). All client state (active viz, quiz open,
 * progress) lives in Zustand stores; this shell stays presentational.
 */

"use client";

import { Sidebar } from "./Sidebar";
import { ReadingPanel } from "./ReadingPanel";
import { VizPanel } from "./VizPanel";
import { QuizProvider } from "@/components/mdx/QuizContext";
import type { UnitFrontmatter } from "@/lib/mdx";

interface ThreePanelShellProps {
  frontmatter: UnitFrontmatter;
  content: React.ReactNode;
}

export function ThreePanelShell({ frontmatter, content }: ThreePanelShellProps) {
  return (
    <QuizProvider slug={frontmatter.slug} questions={frontmatter.quiz}>
      <div className="flex h-screen overflow-hidden bg-[color:var(--color-paper)]">
        <Sidebar />
        <ReadingPanel frontmatter={frontmatter} content={content} />
        <VizPanel />
      </div>
    </QuizProvider>
  );
}
