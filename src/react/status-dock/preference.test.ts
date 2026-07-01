/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readVaultStatusDockCollapsedPreference,
  writeVaultStatusDockCollapsedPreference,
} from "./preference.js";

const KEY = "test:vault-status-dock:collapsed";
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

describe("vault status dock preference", () => {
  beforeEach(() => {
    preferenceStore.clear();
    installLocalStorageStub();
  });

  afterEach(() => {
    preferenceStore.clear();
  });

  it("reads and writes collapse preference", () => {
    expect(readVaultStatusDockCollapsedPreference(KEY)).toBeNull();
    writeVaultStatusDockCollapsedPreference(true, KEY);
    expect(readVaultStatusDockCollapsedPreference(KEY)).toBe(true);
    writeVaultStatusDockCollapsedPreference(false, KEY);
    expect(readVaultStatusDockCollapsedPreference(KEY)).toBe(false);
  });
});
