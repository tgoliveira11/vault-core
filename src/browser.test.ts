// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertNoDecryptedVaultInIndexedDB,
  assertNoDecryptedVaultInLocalStorage,
  buildPrfSaltBytes,
  clearVaultAutoLockTimer,
  configureVaultSession,
  createRecoveryKitDownload,
  getSessionVaultKey,
  getVaultAutoLockRemainingMs,
  inspectIndexedDBPrefix,
  inspectLocalStoragePrefix,
  isVaultManuallyLocked,
  isVaultUnlocked,
  lockVaultSession,
  lockVaultSessionManually,
  persistVaultRecordLocally,
  printRecoveryKitContent,
  registerVaultActivityGuard,
  registerVaultUnloadGuard,
  resetVaultSessionLockState,
  scheduleVaultAutoLock,
  subscribeVaultSession,
  touchVaultSession,
  unlockVaultSession,
} from "./browser.js";
import { createUserVaultKey } from "./index.js";
import {
  clearVaultClientState,
  getVaultLockState,
  lockVault,
  setSessionVaultKey,
} from "./session/memory-session.js";

describe("browser helpers", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() {
        return values.size;
      },
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a deterministic SHA-256 PRF salt", async () => {
    const first = await buildPrfSaltBytes("app:", "user");
    const second = await buildPrfSaltBytes("app:", "user");
    expect(new Uint8Array(first)).toEqual(new Uint8Array(second));
    expect(first.byteLength).toBe(32);
  });

  it("downloads and prints escaped recovery kit content", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    createRecoveryKitDownload("recovery", "kit.txt");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");

    const printWindow = {
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(printWindow as unknown as Window);
    printRecoveryKitContent("<&>");
    expect(printWindow.document.write).toHaveBeenCalledWith(expect.stringContaining("&lt;&amp;&gt;"));
    expect(printWindow.document.close).toHaveBeenCalledOnce();
    expect(printWindow.focus).toHaveBeenCalledOnce();
    expect(printWindow.print).toHaveBeenCalledOnce();
  });

  it("handles unavailable browser download and print APIs", () => {
    vi.stubGlobal("window", undefined);
    expect(createRecoveryKitDownload("recovery", "kit.txt")).toBeUndefined();
    expect(printRecoveryKitContent("recovery")).toBeUndefined();
    vi.unstubAllGlobals();

    vi.spyOn(window, "open").mockReturnValue(null);
    expect(printRecoveryKitContent("recovery")).toBeUndefined();
  });

  it("checks local storage prefixes in browser and server environments", () => {
    expect(inspectLocalStoragePrefix("vault:")).toBe("clear");
    expect(assertNoDecryptedVaultInLocalStorage("vault:")).toBe(true);
    localStorage.setItem("other", "value");
    localStorage.setItem("vault:record", "value");
    expect(inspectLocalStoragePrefix("vault:")).toBe("found");
    expect(assertNoDecryptedVaultInLocalStorage("vault:")).toBe(false);

    vi.stubGlobal("window", undefined);
    expect(inspectLocalStoragePrefix("vault:")).toBe("unavailable");
    expect(assertNoDecryptedVaultInLocalStorage("vault:")).toBe(false);
  });

  it("reports unavailable when local storage access throws", () => {
    vi.stubGlobal("localStorage", {
      get length() {
        throw new Error("denied");
      },
    });
    expect(inspectLocalStoragePrefix("vault:")).toBe("unavailable");
  });

  it("checks IndexedDB database prefixes and fails open when inspection is unavailable", async () => {
    vi.stubGlobal("indexedDB", {
      databases: vi.fn().mockResolvedValue([{ name: "vault:data" }]),
    });
    expect(await inspectIndexedDBPrefix("vault:")).toBe("found");
    expect(await assertNoDecryptedVaultInIndexedDB("vault:")).toBe(false);

    vi.stubGlobal("indexedDB", {
      databases: vi.fn().mockResolvedValue([{ name: "other" }, {}]),
    });
    expect(await inspectIndexedDBPrefix("vault:")).toBe("clear");
    expect(await assertNoDecryptedVaultInIndexedDB("vault:")).toBe(true);

    vi.stubGlobal("indexedDB", { databases: vi.fn().mockRejectedValue(new Error("denied")) });
    expect(await inspectIndexedDBPrefix("vault:")).toBe("unavailable");
    expect(await assertNoDecryptedVaultInIndexedDB("vault:")).toBe(false);

    vi.stubGlobal("indexedDB", {});
    expect(await assertNoDecryptedVaultInIndexedDB("vault:")).toBe(false);

    vi.stubGlobal("indexedDB", {
      databases: () => {
        throw new Error("denied");
      },
    });
    expect(await inspectIndexedDBPrefix("vault:")).toBe("unavailable");

    vi.stubGlobal("window", undefined);
    expect(await assertNoDecryptedVaultInIndexedDB("vault:")).toBe(false);
  });

  it("rejects attempts to persist decrypted records", () => {
    expect(() => persistVaultRecordLocally()).toThrow(/must not be persisted/);
  });
});

describe("vault session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    configureVaultSession({ autoLockMinutes: 1 });
    resetVaultSessionLockState();
    clearVaultClientState();
  });

  afterEach(() => {
    clearVaultAutoLockTimer();
    clearVaultClientState();
    resetVaultSessionLockState();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("stores, clears, and reports the in-memory key", async () => {
    const key = await createUserVaultKey();
    expect(getSessionVaultKey()).toBeNull();
    expect(isVaultUnlocked()).toBe(false);
    expect(getVaultLockState()).toBe("locked");

    setSessionVaultKey(key);
    expect(getSessionVaultKey()).toBe(key);
    expect(isVaultUnlocked()).toBe(true);
    expect(getVaultLockState()).toBe("unlocked");

    lockVault();
    expect(getSessionVaultKey()).toBeNull();
  });

  it("notifies subscribers and supports unsubscribe", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeVaultSession(listener);
    unlockVaultSession(await createUserVaultKey());
    expect(listener).toHaveBeenCalledOnce();
    lockVaultSessionManually();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(isVaultManuallyLocked()).toBe(true);

    unsubscribe();
    resetVaultSessionLockState();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("auto-locks after inactivity and renews the timer on touch", async () => {
    configureVaultSession({ autoLockMinutes: 0.001 });
    unlockVaultSession(await createUserVaultKey());
    expect(getVaultAutoLockRemainingMs()).toBe(60);

    vi.advanceTimersByTime(30);
    touchVaultSession();
    expect(getVaultAutoLockRemainingMs()).toBe(60);
    vi.advanceTimersByTime(59);
    expect(isVaultUnlocked()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isVaultUnlocked()).toBe(false);
    expect(getVaultAutoLockRemainingMs()).toBeNull();
  });

  it("uses resolved timeouts and falls back for invalid values", async () => {
    configureVaultSession({
      autoLockMinutes: 2,
      resolveAutoLockMinutes: () => 0.002,
    });
    unlockVaultSession(await createUserVaultKey());
    expect(getVaultAutoLockRemainingMs()).toBe(120);

    configureVaultSession({ autoLockMinutes: Number.NaN });
    touchVaultSession();
    expect(getVaultAutoLockRemainingMs()).toBe(15 * 60 * 1000);
  });

  it("does not schedule or touch locked and manually locked sessions", async () => {
    scheduleVaultAutoLock();
    touchVaultSession();
    expect(getVaultAutoLockRemainingMs()).toBeNull();

    unlockVaultSession(await createUserVaultKey());
    lockVaultSession();
    scheduleVaultAutoLock();
    touchVaultSession();
    expect(getVaultAutoLockRemainingMs()).toBeNull();
  });

  it("locks on pagehide and removes the unload guard", async () => {
    unlockVaultSession(await createUserVaultKey());
    const unregister = registerVaultUnloadGuard();
    window.dispatchEvent(new Event("pagehide"));
    expect(isVaultUnlocked()).toBe(false);

    resetVaultSessionLockState();
    unlockVaultSession(await createUserVaultKey());
    unregister();
    window.dispatchEvent(new Event("pagehide"));
    expect(isVaultUnlocked()).toBe(true);
  });

  it("renews inactivity on browser activity and removes the activity guard", async () => {
    configureVaultSession({ autoLockMinutes: 0.001 });
    unlockVaultSession(await createUserVaultKey());
    const unregister = registerVaultActivityGuard(["keydown"]);
    vi.advanceTimersByTime(30);
    window.dispatchEvent(new Event("keydown"));
    expect(getVaultAutoLockRemainingMs()).toBe(60);

    unregister();
    vi.advanceTimersByTime(30);
    window.dispatchEvent(new Event("keydown"));
    expect(getVaultAutoLockRemainingMs()).toBe(30);
  });

  it("returns a no-op unload guard outside the browser", () => {
    vi.stubGlobal("window", undefined);
    expect(registerVaultUnloadGuard()()).toBeUndefined();
    expect(registerVaultActivityGuard()()).toBeUndefined();
  });
});
