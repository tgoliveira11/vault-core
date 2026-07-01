/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { measureVaultLockOverlayPanels } from "./overlay-panels.js";

describe("measureVaultLockOverlayPanels with window", () => {
  it("measures the current viewport when exclusions are absent", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 640 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 480 });

    expect(measureVaultLockOverlayPanels()).toEqual([
      { top: 0, left: 0, width: 640, height: 480 },
    ]);
  });
});
