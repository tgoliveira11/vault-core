import { describe, expect, it, vi } from "vitest";
import { navigateToVaultFullUnlock } from "./navigate-to-full-unlock.js";

describe("navigateToVaultFullUnlock", () => {
  it("uses app navigation callback when provided", () => {
    const onNavigate = vi.fn();
    navigateToVaultFullUnlock("/vault/unlock?next=%2Fvault", onNavigate);
    expect(onNavigate).toHaveBeenCalledWith("/vault/unlock?next=%2Fvault");
  });

  it("falls back to window navigation", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    navigateToVaultFullUnlock("/vault/unlock?next=%2Fvault");
    expect(assign).toHaveBeenCalledWith("/vault/unlock?next=%2Fvault");
    vi.unstubAllGlobals();
  });

  it("no-ops when no callback and window is unavailable", () => {
    vi.stubGlobal("window", undefined);
    expect(() => navigateToVaultFullUnlock("/vault/unlock")).not.toThrow();
    vi.unstubAllGlobals();
  });
});
