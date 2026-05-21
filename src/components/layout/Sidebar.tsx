/**
 * Left navigation panel.
 *
 * Lists the five modules and their work units, derived from the canonical
 * arrays in `src/content/units.ts` (no duplicate source of truth). Each unit
 * shows a status dot driven by `progressStore`:
 *
 *   complete  → green tick
 *   active    → indigo ring (the unit currently routed to)
 *   attempted → amber dot (quiz attempted but not yet 100%)
 *   untouched → empty circle
 *
 * Module sections are collapsible. By default the module containing the
 * active unit is expanded; explicit user toggles are stored in `overrides`
 * and win over the default. This avoids a `useEffect`/`setState` round-trip
 * when the route changes.
 *
 * Responsive behaviour (driven by `uiStore`):
 *   - `lg`+  — in-flow column. `sidebarCollapsed` shrinks it to a 56px icon
 *              rail of module chips; the full accordion is hidden.
 *   - `<lg`  — an off-canvas drawer slid in/out by `navDrawerOpen`; it always
 *              shows the full accordion regardless of the rail preference.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ALL_UNITS, MODULES } from "@/content/units";
import { useProgressStore } from "@/store/progressStore";
import { useUiStore } from "@/store/uiStore";
import {
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconBookOpen,
} from "@/components/icons";

export function Sidebar() {
  const pathname = usePathname();
  const getModuleProgress = useProgressStore((s) => s.getModuleProgress);
  const getUnitProgress = useProgressStore((s) => s.getUnitProgress);

  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const navDrawerOpen = useUiStore((s) => s.navDrawerOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const setNavDrawerOpen = useUiStore((s) => s.setNavDrawerOpen);

  // Derive the currently routed slug from the URL. We avoid `useParams`
  // because the sidebar lives outside the [slug] route segment.
  const activeSlug = useMemo(() => {
    const m = pathname?.match(/\/unit\/(.+?)\/?$/);
    return m?.[1] ?? null;
  }, [pathname]);

  const activeModuleId = useMemo(() => {
    if (!activeSlug) return MODULES[0]?.id;
    return (
      ALL_UNITS.find((u) => u.slug === activeSlug)?.moduleId ?? MODULES[0]?.id
    );
  }, [activeSlug]);

  // Per-module open/closed state. Empty until the user toggles something —
  // until then we fall back to "open iff this is the active module".
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // Course-wide totals shown in the brand block + footer.
  const courseTotals = MODULES.reduce(
    (acc, m) => {
      const { completed, total } = getModuleProgress(m.id);
      return { completed: acc.completed + completed, total: acc.total + total };
    },
    { completed: 0, total: 0 }
  );
  const coursePct =
    courseTotals.total > 0
      ? Math.round((courseTotals.completed / courseTotals.total) * 100)
      : 0;

  /** Rail chip click — expand the sidebar with that module's section open. */
  function expandToModule(moduleId: string) {
    setOverrides((p) => ({ ...p, [moduleId]: true }));
    setSidebarCollapsed(false);
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-[color:var(--color-line)] bg-white/95 backdrop-blur-sm transition-[transform,width] duration-300 lg:static lg:z-auto lg:translate-x-0 lg:flex-shrink-0 lg:bg-white/70 ${
        navDrawerOpen ? "translate-x-0" : "-translate-x-full"
      } w-64 ${collapsed ? "lg:w-14" : "lg:w-64"}`}
    >
      {/* Icon rail — desktop only, shown when the sidebar is collapsed. */}
      {collapsed && (
        <div className="hidden lg:flex flex-col items-center h-full py-4">
          <Link
            href="/"
            className="grid place-items-center w-9 h-9 rounded-lg bg-[color:var(--color-ink-900)] text-white"
            title="STA1000 — home"
          >
            <IconBookOpen size={16} strokeWidth={2} />
          </Link>

          <nav className="mt-4 flex flex-col gap-1.5">
            {MODULES.map((mod, modIdx) => {
              const isActive = activeModuleId === mod.id;
              return (
                <button
                  key={mod.id}
                  onClick={() => expandToModule(mod.id)}
                  title={mod.title}
                  className={`grid place-items-center w-9 h-9 rounded-md text-[11px] font-semibold tabular-nums transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                      : "bg-slate-100 text-[color:var(--color-ink-500)] hover:bg-slate-200"
                  }`}
                >
                  {String(modIdx + 1).padStart(2, "0")}
                </button>
              );
            })}
          </nav>

          <button
            onClick={toggleSidebar}
            title="Expand navigation"
            aria-label="Expand navigation"
            className="mt-auto grid place-items-center w-9 h-9 rounded-md text-[color:var(--color-ink-400)] hover:bg-slate-100 hover:text-[color:var(--color-ink-700)] transition-colors"
          >
            <IconChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Full accordion — always rendered for the `<lg` drawer; on `lg`+ it is
          hidden whenever the rail is showing. */}
      <div
        className={`flex-col flex-1 min-h-0 ${
          collapsed ? "flex lg:hidden" : "flex"
        }`}
      >
        {/* Brand + course progress */}
        <div className="px-5 pt-5 pb-4 border-b border-[color:var(--color-line)]">
          <div className="flex items-start justify-between gap-2">
            <Link
              href="/"
              onClick={() => setNavDrawerOpen(false)}
              className="flex items-center gap-2.5 group"
            >
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-[color:var(--color-ink-900)] text-white">
                <IconBookOpen size={16} strokeWidth={2} />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold tracking-tight text-[color:var(--color-ink-900)]">
                  STA1000
                </span>
                <span className="block text-[11px] text-[color:var(--color-ink-500)]">
                  Interactive Textbook
                </span>
              </span>
            </Link>
            {/* Collapse to the icon rail — desktop only. */}
            <button
              onClick={toggleSidebar}
              title="Collapse navigation"
              aria-label="Collapse navigation"
              className="hidden lg:grid place-items-center w-7 h-7 rounded-md text-[color:var(--color-ink-400)] hover:bg-slate-100 hover:text-[color:var(--color-ink-700)] transition-colors"
            >
              <IconChevronLeft size={15} strokeWidth={2} />
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-ink-500)]">
                Course progress
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-[color:var(--color-ink-700)]">
                {courseTotals.completed}/{courseTotals.total}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-[color:var(--color-line)] overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-700 ease-out"
                style={{ width: `${coursePct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Module accordion */}
        <nav className="flex-1 overflow-y-auto py-2">
          {MODULES.map((mod, modIdx) => {
            const moduleUnits = ALL_UNITS.filter((u) => u.moduleId === mod.id);
            const { completed, total } = getModuleProgress(mod.id);
            const hasActive = activeModuleId === mod.id;
            // Override wins; otherwise default to "expanded if it owns the active unit".
            const isOpen = overrides[mod.id] ?? hasActive;

            return (
              <div key={mod.id} className="px-2">
                <button
                  onClick={() =>
                    setOverrides((p) => ({ ...p, [mod.id]: !isOpen }))
                  }
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                    hasActive
                      ? "text-[color:var(--color-ink-900)]"
                      : "text-[color:var(--color-ink-700)] hover:bg-slate-50"
                  }`}
                  aria-expanded={isOpen}
                >
                  <span
                    className={`grid place-items-center w-6 h-6 rounded-md text-[10px] font-semibold tabular-nums ${
                      hasActive
                        ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                        : "bg-slate-100 text-[color:var(--color-ink-500)]"
                    }`}
                  >
                    {String(modIdx + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-[13px] font-semibold tracking-tight truncate">
                    {mod.title}
                  </span>
                  <span className="text-[10px] tabular-nums text-[color:var(--color-ink-400)]">
                    {completed}/{total}
                  </span>
                  <IconChevronDown
                    size={14}
                    className={`text-[color:var(--color-ink-400)] transition-transform duration-200 ${
                      isOpen ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </button>

                {isOpen && (
                  <ul className="mt-0.5 mb-2 ml-4 pl-3 border-l border-[color:var(--color-line)] space-y-0.5">
                    {moduleUnits.map((unit) => {
                      const isActive = activeSlug === unit.slug;
                      const progress = getUnitProgress(unit.slug);
                      const isComplete = progress?.completed ?? false;
                      const hasAttempts = (progress?.attempts ?? 0) > 0;

                      return (
                        <li key={unit.slug} className="relative">
                          {/* Vertical accent on the parent rail for the active unit. */}
                          {isActive && (
                            <span
                              aria-hidden
                              className="absolute -left-[13px] top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full bg-indigo-500"
                            />
                          )}
                          <Link
                            href={`/unit/${unit.slug}`}
                            onClick={() => setNavDrawerOpen(false)}
                            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] leading-snug transition-colors ${
                              isActive
                                ? "bg-indigo-50/70 text-indigo-900 font-medium"
                                : "text-[color:var(--color-ink-700)] hover:bg-slate-50 hover:text-[color:var(--color-ink-900)]"
                            }`}
                          >
                            <StatusDot
                              complete={isComplete}
                              attempted={hasAttempts}
                              active={isActive}
                            />
                            <span className="flex-1 truncate">
                              {unit.title}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-5 py-3 border-t border-[color:var(--color-line)] flex items-center justify-between">
          <span className="text-[11px] text-[color:var(--color-ink-400)]">
            {coursePct}% complete
          </span>
          <span className="text-[11px] font-medium text-[color:var(--color-ink-500)] tabular-nums">
            {courseTotals.total - courseTotals.completed} left
          </span>
        </div>
      </div>
    </aside>
  );
}

/**
 * Status dot rendered next to each unit link.
 *
 * Precedence: complete > active > attempted > untouched. Complete wins even
 * for the active unit (a green tick is more informative than the cursor dot).
 */
function StatusDot({
  complete,
  attempted,
  active,
}: {
  complete: boolean;
  attempted: boolean;
  active: boolean;
}) {
  if (complete) {
    return (
      <span className="grid place-items-center w-4 h-4 rounded-full bg-emerald-500 text-white shadow-[0_0_0_2px_rgba(16,185,129,0.12)]">
        <IconCheck size={10} strokeWidth={3} />
      </span>
    );
  }
  if (active) {
    return (
      <span className="grid place-items-center w-4 h-4 rounded-full ring-2 ring-indigo-400 ring-offset-1 ring-offset-white">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
      </span>
    );
  }
  if (attempted) {
    return (
      <span className="grid place-items-center w-4 h-4 rounded-full border border-amber-300 bg-amber-50">
        <span className="w-1 h-1 rounded-full bg-amber-500" />
      </span>
    );
  }
  return (
    <span className="grid place-items-center w-4 h-4 rounded-full border border-[color:var(--color-line-strong)] bg-white" />
  );
}
