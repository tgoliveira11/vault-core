/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVaultAutoLockTimer,
  lockVaultSession,
  resetVaultSessionLockState,
  unlockVaultSession,
} from "../../browser.js";
import { resetVaultLockCleanupHandlersForTests } from "../../session/vault-lock-cleanup.js";
import { createNonExtractableSessionVaultKey } from "../../testing/session-vault-key.js";
import { VaultSensitiveRegion } from "../../react/protected-gate/vault-sensitive-region.js";
import { SENTINEL_PRIVATE_NOTE } from "../../validation/plaintext-reject.js";

describe("VaultSensitiveRegion", () => {
  beforeEach(() => {
    resetVaultSessionLockState();
    resetVaultLockCleanupHandlersForTests();
    lockVaultSession();
  });

  afterEach(() => {
    cleanup();
    clearVaultAutoLockTimer();
    resetVaultSessionLockState();
    resetVaultLockCleanupHandlersForTests();
    lockVaultSession();
    document.body.innerHTML = "";
  });

  it("unmounts children while locked", () => {
    render(
      <VaultSensitiveRegion>
        <p>{SENTINEL_PRIVATE_NOTE}</p>
      </VaultSensitiveRegion>
    );
    expect(screen.queryByText(SENTINEL_PRIVATE_NOTE)).toBeNull();
  });

  it("renders children when unlocked", async () => {
    await act(async () => unlockVaultSession(await createNonExtractableSessionVaultKey()));
    render(
      <VaultSensitiveRegion>
        <p>{SENTINEL_PRIVATE_NOTE}</p>
      </VaultSensitiveRegion>
    );
    expect(screen.getByText(SENTINEL_PRIVATE_NOTE)).toBeTruthy();
  });

  it("removes children from DOM when lock fires", async () => {
    await act(async () => unlockVaultSession(await createNonExtractableSessionVaultKey()));
    render(
      <VaultSensitiveRegion>
        <p>{SENTINEL_PRIVATE_NOTE}</p>
      </VaultSensitiveRegion>
    );
    expect(screen.getByText(SENTINEL_PRIVATE_NOTE)).toBeTruthy();
    act(() => lockVaultSession());
    expect(screen.queryByText(SENTINEL_PRIVATE_NOTE)).toBeNull();
  });

  it("shows lockedFallback while locked", () => {
    render(
      <VaultSensitiveRegion lockedFallback={<p>Locked placeholder</p>}>
        <p>{SENTINEL_PRIVATE_NOTE}</p>
      </VaultSensitiveRegion>
    );
    expect(screen.getByText("Locked placeholder")).toBeTruthy();
    expect(screen.queryByText(SENTINEL_PRIVATE_NOTE)).toBeNull();
  });

  it("calls onLocked when vault locks", async () => {
    const onLocked = vi.fn();
    await act(async () => unlockVaultSession(await createNonExtractableSessionVaultKey()));
    render(
      <VaultSensitiveRegion onLocked={onLocked}>
        <p>Secret</p>
      </VaultSensitiveRegion>
    );
    act(() => lockVaultSession());
    expect(onLocked).toHaveBeenCalled();
  });
});
