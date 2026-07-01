import { useEffect, type RefObject } from "react";

export type VaultDockDismissOptions = {
  /** Expanded dock region (handle + panel). Outside clicks collapse the dock. */
  rootRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  shouldPreventDismiss: () => boolean;
  onDismiss: () => void;
};

/** Collapse expanded vault dock on outside click or Escape. */
export function useVaultDockDismiss({
  rootRef,
  enabled,
  shouldPreventDismiss,
  onDismiss,
}: VaultDockDismissOptions): void {
  useEffect(() => {
    if (!enabled) return;

    function containsTarget(target: EventTarget | null): boolean {
      if (!(target instanceof Node)) return false;
      return Boolean(rootRef.current?.contains(target));
    }

    let outsideClickTimer: ReturnType<typeof setTimeout> | undefined;

    function onPointerDown(event: MouseEvent) {
      if (shouldPreventDismiss()) return;
      if (containsTarget(event.target)) return;

      outsideClickTimer = setTimeout(() => {
        outsideClickTimer = undefined;
        if (shouldPreventDismiss()) return;
        const active = document.activeElement;
        if (active instanceof Node && containsTarget(active)) return;
        onDismiss();
      }, 0);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !shouldPreventDismiss()) {
        onDismiss();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (outsideClickTimer) clearTimeout(outsideClickTimer);
    };
  }, [enabled, onDismiss, rootRef, shouldPreventDismiss]);
}
