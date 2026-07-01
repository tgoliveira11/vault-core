/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureVaultSession,
  scheduleVaultAutoLock,
} from "../../session/auto-lock.js";
import { useVaultAutoLockPreference } from "./use-vault-auto-lock-preference.js";

const KEY = "vault-core:user:auto-lock-minutes";
const preferenceStore = new Map<string, string>();

function installLocalStorageStub() {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => preferenceStore.get(key) ?? null,
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
    preferenceStore.clear();
    installLocalStorageStub();
    vi.mocked(configureVaultSession).mockClear();
    vi.mocked(scheduleVaultAutoLock).mockClear();
  });

  afterEach(() => {
    preferenceStore.clear();
  });

  it("uses admin default when no user preference exists", () => {
    const { result } = renderHook(() => useVaultAutoLockPreference(30));
    expect(result.current.minutes).toBe(30);
    expect(result.current.usingUserPreference).toBe(false);
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
    const { result } = renderHook(() => useVaultAutoLockPreference(30));
    expect(result.current.minutes).toBe(8);
    expect(result.current.usingUserPreference).toBe(true);
  });
});
