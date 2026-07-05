import { describe, expect, it, vi } from "vitest";
import {
  registerVaultLockCleanup,
  resetVaultLockCleanupHandlersForTests,
  runVaultLockCleanupHandlers,
} from "../../session/vault-lock-cleanup.js";
import { lockVaultSession, resetVaultSessionLockState } from "../../session/auto-lock.js";

describe("vault-lock-cleanup", () => {
  it("invokes registered handlers on lockVaultSession", () => {
    resetVaultLockCleanupHandlersForTests();
    resetVaultSessionLockState();
    const handler = vi.fn();
    registerVaultLockCleanup(handler);
    lockVaultSession();
    expect(handler).toHaveBeenCalledTimes(1);
    resetVaultLockCleanupHandlersForTests();
  });

  it("unregisters handlers", () => {
    resetVaultLockCleanupHandlersForTests();
    const handler = vi.fn();
    const unregister = registerVaultLockCleanup(handler);
    unregister();
    runVaultLockCleanupHandlers();
    expect(handler).not.toHaveBeenCalled();
  });

  it("continues when a handler throws", () => {
    resetVaultLockCleanupHandlersForTests();
    const ok = vi.fn();
    registerVaultLockCleanup(() => {
      throw new Error("cleanup failed");
    });
    registerVaultLockCleanup(ok);
    runVaultLockCleanupHandlers();
    expect(ok).toHaveBeenCalledTimes(1);
    resetVaultLockCleanupHandlersForTests();
  });
});
