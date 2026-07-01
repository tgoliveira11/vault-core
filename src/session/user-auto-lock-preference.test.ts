/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  clampVaultAutoLockMinutes,
  resolveVaultAutoLockMinutesPreference,
  VAULT_USER_AUTO_LOCK_MIN_MINUTES,
} from "./user-auto-lock-preference.js";

describe("resolveVaultAutoLockMinutesPreference", () => {
  it("prefers user over admin, env, and default", () => {
    expect(
      resolveVaultAutoLockMinutesPreference({
        userMinutes: 10,
        adminMinutes: 30,
        envMinutes: 20,
        defaultMinutes: 15,
      })
    ).toBe(10);
  });

  it("falls back admin → env → default", () => {
    expect(
      resolveVaultAutoLockMinutesPreference({
        adminMinutes: 30,
        envMinutes: 20,
        defaultMinutes: 15,
      })
    ).toBe(30);
    expect(
      resolveVaultAutoLockMinutesPreference({
        envMinutes: 20,
        defaultMinutes: 15,
      })
    ).toBe(20);
    expect(resolveVaultAutoLockMinutesPreference({ defaultMinutes: 15 })).toBe(15);
  });

  it("clamps user values to the admin ceiling and minimum", () => {
    expect(
      resolveVaultAutoLockMinutesPreference({
        userMinutes: 99,
        adminMinutes: 30,
      })
    ).toBe(30);
    expect(
      resolveVaultAutoLockMinutesPreference({
        userMinutes: 0,
        adminMinutes: 30,
      })
    ).toBe(VAULT_USER_AUTO_LOCK_MIN_MINUTES);
  });
});

describe("clampVaultAutoLockMinutes", () => {
  it("rounds and clamps to bounds", () => {
    expect(clampVaultAutoLockMinutes(12.6, { max: 30 })).toBe(13);
    expect(clampVaultAutoLockMinutes(0, { max: 30 })).toBe(1);
    expect(clampVaultAutoLockMinutes(45, { max: 30 })).toBe(30);
    expect(clampVaultAutoLockMinutes(Number.NaN, { max: 30 })).toBe(1);
  });
});

describe("user auto-lock localStorage", () => {
  const KEY = "test:user:auto-lock";
  const preferenceStore = new Map<string, string>();

  beforeEach(() => {
    preferenceStore.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => preferenceStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        preferenceStore.set(key, value);
      },
      removeItem: (key: string) => {
        preferenceStore.delete(key);
      },
    });
  });

  afterEach(() => {
    preferenceStore.clear();
  });

  it("reads, writes, and clears user preference", async () => {
    const {
      readUserVaultAutoLockMinutes,
      writeUserVaultAutoLockMinutes,
      clearUserVaultAutoLockMinutes,
    } = await import("./user-auto-lock-preference.js");

    expect(readUserVaultAutoLockMinutes(KEY)).toBeNull();
    writeUserVaultAutoLockMinutes(25, KEY);
    expect(readUserVaultAutoLockMinutes(KEY)).toBe(25);
    clearUserVaultAutoLockMinutes(KEY);
    expect(readUserVaultAutoLockMinutes(KEY)).toBeNull();
  });

  it("returns null for invalid stored values", async () => {
    const { readUserVaultAutoLockMinutes } = await import("./user-auto-lock-preference.js");
    preferenceStore.set(KEY, "not-a-number");
    expect(readUserVaultAutoLockMinutes(KEY)).toBeNull();
    preferenceStore.set(KEY, "");
    expect(readUserVaultAutoLockMinutes(KEY)).toBeNull();
  });

  it("ignores write failures", async () => {
    const { writeUserVaultAutoLockMinutes } = await import("./user-auto-lock-preference.js");
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => writeUserVaultAutoLockMinutes(10, KEY)).not.toThrow();
  });

  it("ignores read failures and missing storage APIs", async () => {
    const { readUserVaultAutoLockMinutes, clearUserVaultAutoLockMinutes } = await import(
      "./user-auto-lock-preference.js"
    );
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(readUserVaultAutoLockMinutes(KEY)).toBeNull();

    vi.stubGlobal("localStorage", {});
    expect(readUserVaultAutoLockMinutes(KEY)).toBeNull();

    vi.stubGlobal("localStorage", {
      removeItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => clearUserVaultAutoLockMinutes(KEY)).not.toThrow();
  });
});

describe("user auto-lock preference without window", () => {
  it("returns null when localStorage is unavailable", async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error test shim
    delete globalThis.window;
    const { readUserVaultAutoLockMinutes, writeUserVaultAutoLockMinutes } = await import(
      "./user-auto-lock-preference.js"
    );
    expect(readUserVaultAutoLockMinutes()).toBeNull();
    expect(() => writeUserVaultAutoLockMinutes(5)).not.toThrow();
    globalThis.window = originalWindow;
  });
});
