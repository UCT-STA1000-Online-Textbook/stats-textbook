/**
 * Centre panel: the reading area for a single work unit.
 *
 * Receives the compiled MDX `content` and validated `frontmatter` from the
 * unit page (a Server Component) and renders an editorial article layout —
 * breadcrumb, title, status badges, MDX body, and prev/next pagination.
 *
 * Side-effect: when the slug changes (i.e. user navigates between units),
 * resets the right-hand panel — closes any open quiz and either loads the
 * unit's `defaultViz` or clears the visualisation entirely. This keeps the
 * three panels consistent without coupling routing to the viz store.
 */

"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useVizStore } from "@/store/vizStore";
import type { VizParams } from "@/store/vizStore";
import type { UnitFrontmatter } from "@/lib/mdx";
import { ALL_UNITS } from "@/content/units";
import { useProgressStore } from "@/store/progressStore";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconAlert,
} from "@/components/icons";

interface ReadingPanelProps {
  frontmatter: UnitFrontmatter;
  content: React.ReactNode;
}

export function ReadingPanel({ frontmatter, content }: ReadingPanelProps) {
  const setViz = useVizStore((s) => s.setViz);
  const resetViz = useVizStore((s) => s.resetViz);
  const setQuizOpen = useVizStore((s) => s.setQuizOpen);
  const getUnitProgress = useProgressStore((s) => s.getUnitProgress);
  const progress = getUnitProgress(frontmatter.slug);

  // Look up neighbouring units once per navigation so the prev/next cards can
  // show the actual unit titles instead of generic "Previous"/"Next" labels.
  const prev = useMemo(
    () => ALL_UNITS.find((u) => u.slug === frontmatter.prevUnit),
    [frontmatter.prevUnit]
  );
  const next = useMemo(
    () => ALL_UNITS.find((u) => u.slug === frontmatter.nextUnit),
    [frontmatter.nextUnit]
  );

  // Reset right-panel state on unit navigation. Depending only on `slug`
  // is intentional — the setters from the store are stable references.
  useEffect(() => {
    setQuizOpen(false);
    if (frontmatter.defaultViz) {
      setViz(
        frontmatter.defaultViz,
        (frontmatter.defaultVizParams as VizParams) ?? {}
      );
    } else {
      resetViz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontmatter.slug]);

  return (
    <main className="flex-1 min-w-0 overflow-y-auto">
      <article className="max-w-[680px] mx-auto px-10 py-12 animate-soft-fade">
        <header className="mb-10">
          {/* Breadcrumb: module · work-unit position · global position */}
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--color-ink-500)]">
            <span className="text-[color:var(--color-ink-700)]">
              {frontmatter.moduleTitle}
            </span>
            <span className="text-[color:var(--color-ink-300)]">/</span>
            <span>Work Unit {frontmatter.unitNumber}</span>
            <span className="text-[color:var(--color-ink-300)]">·</span>
            <span className="tabular-nums">
              {String(frontmatter.unitNumber).padStart(2, "0")} of 22
            </span>
          </div>

          <h1 className="mt-3 text-[34px] leading-[1.15] font-semibold tracking-tight text-[color:var(--color-ink-900)]">
            {frontmatter.title}
          </h1>

          {/* Status row: editorial status + completion + quiz length, in that order */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={frontmatter.status} />
            {progress?.completed && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                <IconCheck size={12} strokeWidth={2.5} />
                Completed · {progress.score}/{progress.totalQuestions}
              </span>
            )}
            {!progress?.completed && (progress?.attempts ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/70 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                Best score: {progress?.score}/{progress?.totalQuestions}
              </span>
            )}
            {frontmatter.quiz.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-[color:var(--color-line)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--color-ink-500)]">
                {frontmatter.quiz.length} quiz{" "}
                {frontmatter.quiz.length === 1 ? "question" : "questions"}
              </span>
            )}
          </div>

          {frontmatter.status === "placeholder" && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 p-4">
              <span className="grid place-items-center w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex-shrink-0">
                <IconAlert size={14} strokeWidth={2} />
              </span>
              <div className="text-sm text-amber-900 leading-relaxed">
                <p className="font-medium">Content coming soon</p>
                <p className="text-amber-800/80 mt-0.5">
                  This work unit is awaiting lecture notes. Interactive
                  elements and quiz questions will follow once the content is
                  in place.
                </p>
              </div>
            </div>
          )}
        </header>

        <div className="reading-body">{content}</div>

        {/* Pagination cards — show the actual neighbour titles, not generic labels. */}
        <nav className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[color:var(--color-line)] pt-8">
          {prev ? (
            <Link
              href={`/unit/${prev.slug}`}
              className="group hover-lift rounded-xl border border-[color:var(--color-line)] bg-white px-4 py-3 hover:border-indigo-300 hover:shadow-sm"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-ink-500)] group-hover:text-indigo-600 transition-colors">
                <IconArrowLeft size={12} strokeWidth={2.25} />
                Previous
              </span>
              <span className="mt-1 block text-sm font-semibold text-[color:var(--color-ink-900)] truncate">
                {prev.title}
              </span>
            </Link>
          ) : (
            // First unit has no prev — render an empty cell so the next card
            // stays in the right column on the two-column layout.
            <span />
          )}
          {next ? (
            <Link
              href={`/unit/${next.slug}`}
              className="group hover-lift rounded-xl border border-[color:var(--color-line)] bg-white px-4 py-3 text-right hover:border-indigo-300 hover:shadow-sm sm:col-start-2"
            >
              <span className="flex items-center justify-end gap-1.5 text-[11px] font-medium uppercase tracking-wider text-indigo-600">
                Next
                <IconArrowRight size={12} strokeWidth={2.25} />
              </span>
              <span className="mt-1 block text-sm font-semibold text-[color:var(--color-ink-900)] truncate">
                {next.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
    </main>
  );
}

/**
 * Editorial status pill that maps the frontmatter `status` to a colour:
 * indigo (final), amber (draft, in-progress), neutral (placeholder).
 */
function StatusBadge({ status }: { status: UnitFrontmatter["status"] }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200/70 px-2.5 py-1 text-[11px] font-medium text-indigo-700">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
        Final
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/70 px-2.5 py-1 text-[11px] font-medium text-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-[color:var(--color-line)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--color-ink-500)]">
      <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-ink-400)]" />
      Placeholder
    </span>
  );
}
