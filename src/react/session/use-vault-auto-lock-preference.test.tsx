/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginVaultSessionUnlock,
  clearVaultSessionOwner,
  configureVaultSession,
  resetVaultSessionLockState,
  scheduleVaultAutoLock,
  unlockVaultSession,
} from "../../session/auto-lock.js";
import { resetVaultSessionOperationsForTests } from "../../session/vault-session-operation.js";
import { createNonExtractableSessionVaultKey } from "../../testing/session-vault-key.js";
import { useVaultAutoLockPreference } from "./use-vault-auto-lock-preference.js";

const KEY = "vault-core:user:auto-lock-minutes";
const preferenceStore = new Map<string, string>();
const storageGetItem = vi.fn((key: string) => preferenceStore.get(key) ?? null);

function installLocalStorageStub() {
  vi.stubGlobal("localStorage", {
    getItem: storageGetItem,
    setItem: (key: string, value: string) => {
      preferenceStore.set(key, value);
    },
    removeItem: (key: string) => {
      preferenceStore.delete(key);
    },
    clear: () => {
      preferenceStore.clear();
    },
  });
}

vi.mock("../../session/auto-lock.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../session/auto-lock.js")>();
  return {
    ...actual,
    configureVaultSession: vi.fn(actual.configureVaultSession),
    scheduleVaultAutoLock: vi.fn(actual.scheduleVaultAutoLock),
  };
});

describe("useVaultAutoLockPreference", () => {
  beforeEach(() => {
    clearVaultSessionOwner();
    resetVaultSessionOperationsForTests();
    resetVaultSessionLockState();
    preferenceStore.clear();
    storageGetItem.mockClear();
    installLocalStorageStub();
    vi.mocked(configureVaultSession).mockClear();
    vi.mocked(scheduleVaultAutoLock).mockClear();
  });

  afterEach(() => {
    clearVaultSessionOwner();
    resetVaultSessionOperationsForTests();
    resetVaultSessionLockState();
    preferenceStore.clear();
  });

  it("uses admin default when no user preference exists", () => {
    const { result } = renderHook(() => useVaultAutoLockPreference(30));
    expect(result.current.minutes).toBe(30);
    expect(result.current.usingUserPreference).toBe(false);
    expect(result.current.hydrationStatus).toBe("ready");
  });

  it("persists user preference and applies session config", () => {
    const { result } = renderHook(() => useVaultAutoLockPreference(30));

    act(() => {
      result.current.setMinutes(12);
    });

    expect(preferenceStore.get(KEY)).toBe("12");
    expect(result.current.minutes).toBe(12);
    expect(result.current.usingUserPreference).toBe(true);
    expect(configureVaultSession).toHaveBeenCalled();
    expect(scheduleVaultAutoLock).toHaveBeenCalled();
  });

  it("configures session with user override when preference is set", () => {
    preferenceStore.set(KEY, "12");
    renderHook(() => useVaultAutoLockPreference(30));
    const config = vi.mocked(configureVaultSession).mock.calls.at(-1)?.[0];
    expect(config?.resolveAutoLockMinutes?.()).toBe(12);
  });

  it("configures session without user override when preference is unset", () => {
    renderHook(() => useVaultAutoLockPreference(30));
    const config = vi.mocked(configureVaultSession).mock.calls.at(-1)?.[0];
    expect(config?.resolveAutoLockMinutes?.()).toBeUndefined();
  });

  it("clears user preference on reset", () => {
    preferenceStore.set(KEY, "10");
    const { result } = renderHook(() => useVaultAutoLockPreference(30));

    act(() => {
      result.current.resetToAdminDefault();
    });

    expect(preferenceStore.has(KEY)).toBe(false);
    expect(result.current.minutes).toBe(30);
    expect(result.current.usingUserPreference).toBe(false);
  });

  it("clamps user preference to admin max on mount", () => {
    preferenceStore.set(KEY, "99");
    const { result } = renderHook(() => useVaultAutoLockPreference(30));
    expect(result.current.minutes).toBe(30);
  });

  it("reads stored preference on mount", () => {
    preferenceStore.set(KEY, "8");
    const renders: Array<{ hydrationStatus: string; minutes: number }> = [];
    const { result } = renderHook(() => {
      const preference = useVaultAutoLockPreference(30);
      renders.push({
        hydrationStatus: preference.hydrationStatus,
        minutes: preference.minutes,
      });
      return preference;
    });
    expect(renders[0]).toEqual({ hydrationStatus: "checking", minutes: 30 });
    expect(result.current.minutes).toBe(8);
    expect(result.current.usingUserPreference).toBe(true);
    expect(result.current.hydrationStatus).toBe("ready");
  });

  it("does not read browser storage during server rendering", () => {
    preferenceStore.set(KEY, "8");

    function Probe() {
      const preference = useVaultAutoLockPreference(30);
      return (
        <output data-status={preference.hydrationStatus}>
          {preference.minutes}
        </output>
      );
    }

    expect(renderToString(<Probe />)).toContain('data-status="checking">30</output>');
    expect(storageGetItem).not.toHaveBeenCalled();
  });

  it("uses a server-resolved initial preference without reading browser storage", () => {
    preferenceStore.set(KEY, "8");
    const { result } = renderHook(() =>
      useVaultAutoLockPreference(30, { initialUserMinutes: 12 })
    );

    expect(result.current).toMatchObject({
      hydrationStatus: "ready",
      minutes: 12,
      usingUserPreference: true,
    });
    expect(storageGetItem).not.toHaveBeenCalled();
  });

  it("treats explicit null as a resolved absence and ignores browser storage", () => {
    preferenceStore.set(KEY, "8");
    const { result } = renderHook(() =>
      useVaultAutoLockPreference(30, { initialUserMinutes: null })
    );

    expect(result.current).toMatchObject({
      hydrationStatus: "ready",
      minutes: 30,
      usingUserPreference: false,
    });
    expect(storageGetItem).not.toHaveBeenCalled();
  });

  it("re-arms an owner-scoped session with the current lease", async () => {
    const attempt = beginVaultSessionUnlock("account-A");
    const lease = await unlockVaultSession(
      await createNonExtractableSessionVaultKey(),
      { operation: attempt }
    );
    expect(lease).not.toBeNull();
    vi.mocked(scheduleVaultAutoLock).mockClear();

    renderHook(() =>
      useVaultAutoLockPreference(30, {
        initialUserMinutes: null,
        sessionLease: lease,
      })
    );

    expect(scheduleVaultAutoLock).toHaveBeenCalledWith(lease);
  });

  it("does not re-arm the timer with a stale lease", async () => {
    const attemptA = beginVaultSessionUnlock("account-A");
    const leaseA = await unlockVaultSession(
      await createNonExtractableSessionVaultKey(),
      { operation: attemptA }
    );
    const attemptB = beginVaultSessionUnlock("account-B");
    await unlockVaultSession(await createNonExtractableSessionVaultKey(), {
      operation: attemptB,
    });
    vi.mocked(configureVaultSession).mockClear();
    vi.mocked(scheduleVaultAutoLock).mockClear();

    renderHook(() =>
      useVaultAutoLockPreference(30, {
        initialUserMinutes: null,
        sessionLease: leaseA,
      })
    );

    expect(scheduleVaultAutoLock).not.toHaveBeenCalled();
    expect(configureVaultSession).not.toHaveBeenCalled();
  });

  it("configures preference without scheduling while the owner has no lease", () => {
    beginVaultSessionUnlock("account-A");
    vi.mocked(scheduleVaultAutoLock).mockClear();

    renderHook(() =>
      useVaultAutoLockPreference(30, {
        initialUserMinutes: null,
        sessionLease: null,
      })
    );

    expect(configureVaultSession).toHaveBeenCalled();
    expect(scheduleVaultAutoLock).not.toHaveBeenCalled();
  });

  it("does not let a missing lease reconfigure an installed owner-scoped session", async () => {
    const attempt = beginVaultSessionUnlock("account-A");
    await unlockVaultSession(await createNonExtractableSessionVaultKey(), {
      operation: attempt,
    });
    vi.mocked(configureVaultSession).mockClear();
    vi.mocked(scheduleVaultAutoLock).mockClear();

    renderHook(() =>
      useVaultAutoLockPreference(30, {
        initialUserMinutes: null,
        sessionLease: null,
      })
    );

    expect(configureVaultSession).not.toHaveBeenCalled();
    expect(scheduleVaultAutoLock).not.toHaveBeenCalled();
  });
});
