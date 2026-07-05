"use client";

import { useEffect, useRef } from "react";
import { registerVaultLockCleanup } from "../../session/vault-lock-cleanup.js";

/**
 * Registers a callback invoked synchronously when the vault locks (auto-lock, manual lock,
 * or `pagehide` when `registerVaultUnloadGuard` is active).
 *
 * Use to clear app-owned decrypted state (stores, query caches, form fields). Pair with
 * {@link VaultSensitiveRegion} or conditional rendering so plaintext leaves the DOM.
 */
export function useOnVaultLocked(onLocked: () => void): void {
  const handlerRef = useRef(onLocked);
  handlerRef.current = onLocked;

  useEffect(() => {
    return registerVaultLockCleanup(() => {
      handlerRef.current();
    });
  }, []);
}
