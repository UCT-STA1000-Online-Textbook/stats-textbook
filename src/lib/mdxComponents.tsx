/**
 * Component map fed into `compileMDX` (see `src/lib/mdx.ts`). Every key here
 * is reachable from MDX content:
 *
 *   - Custom components (`TryThis`, `Quiz`, `Definition`, …) are used by
 *     name in the MDX source.
 *   - HTML element overrides (`h1`, `p`, `table`, …) supply the project's
 *     typography defaults so authors can write plain Markdown and still get
 *     consistent, well-spaced output.
 *
 * Anything not overridden falls back to the default MDX renderer.
 */

import type { MDXComponents } from "mdx/types";
import { TryThis } from "@/components/mdx/TryThis";
import { Quiz } from "@/components/mdx/Quiz";
import { Definition } from "@/components/mdx/Definition";
import { Theorem } from "@/components/mdx/Theorem";
import { Example } from "@/components/mdx/Example";
import { Solution } from "@/components/mdx/Solution";
import { Collapse } from "@/components/mdx/Collapse";
import { Note } from "@/components/mdx/Note";
import { ExcelPointer } from "@/components/mdx/ExcelPointer";
import { KeywordChip } from "@/components/mdx/KeywordChip";

export const mdxComponents: MDXComponents = {
  TryThis,
  Quiz,
  Definition,
  Theorem,
  Example,
  Solution,
  Collapse,
  Note,
  ExcelPointer,
  KeywordChip,

  // Heading scale: h1 is the unit title and is rendered by `ReadingPanel`,
  // so MDX-level h1s should be rare — they exist mainly for internal
  // sub-sections of long-form content.
  h1: (props) => (
    <h1
      className="mt-12 mb-4 text-[28px] leading-[1.2] font-semibold tracking-tight text-[color:var(--color-ink-900)]"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="mt-10 mb-3 text-[22px] leading-snug font-semibold tracking-tight text-[color:var(--color-ink-900)] scroll-mt-24"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="mt-7 mb-2 text-[17px] leading-snug font-semibold text-[color:var(--color-ink-900)]"
      {...props}
    />
  ),
  h4: (props) => (
    <h4
      className="mt-5 mb-1.5 text-[14px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-500)]"
      {...props}
    />
  ),

  // Body copy — `tnum` enables tabular numerals so embedded numbers (means,
  // counts, p-values) line up vertically in stats text.
  p: (props) => (
    <p
      className="mb-4 text-[15px] leading-[1.75] text-[color:var(--color-ink-700)] tnum"
      {...props}
    />
  ),

  // Custom unordered marker via ::before — Tailwind's default disc bullets
  // collide with KaTeX baseline alignment, so we render our own dot.
  ul: (props) => (
    <ul
      className="mb-5 ml-1 space-y-1.5 text-[15px] leading-[1.7] text-[color:var(--color-ink-700)] [&>li]:relative [&>li]:pl-5 [&>li]:before:content-[''] [&>li]:before:absolute [&>li]:before:left-1 [&>li]:before:top-[0.7em] [&>li]:before:w-1 [&>li]:before:h-1 [&>li]:before:rounded-full [&>li]:before:bg-[color:var(--color-ink-300)]"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mb-5 ml-5 list-decimal space-y-1.5 text-[15px] leading-[1.7] text-[color:var(--color-ink-700)] marker:text-[color:var(--color-ink-400)] marker:font-medium"
      {...props}
    />
  ),
  li: (props) => (
    <li className="text-[color:var(--color-ink-700)]" {...props} />
  ),

  // Tables — wrapped in a scroll container so wide stat tables don't break
  // the prose column on narrow viewports.
  table: (props) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-[color:var(--color-line)]">
      {/* The last body row drops its cell bottom-borders so the divider doesn't
          double up against the container's border. */}
      <table
        className="w-full border-collapse text-[13.5px] tabular-nums [&_tbody_tr:last-child_td]:border-b-0"
        {...props}
      />
    </div>
  ),
  thead: (props) => (
    <thead
      className="bg-slate-50/80 text-[color:var(--color-ink-700)]"
      {...props}
    />
  ),
  th: (props) => (
    <th
      className="px-3 py-2 text-left font-semibold border-b border-[color:var(--color-line)]"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="px-3 py-2 border-b border-[color:var(--color-line)] text-[color:var(--color-ink-700)]"
      {...props}
    />
  ),

  blockquote: (props) => (
    <blockquote
      className="my-5 border-l-2 border-indigo-300 pl-4 italic text-[color:var(--color-ink-500)]"
      {...props}
    />
  ),

  // Centre-anchored hairline rule — plain `border-t` reads too heavy in body copy.
  hr: () => (
    <hr className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-line-strong)] to-transparent" />
  ),

  // Inline code — `before:content-none after:content-none` strips the
  // Tailwind Typography backticks that would otherwise appear around the
  // code element when prose styles are applied above.
  code: (props) => (
    <code
      className="rounded-md bg-slate-100/80 border border-[color:var(--color-line)] px-1.5 py-0.5 font-mono text-[0.86em] text-[color:var(--color-ink-900)] before:content-none after:content-none"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="my-5 rounded-xl bg-[color:var(--color-ink-900)] text-slate-100 p-4 overflow-x-auto text-[13px] leading-relaxed font-mono"
      {...props}
    />
  ),

  strong: (props) => (
    <strong
      className="font-semibold text-[color:var(--color-ink-900)]"
      {...props}
    />
  ),
  em: (props) => (
    <em className="italic text-[color:var(--color-ink-700)]" {...props} />
  ),

  a: (props) => (
    <a
      className="text-indigo-600 underline-offset-2 decoration-indigo-300 hover:decoration-indigo-500 hover:text-indigo-700 transition-colors"
      {...props}
    />
  ),
};
