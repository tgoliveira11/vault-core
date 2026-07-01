import { describe, expect, it } from "vitest";
import { measureVaultLockOverlayPanels } from "./overlay-panels.js";

describe("measureVaultLockOverlayPanels without window", () => {
  it("returns an empty list when window is unavailable", () => {
    expect(measureVaultLockOverlayPanels()).toEqual([]);
  });
});
