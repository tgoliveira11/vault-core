/** Marks a DOM subtree that stays interactive and visible above the vault lock overlay. */
export const VAULT_LOCK_OVERLAY_EXCLUDE_ATTR = "data-vault-lock-overlay-exclude";

export const VAULT_LOCK_OVERLAY_EXCLUDE_SELECTOR = `[${VAULT_LOCK_OVERLAY_EXCLUDE_ATTR}="true"]`;

export function collectVaultLockOverlayExclusionRects(): Array<{
  top: number;
  left: number;
  right: number;
  bottom: number;
}> {
  if (typeof document === "undefined") {
    return [];
  }

  const elements = Array.from(document.querySelectorAll(VAULT_LOCK_OVERLAY_EXCLUDE_SELECTOR));
  const rects: Array<{ top: number; left: number; right: number; bottom: number }> = [];

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    rects.push({
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
    });
  }

  return rects;
}
