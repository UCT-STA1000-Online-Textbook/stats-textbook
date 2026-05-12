/**
 * Single dynamic route covering all 22 work units.
 *
 * Build-time: `generateStaticParams` reads `ALL_UNITS` and emits one static
 * page per slug, so every unit is prerendered. `generateMetadata` produces
 * a per-page <title>.
 *
 * Request-time (or build-time when SSG): we load and validate the MDX file
 * for the given slug, then hand it off to `ThreePanelShell`. An unknown
 * slug or a frontmatter validation failure short-circuits to `notFound()`.
 */

import { getAllUnitSlugs, getUnitBySlug } from "@/lib/mdx";
import { ThreePanelShell } from "@/components/layout/ThreePanelShell";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  return getAllUnitSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const { frontmatter } = await getUnitBySlug(slug);
    return { title: `${frontmatter.title} | STA1000` };
  } catch {
    // Falls back to the root layout title; the page itself will 404.
    return { title: "STA1000" };
  }
}

export default async function UnitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Resolve to null on any failure — missing file, invalid frontmatter, etc.
  const data = await getUnitBySlug(slug).catch(() => null);
  if (!data) notFound();
  return (
    <ThreePanelShell frontmatter={data.frontmatter} content={data.content} />
  );
}
