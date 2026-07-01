/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVaultAutoLockTimer,
  configureVaultSession,
  getVaultAutoLockRemainingMs,
  lockVaultSession,
  resetVaultSessionLockState,
  unlockVaultSession,
} from "../../browser.js";
import { createUserVaultKey } from "../../index.js";
import {
  useVaultAutoLockCountdown,
  useVaultAutoLockFraction,
  resolveVaultAutoLockMinutes,
} from "./use-vault-auto-lock-countdown.js";

describe("useVaultAutoLockCountdown", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    configureVaultSession({ autoLockMinutes: 15 });
    resetVaultSessionLockState();
    lockVaultSession();
    await unlockVaultSession(await createUserVaultKey());
  });

  afterEach(() => {
    clearVaultAutoLockTimer();
    resetVaultSessionLockState();
    lockVaultSession();
    vi.useRealTimers();
  });

  it("returns null when inactive", () => {
    const { result } = renderHook(() => useVaultAutoLockCountdown(false, 15));
    expect(result.current).toBeNull();
  });

  it("returns formatted countdown when active", () => {
    const remaining = getVaultAutoLockRemainingMs();
    expect(remaining).not.toBeNull();
    const { result } = renderHook(() => useVaultAutoLockCountdown(true, 15));
    expect(result.current).toMatch(/^\d+:\d{2}$/);
  });

  it("returns auto-lock fraction with fallback minutes", () => {
    const { result: invalid } = renderHook(() => useVaultAutoLockFraction(true, 0));
    expect(invalid.current).toBeGreaterThan(0);

    const { result: unset } = renderHook(() => useVaultAutoLockFraction(true));
    expect(unset.current).toBeGreaterThan(0);
  });

  it("returns null countdown when remaining time is unavailable", async () => {
    await act(async () => lockVaultSession());
    const { result } = renderHook(() => useVaultAutoLockCountdown(true, 15));
    expect(result.current).toBeNull();
  });

  it("resolveVaultAutoLockMinutes prefers override then session config", () => {
    configureVaultSession({ autoLockMinutes: 5 });
    expect(resolveVaultAutoLockMinutes()).toBe(5);
    expect(resolveVaultAutoLockMinutes(10)).toBe(10);
    expect(resolveVaultAutoLockMinutes(0)).toBe(5);
  });
});
