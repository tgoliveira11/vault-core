/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import {
  collectVaultLockOverlayExclusionRects,
  VAULT_LOCK_OVERLAY_EXCLUDE_ATTR,
  VAULT_LOCK_OVERLAY_EXCLUDE_SELECTOR,
} from "./overlay-exclude.js";

describe("overlay exclude helpers", () => {
  it("exports the exclude selector", () => {
    expect(VAULT_LOCK_OVERLAY_EXCLUDE_SELECTOR).toBe(
      `[${VAULT_LOCK_OVERLAY_EXCLUDE_ATTR}="true"]`
    );
  });

  it("collects bounding rects for exclusion elements", () => {
    const element = document.createElement("div");
    element.setAttribute(VAULT_LOCK_OVERLAY_EXCLUDE_ATTR, "true");
    document.body.appendChild(element);

    const rectSpy = vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      top: 0,
      left: 0,
      right: 100,
      bottom: 40,
      width: 100,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    expect(collectVaultLockOverlayExclusionRects()).toEqual([
      { top: 0, left: 0, right: 100, bottom: 40 },
    ]);

    rectSpy.mockRestore();
    element.remove();
  });

  it("skips zero-size exclusion elements", () => {
    const element = document.createElement("div");
    element.setAttribute(VAULT_LOCK_OVERLAY_EXCLUDE_ATTR, "true");
    document.body.appendChild(element);

    const rectSpy = vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    expect(collectVaultLockOverlayExclusionRects()).toEqual([]);

    rectSpy.mockRestore();
    element.remove();
  });

  it("ignores non-HTMLElement matches", () => {
    vi.spyOn(document, "querySelectorAll").mockReturnValue([
      {
        getBoundingClientRect: () => ({
          top: 0,
          left: 0,
          right: 10,
          bottom: 10,
          width: 10,
          height: 10,
        }),
      } as unknown as Element,
    ]);

    expect(collectVaultLockOverlayExclusionRects()).toEqual([]);
    vi.restoreAllMocks();
  });
});
