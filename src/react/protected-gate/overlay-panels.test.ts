import { describe, expect, it } from "vitest";
import { computeVaultLockOverlayPanels } from "./overlay-panels.js";

describe("computeVaultLockOverlayPanels", () => {
  it("covers the full viewport when there are no exclusions", () => {
    expect(computeVaultLockOverlayPanels(800, 600, [])).toEqual([
      { top: 0, left: 0, width: 800, height: 600 },
    ]);
  });

  it("carves out a top header exclusion", () => {
    expect(
      computeVaultLockOverlayPanels(800, 600, [{ top: 0, left: 0, right: 800, bottom: 72 }])
    ).toEqual([{ top: 72, left: 0, width: 800, height: 528 }]);
  });

  it("carves out a right sidebar exclusion", () => {
    const panels = computeVaultLockOverlayPanels(800, 600, [
      { top: 0, left: 700, right: 800, bottom: 600 },
    ]);
    expect(panels).toEqual([{ top: 0, left: 0, width: 700, height: 600 }]);
  });
});
