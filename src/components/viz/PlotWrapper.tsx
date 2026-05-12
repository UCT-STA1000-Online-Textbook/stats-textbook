"use client";

import { useEffect, useRef } from "react";

interface PlotWrapperProps {
  render: (container: HTMLDivElement) => SVGElement | HTMLElement | null;
  deps?: unknown[];
}

export function PlotWrapper({ render, deps = [] }: PlotWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const plot = render(container);
    if (plot) container.appendChild(plot);

    const observer = new ResizeObserver(() => {
      container.innerHTML = "";
      const updated = render(container);
      if (updated) container.appendChild(updated);
    });
    observer.observe(container);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return <div ref={containerRef} className="w-full h-full" />;
}
