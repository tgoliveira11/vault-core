import { useSyncExternalStore } from "react";
import { isVaultUnlocked, subscribeVaultSession } from "../../browser.js";

export function useVaultUnlocked(): boolean {
  return useSyncExternalStore(
    subscribeVaultSession,
    () => isVaultUnlocked(),
    () => false
  );
}

export function useVaultLockState(): "locked" | "unlocked" {
  return useVaultUnlocked() ? "unlocked" : "locked";
}
