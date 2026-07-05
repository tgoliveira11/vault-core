"use client";

import { type ReactNode } from "react";
import { useOnVaultLocked } from "../session/use-on-vault-locked.js";
import { useVaultUnlocked } from "../session/use-vault-unlocked.js";

export type VaultSensitiveRegionProps = {
  children: ReactNode;
  /** Shown while the vault is locked instead of `children`. Defaults to `null` (unmount only). */
  lockedFallback?: ReactNode;
  /** Invoked synchronously when the vault locks (in addition to unmounting `children`). */
  onLocked?: () => void;
};

/**
 * Renders `children` only while the vault session is unlocked. When locked, renders
 * `lockedFallback` (default: nothing) so decrypted plaintext leaves the React tree.
 *
 * Does not replace {@link VaultProtectedGate} — use the gate for page-level blur/overlay UX
 * and this component for the sensitive subtree.
 */
export function VaultSensitiveRegion({
  children,
  lockedFallback = null,
  onLocked,
}: VaultSensitiveRegionProps) {
  const unlocked = useVaultUnlocked();

  useOnVaultLocked(() => {
    onLocked?.();
  });

  if (!unlocked) {
    return <>{lockedFallback}</>;
  }

  return <>{children}</>;
}
