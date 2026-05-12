import { compileMDX } from "next-mdx-remote/rsc";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { ALL_UNITS } from "@/content/units";
import { mdxComponents } from "./mdxComponents";

const QuizQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["mcq", "true-false", "numeric"]),
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
        remarkPlugins: [remarkMath],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rehypePlugins: [rehypeKatex as any],
      },
    },
  });

  const frontmatter = FrontmatterSchema.parse(rawFrontmatter);
  return { content, frontmatter };
}

export function getAllUnitSlugs(): string[] {
  return ALL_UNITS.map((u) => u.slug);
}
