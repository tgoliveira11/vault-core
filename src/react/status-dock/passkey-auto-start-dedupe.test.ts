/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetPasskeyAutoStartDedupe,
  tryConsumePasskeyAutoStart,
} from "./passkey-auto-start-dedupe.js";

describe("passkey auto-start dedupe", () => {
  const scopeKey = "test-scope";
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
    resetPasskeyAutoStartDedupe(scopeKey);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("consumes auto-start once within the TTL", () => {
    expect(tryConsumePasskeyAutoStart(scopeKey, 10_000)).toBe(true);
    expect(tryConsumePasskeyAutoStart(scopeKey, 10_000)).toBe(false);
  });

  it("allows auto-start again after the TTL expires", () => {
    const now = 1_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    expect(tryConsumePasskeyAutoStart(scopeKey, 1_000)).toBe(true);
    vi.spyOn(Date, "now").mockReturnValue(now + 1_001);
    expect(tryConsumePasskeyAutoStart(scopeKey, 1_000)).toBe(true);
    vi.restoreAllMocks();
  });

  it("resets dedupe state for tests", () => {
    expect(tryConsumePasskeyAutoStart(scopeKey)).toBe(true);
    resetPasskeyAutoStartDedupe(scopeKey);
    expect(tryConsumePasskeyAutoStart(scopeKey)).toBe(true);
  });

  it("returns true when sessionStorage is unavailable", () => {
    vi.stubGlobal("sessionStorage", undefined);
    expect(tryConsumePasskeyAutoStart(scopeKey)).toBe(true);
  });

  it("returns true when sessionStorage throws", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(tryConsumePasskeyAutoStart(scopeKey)).toBe(true);
  });

  it("returns true when window is unavailable", () => {
    const original = globalThis.window;
    // @ts-expect-error test stub
    delete globalThis.window;
    expect(tryConsumePasskeyAutoStart(scopeKey)).toBe(true);
    resetPasskeyAutoStartDedupe(scopeKey);
    globalThis.window = original;
  });

  it("consumes when stored timestamp is invalid", () => {
    storage.set(`vault-core:passkey-auto-start:${scopeKey}`, "not-a-number");
    expect(tryConsumePasskeyAutoStart(scopeKey)).toBe(true);
  });

  it("ignores reset failures", () => {
    vi.stubGlobal("sessionStorage", {
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => resetPasskeyAutoStartDedupe(scopeKey)).not.toThrow();
  });
});
