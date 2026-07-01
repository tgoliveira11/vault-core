/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VAULT_LOCK_OVERLAY_EXCLUDE_ATTR } from "./overlay-exclude.js";
import { VaultLockOverlayExclude } from "./vault-lock-overlay-exclude.js";

describe("VaultLockOverlayExclude", () => {
  afterEach(() => cleanup());

  it("marks children with the exclusion attribute and class", () => {
    render(
      <VaultLockOverlayExclude className="app-header">
        <nav>Navigation</nav>
      </VaultLockOverlayExclude>
    );

    const root = screen.getByText("Navigation").parentElement;
    expect(root?.classList.contains("vc-vault-lock-overlay-exclude")).toBe(true);
    expect(root?.classList.contains("app-header")).toBe(true);
    expect(root?.getAttribute(VAULT_LOCK_OVERLAY_EXCLUDE_ATTR)).toBe("true");
  });
});
