import { collectVaultLockOverlayExclusionRects } from "./overlay-exclude.js";

export type VaultLockOverlayPanel = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type VaultLockOverlayRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

function panelToRect(panel: VaultLockOverlayPanel): VaultLockOverlayRect {
  return {
    top: panel.top,
    left: panel.left,
    right: panel.left + panel.width,
    bottom: panel.top + panel.height,
  };
}

function rectsIntersect(panel: VaultLockOverlayPanel, hole: VaultLockOverlayRect): boolean {
  const rect = panelToRect(panel);
  return (
    rect.left < hole.right &&
    rect.right > hole.left &&
    rect.top < hole.bottom &&
    rect.bottom > hole.top
  );
}

function subtractRectFromPanel(
  panel: VaultLockOverlayPanel,
  hole: VaultLockOverlayRect
): VaultLockOverlayPanel[] {
  if (!rectsIntersect(panel, hole)) {
    return [panel];
  }

  const panelRect = panelToRect(panel);
  const result: VaultLockOverlayPanel[] = [];

  if (panelRect.top < hole.top) {
    result.push({
      top: panelRect.top,
      left: panelRect.left,
      width: panel.width,
      height: hole.top - panelRect.top,
    });
  }

  if (panelRect.bottom > hole.bottom) {
    result.push({
      top: hole.bottom,
      left: panelRect.left,
      width: panel.width,
      height: panelRect.bottom - hole.bottom,
    });
  }

  const midTop = Math.max(panelRect.top, hole.top);
  const midBottom = Math.min(panelRect.bottom, hole.bottom);

  if (midBottom > midTop && panelRect.left < hole.left) {
    result.push({
      top: midTop,
      left: panelRect.left,
      width: hole.left - panelRect.left,
      height: midBottom - midTop,
    });
  }

  if (midBottom > midTop && panelRect.right > hole.right) {
    result.push({
      top: midTop,
      left: hole.right,
      width: panelRect.right - hole.right,
      height: midBottom - midTop,
    });
  }

  return result;
}

/** Computes fixed overlay panels that cover the viewport except exclusion holes. */
export function computeVaultLockOverlayPanels(
  viewportWidth: number,
  viewportHeight: number,
  exclusions: VaultLockOverlayRect[]
): VaultLockOverlayPanel[] {
  let panels: VaultLockOverlayPanel[] = [
    { top: 0, left: 0, width: viewportWidth, height: viewportHeight },
  ];

  for (const hole of exclusions) {
    panels = panels.flatMap((panel) => subtractRectFromPanel(panel, hole));
  }

  return panels.filter((panel) => panel.width > 0 && panel.height > 0);
}

export function measureVaultLockOverlayPanels(): VaultLockOverlayPanel[] {
  if (typeof window === "undefined") {
    return [];
  }

  return computeVaultLockOverlayPanels(
    window.innerWidth,
    window.innerHeight,
    collectVaultLockOverlayExclusionRects()
  );
}
