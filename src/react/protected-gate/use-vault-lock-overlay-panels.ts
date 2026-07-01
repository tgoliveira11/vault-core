"use client";

import { useEffect, useState } from "react";
import { measureVaultLockOverlayPanels, type VaultLockOverlayPanel } from "./overlay-panels.js";

/** Tracks viewport overlay panels while locked, carving out `VaultLockOverlayExclude` regions. */
export function useVaultLockOverlayPanels(active: boolean): VaultLockOverlayPanel[] {
  const [panels, setPanels] = useState<VaultLockOverlayPanel[]>(() =>
    active ? measureVaultLockOverlayPanels() : []
  );

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      setPanels([]);
      return;
    }

    const update = () => {
      setPanels(measureVaultLockOverlayPanels());
    };

    update();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => update())
        : null;

    for (const element of Array.from(
      document.querySelectorAll("[data-vault-lock-overlay-exclude='true']")
    )) {
      resizeObserver?.observe(element);
    }

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      resizeObserver?.disconnect();
    };
  }, [active]);

  return panels;
}
