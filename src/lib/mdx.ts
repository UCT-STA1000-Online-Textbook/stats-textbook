import { compileMDX } from "next-mdx-remote/rsc";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { ALL_UNITS } from "@/content/units";
import { mdxComponents } from "./mdxComponents";
import { buildVizParams, type VizParamProps } from "@/components/mdx/vizParams";
import type { VizParams } from "@/store/vizStore";
import { SHOWCASE_VIZ } from "@/components/viz/showcase";

const QuizQuestionSchema = z.object({
  id: z.string(),
  // Only types QuizQuestion.tsx can render. Adding a new type here requires a
  // matching input UI, otherwise questions of that type block quiz submission.
  type: z.enum(["mcq", "true-false"]),
  question: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.union([z.number(), z.boolean()]),
  explanation: z.string(),
  vizHint: z.string().optional(),
  vizHintParams: z.record(z.string(), z.unknown()).optional(),
});

const FrontmatterSchema = z.object({
  slug: z.string(),
  title: z.string(),
  moduleId: z.string(),
  moduleTitle: z.string(),
  unitNumber: z.number(),
  moduleUnitNumber: z.number(),
  status: z.enum(["placeholder", "draft", "complete"]),
  defaultViz: z.string().optional(),
  defaultVizParams: z.record(z.string(), z.unknown()).optional(),
  quiz: z.array(QuizQuestionSchema).default([]),
  prevUnit: z.string().nullable(),
  nextUnit: z.string().nullable(),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type UnitFrontmatter = z.infer<typeof FrontmatterSchema>;

export async function getUnitBySlug(slug: string) {
  const filePath = path.join(
    process.cwd(),
    "src",
    "content",
    "units",
    `${slug}.mdx`
  );
  const raw = await readFile(filePath, "utf-8");

  const { content, frontmatter: rawFrontmatter } = await compileMDX({
    source: raw,
    components: mdxComponents,
    options: {
      parseFrontmatter: true,
      mdxOptions: {
        // remark-gfm enables GFM tables (the `table`/`th`/`td` overrides in
        // mdxComponents depend on it); remark-math handles `$…$` LaTeX.
        remarkPlugins: [remarkGfm, remarkMath],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rehypePlugins: [rehypeKatex as any],
      },
    },
  });

  const frontmatter = FrontmatterSchema.parse(rawFrontmatter);

  // The right panel should not open blank. Unless the unit names its own
  // `defaultViz`, open on the first <TryThis> in the text, exactly as if the
  // student had clicked it. A unit with no <TryThis>, or whose first one is
  // a 3D viz, keeps the placeholder.
  if (!frontmatter.defaultViz) {
    const first = findFirstTryThis(raw);
    if (first) {
      frontmatter.defaultViz = first.vizId;
      frontmatter.defaultVizParams = first.params;
    }
  }

  return { content, frontmatter };
}

/**
 * Finds the first `<TryThis>` tag in a unit's MDX source and returns its
 * `vizId` and the params a click on it would send to the viz store.
 *
 * Only quoted string attributes are read. That matches what MDX actually
 * forwards to `<TryThis>` (a `{…}` expression attribute is dropped before it
 * reaches the component), so the default view is identical to the one the
 * student gets by clicking that first prompt. MDX comments are stripped
 * first so a commented-out prompt is never picked.
 *
 * Returns null when the first prompt opens a 3D viz (`SHOWCASE_VIZ`): those
 * are too heavy to load before the student asks, so that unit keeps the
 * placeholder until a click.
 */
function findFirstTryThis(
  source: string
): { vizId: string; params: VizParams } | null {
  const withoutComments = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const tag = withoutComments.match(/<TryThis\b([\s\S]*?)\/>/);
  if (!tag) return null;

  const attrs: Record<string, string> = {};
  for (const [, name, value] of tag[1].matchAll(/(\w+)="([^"]*)"/g)) {
    attrs[name] = value;
  }
  if (!attrs.vizId || SHOWCASE_VIZ.has(attrs.vizId)) return null;

  // The cast mirrors runtime reality: MDX hands `<TryThis>` these same
  // strings, and `buildVizParams` keeps only the whitelisted param names.
  return { vizId: attrs.vizId, params: buildVizParams(attrs as VizParamProps) };
}

export function getAllUnitSlugs(): string[] {
  return ALL_UNITS.map((u) => u.slug);
}
