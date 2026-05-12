export interface UnitMeta {
  slug: string;
  title: string;
  moduleId: string;
  moduleTitle: string;
  unitNumber: number;
  moduleUnitNumber: number;
}

export const MODULES = [
  { id: "m1", title: "Probability" },
  { id: "m2", title: "Exploring Data" },
  { id: "m3", title: "Random Variables" },
  { id: "m4", title: "Probability Distributions" },
  { id: "m5", title: "Hypothesis Testing" },
] as const;

export const ALL_UNITS: UnitMeta[] = [
  { slug: "m1-introducing-probability",   title: "Introducing Probability",                  moduleId: "m1", moduleTitle: "Probability",               unitNumber: 1,  moduleUnitNumber: 1 },
  { slug: "m1-set-theory",                title: "Set Theory, Axioms & Theorems",            moduleId: "m1", moduleTitle: "Probability",               unitNumber: 2,  moduleUnitNumber: 2 },
  { slug: "m1-permutations-combinations", title: "Permutations & Combinations",              moduleId: "m1", moduleTitle: "Probability",               unitNumber: 3,  moduleUnitNumber: 3 },
  { slug: "m1-conditional-probability",   title: "Conditional Probability & Independence",   moduleId: "m1", moduleTitle: "Probability",               unitNumber: 4,  moduleUnitNumber: 4 },
  { slug: "m2-graphical-summaries",       title: "Graphical Summaries",                      moduleId: "m2", moduleTitle: "Exploring Data",            unitNumber: 5,  moduleUnitNumber: 1 },
  { slug: "m2-summary-measures",          title: "Summary Measures of Location and Spread",  moduleId: "m2", moduleTitle: "Exploring Data",            unitNumber: 6,  moduleUnitNumber: 2 },
  { slug: "m3-pmf-pdf",                   title: "Probability Mass and Density Functions",   moduleId: "m3", moduleTitle: "Random Variables",          unitNumber: 7,  moduleUnitNumber: 1 },
  { slug: "m3-working-with-rv",           title: "Working with Random Variables",            moduleId: "m3", moduleTitle: "Random Variables",          unitNumber: 8,  moduleUnitNumber: 2 },
  { slug: "m4-uniform",                   title: "Uniform Distribution",                     moduleId: "m4", moduleTitle: "Probability Distributions", unitNumber: 9,  moduleUnitNumber: 1 },
  { slug: "m4-binomial",                  title: "Binomial Distribution",                    moduleId: "m4", moduleTitle: "Probability Distributions", unitNumber: 10, moduleUnitNumber: 2 },
  { slug: "m4-poisson-exponential",       title: "Poisson & Exponential Distributions",      moduleId: "m4", moduleTitle: "Probability Distributions", unitNumber: 11, moduleUnitNumber: 3 },
  { slug: "m4-normal",                    title: "Normal Distribution",                      moduleId: "m4", moduleTitle: "Probability Distributions", unitNumber: 12, moduleUnitNumber: 4 },
  { slug: "m5-sampling-distribution",     title: "Sampling Distribution",                    moduleId: "m5", moduleTitle: "Hypothesis Testing",        unitNumber: 13, moduleUnitNumber: 1 },
  { slug: "m5-confidence-intervals",      title: "Confidence Intervals",                     moduleId: "m5", moduleTitle: "Hypothesis Testing",        unitNumber: 14, moduleUnitNumber: 2 },
  { slug: "m5-testing-mu",                title: "Testing Whether µ is a Specified Value",   moduleId: "m5", moduleTitle: "Hypothesis Testing",        unitNumber: 15, moduleUnitNumber: 3 },
  { slug: "m5-comparing-two-means",       title: "Comparing Two Sample Means",               moduleId: "m5", moduleTitle: "Hypothesis Testing",        unitNumber: 16, moduleUnitNumber: 4 },
  { slug: "m5-unknown-sigma",             title: "Hypothesis Testing: Unknown σ",            moduleId: "m5", moduleTitle: "Hypothesis Testing",        unitNumber: 17, moduleUnitNumber: 5 },
  { slug: "m5-two-independent-samples",   title: "Two Independent Samples",                  moduleId: "m5", moduleTitle: "Hypothesis Testing",        unitNumber: 18, moduleUnitNumber: 6 },
  { slug: "m5-two-dependent-samples",     title: "Two Dependent Samples",                    moduleId: "m5", moduleTitle: "Hypothesis Testing",        unitNumber: 19, moduleUnitNumber: 7 },
  { slug: "m5-goodness-of-fit",           title: "Goodness of Fit",                          moduleId: "m5", moduleTitle: "Hypothesis Testing",        unitNumber: 20, moduleUnitNumber: 8 },
  { slug: "m5-categorical-association",   title: "Association Between Categorical Variables", moduleId: "m5", moduleTitle: "Hypothesis Testing",       unitNumber: 21, moduleUnitNumber: 9 },
  { slug: "m5-regression",               title: "Regression",                                moduleId: "m5", moduleTitle: "Hypothesis Testing",        unitNumber: 22, moduleUnitNumber: 10 },
];
