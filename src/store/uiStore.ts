/**
 * Layout / chrome state for the three-panel shell.
 *
 * Separate from `vizStore` (what visualisation is showing) and `progressStore`
 * (quiz results) because it is purely presentational. Two kinds of state live
 * here:
 *
 *   - `sidebarCollapsed` — desktop icon-rail preference. Persisted to
 *     localStorage so it survives unit navigation, which fully re-renders
 *     `ThreePanelShell`.
 *   - `navDrawerOpen` / `vizSheetOpen` — transient overlays used only on
 *     tablet / phone widths. Deliberately NOT persisted: a drawer or sheet
 *     left open should never greet the student on their next visit.
 */

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  /** Desktop (`lg`+): true → sidebar shows as a narrow icon rail. */
  sidebarCollapsed: boolean;
  /** Tablet/phone (`<lg`): true → off-canvas navigation drawer is open. */
  navDrawerOpen: boolean;
  /** Phone (`<md`): true → the visualisation bottom sheet is open. */
  vizSheetOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setNavDrawerOpen: (open: boolean) => void;
  setVizSheetOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      navDrawerOpen: false,
      vizSheetOpen: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setNavDrawerOpen: (open) => set({ navDrawerOpen: open }),
      setVizSheetOpen: (open) => set({ vizSheetOpen: open }),
    }),
    {
      name: "sta1000-ui",
      // Only the desktop rail preference is durable; the overlay flags are
      // session-scoped and would be jarring if restored.
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);
