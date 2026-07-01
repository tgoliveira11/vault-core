import { describe, expect, it } from "vitest";
import { collectVaultLockOverlayExclusionRects } from "./overlay-exclude.js";

describe("collectVaultLockOverlayExclusionRects without document", () => {
  it("returns an empty list when document is unavailable", () => {
    expect(collectVaultLockOverlayExclusionRects()).toEqual([]);
  });
});
