"use client";

import { useEffect } from "react";
import { useVaultUnlocked } from "../session/use-vault-unlocked.js";

export type UseVaultUnlockPageNavigationOptions = {
  /** Vault setup state. When `false`, navigates to `setupPath`. When `null`, waits. */
  configured: boolean | null;
  /** Sanitized destination after a successful unlock. */
  returnPath: string;
  /** Route when the vault is not configured. */
  setupPath?: string;
  /** App router callback (for example Next.js `router.replace`). */
  onNavigate: (path: string) => void;
};

/**
 * Redirects unlock pages away when setup is required or when the vault is already unlocked.
 * Pair with `readVaultUnlockReturnPath()` for the `returnPath` argument.
 */
export function useVaultUnlockPageNavigation({
  configured,
  returnPath,
  setupPath = "/vault/setup",
  onNavigate,
}: UseVaultUnlockPageNavigationOptions): void {
  const unlocked = useVaultUnlocked();

  useEffect(() => {
    if (configured !== false) return;
    onNavigate(setupPath);
  }, [configured, onNavigate, setupPath]);

  useEffect(() => {
    if (!unlocked || configured === false || configured === null) return;
    onNavigate(returnPath);
  }, [configured, onNavigate, returnPath, unlocked]);
}
