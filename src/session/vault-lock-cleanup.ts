export type VaultLockCleanupHandler = () => void;

const lockCleanupHandlers = new Set<VaultLockCleanupHandler>();

/**
 * Registers a handler invoked synchronously on every `lockVaultSession()` /
 * `lockVaultSessionManually()` after crypto session state is cleared.
 * Use to drop app-owned decrypted state (React stores, query caches, form fields).
 *
 * Returns an unregister function — call it on unmount or when the handler is no longer needed.
 */
export function registerVaultLockCleanup(handler: VaultLockCleanupHandler): () => void {
  lockCleanupHandlers.add(handler);
  return () => {
    lockCleanupHandlers.delete(handler);
  };
}

/** Runs all registered lock cleanup handlers (best-effort; errors in one handler do not skip others). */
export function runVaultLockCleanupHandlers(): void {
  for (const handler of lockCleanupHandlers) {
    try {
      handler();
    } catch {
      // Handlers must be best-effort; consumers should not throw from cleanup.
    }
  }
}

/** @internal Test helper — clears the registry without invoking handlers. */
export function resetVaultLockCleanupHandlersForTests(): void {
  lockCleanupHandlers.clear();
}
