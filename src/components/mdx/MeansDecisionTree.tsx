/**
 * Decision tree for hypothesis tests on means (IntroStat Figure 9.1), used in
 * Module 5, WU6 (`m5-two-independent-samples`).
 *
 * The lecturer's version of the figure drops the book's F-test and
 * approximate t-test boxes, so the tree has four leaves: one sample or two,
 * with σ known (Z) or estimated (t). The two-sample t box is headed
 * "population variances assumed equal", since the course always pools.
 *
 * The formulas are rendered with KaTeX on the server, the same engine
 * `rehype-katex` uses for the MDX maths, so they match the text around them.
 * Layout: two columns (σ known | σ estimated), each with its one-sample
 * leaf above its two-sample leaf, so the long two-sample formulas get half
 * the reading column rather than a quarter.
 *
 * Usage in MDX: `<MeansDecisionTree />` (no props).
 */

import katex from "katex";

/** Renders a TeX string to KaTeX HTML. */
function tex(source: string, display = false): string {
  return katex.renderToString(source, { displayMode: display, throwOnError: false });
}

/** One decision box: a question or a heading, with no formula. */
function Question({ children }: { children: string }) {
  return (
    <div className="mx-auto max-w-[280px] rounded-lg border border-[color:var(--color-line-strong)] bg-white px-3 py-2 text-center text-[12.5px] font-medium text-[color:var(--color-ink-700)]">
      {children}
    </div>
  );
}

/**
 * A leaf of the tree: which situation it is, and the test statistic to use.
 *
 * @param where — an optional extra formula shown under the statistic, such
 *   as the pooled variance the two-sample t-test needs.
 */
function Leaf({
  heading,
  formula,
  distribution,
  where,
}: {
  heading: string;
  formula: string;
  distribution: string;
  where?: string;
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-2 text-center">
      <p className="text-[12px] font-semibold leading-snug text-blue-800">{heading}</p>
      {/* Scrolls sideways rather than overflow the column on a narrow phone. */}
      <div className="overflow-x-auto text-[13px]" dangerouslySetInnerHTML={{ __html: tex(formula, true) }} />
      <div className="text-[12px] text-[color:var(--color-ink-700)]" dangerouslySetInnerHTML={{ __html: tex(distribution) }} />
      {where && (
        <div className="overflow-x-auto text-[12px]" dangerouslySetInnerHTML={{ __html: tex(where, true) }} />
      )}
    </div>
  );
}

/** A short vertical connector between levels of the tree. */
function Down() {
  return <div aria-hidden className="mx-auto h-3 w-px bg-[color:var(--color-line-strong)]" />;
}

/** Figure 9.1, as amended by the lecturer: choosing a test on means. */
export function MeansDecisionTree() {
  return (
    <figure className="callout my-6 rounded-xl border border-[color:var(--color-line)] bg-slate-50/50 px-3 py-4">
      <Question>START: is the population variance known, or estimated from the sample?</Question>
      <Down />
      <div className="grid grid-cols-2 gap-3">
        {/* min-w-0 lets a column shrink below its widest formula, which then scrolls inside its box. */}
        <div className="min-w-0">
          <Question>Variance known. One sample or two?</Question>
          <Down />
          <div className="grid gap-2">
            <Leaf
              heading="One sample"
              formula={String.raw`Z = \frac{\bar{X} - \mu}{\sigma/\sqrt{n}}`}
              distribution={String.raw`\sim N(0, 1)`}
            />
            <Leaf
              heading="Two samples"
              formula={String.raw`Z = \frac{\bar{X}_1 - \bar{X}_2 - (\mu_1 - \mu_2)}{\sqrt{\frac{\sigma_1^2}{n_1} + \frac{\sigma_2^2}{n_2}}}`}
              distribution={String.raw`\sim N(0, 1)`}
            />
          </div>
        </div>
        <div className="min-w-0">
          <Question>Variance estimated. One sample or two?</Question>
          <Down />
          <div className="grid gap-2">
            <Leaf
              heading="One sample"
              formula={String.raw`t = \frac{\bar{X} - \mu}{s/\sqrt{n}}`}
              distribution={String.raw`\sim t_{n-1}`}
            />
            <Leaf
              heading="Two samples (population variances assumed equal)"
              formula={String.raw`t = \frac{\bar{X}_1 - \bar{X}_2 - (\mu_1 - \mu_2)}{s\sqrt{\frac{1}{n_1} + \frac{1}{n_2}}}`}
              distribution={String.raw`\sim t_{n_1+n_2-2}`}
              where={String.raw`\text{where } s^2 = \frac{(n_1 - 1)s_1^2 + (n_2 - 1)s_2^2}{n_1 + n_2 - 2}`}
            />
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[12px] text-[color:var(--color-ink-500)]">
        Decision tree for hypothesis tests on means. All the t-tests assume the samples come from
        Normal distributions.
      </figcaption>
    </figure>
  );
}
