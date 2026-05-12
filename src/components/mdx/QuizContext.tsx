"use client";

import { createContext, useContext } from "react";
import type { QuizQuestion } from "@/lib/mdx";

interface QuizContextValue {
  slug: string;
  questions: QuizQuestion[];
}

const QuizContext = createContext<QuizContextValue | null>(null);

export function QuizProvider({
  slug,
  questions,
  children,
}: {
  slug: string;
  questions: QuizQuestion[];
  children: React.ReactNode;
}) {
  return (
    <QuizContext.Provider value={{ slug, questions }}>
      {children}
    </QuizContext.Provider>
  );
}

export function useQuizContext() {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error("useQuizContext must be used inside QuizProvider");
  return ctx;
}
