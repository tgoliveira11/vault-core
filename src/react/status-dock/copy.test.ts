import { describe, expect, it } from "vitest";
import {
  DEFAULT_VAULT_STATUS_DOCK_LABELS,
  getDefaultVaultStatusDockExpanded,
  getVaultStatusDockExpandedCopy,
  getVaultStatusDockHandleLabel,
  resolveVaultStatusDockExpanded,
  buildVaultStatusDockReturnPath,
  vaultStatusDockAutoCollapseWhenExpanded,
} from "./copy.js";

describe("vault status dock copy", () => {
  it("defaults to collapsed for all statuses", () => {
    expect(getDefaultVaultStatusDockExpanded("locked")).toBe(false);
    expect(getDefaultVaultStatusDockExpanded("unlocked")).toBe(false);
    expect(getDefaultVaultStatusDockExpanded("not_setup")).toBe(false);
  });

  it("auto-collapses when locked or unlocked", () => {
    expect(vaultStatusDockAutoCollapseWhenExpanded("locked")).toBe(true);
    expect(vaultStatusDockAutoCollapseWhenExpanded("unlocked")).toBe(true);
    expect(vaultStatusDockAutoCollapseWhenExpanded("not_setup")).toBe(false);
  });

  it("builds handle labels", () => {
    expect(getVaultStatusDockHandleLabel("locked", null)).toBe("Vault");
    expect(getVaultStatusDockHandleLabel("unlocked", "14:32")).toBe("14:32");
    expect(getVaultStatusDockHandleLabel("unlocked", null)).toBe("Open");
  });

  it("builds stay unlocked label from configured minutes", () => {
    expect(DEFAULT_VAULT_STATUS_DOCK_LABELS.stayUnlocked(5)).toBe("Stay unlocked 5 min");
    expect(DEFAULT_VAULT_STATUS_DOCK_LABELS.stayUnlocked(15)).toBe("Stay unlocked 15 min");
  });

  it("builds expanded copy", () => {
    expect(getVaultStatusDockExpandedCopy("locked", null).title).toBe("Vault locked");
    expect(getVaultStatusDockExpandedCopy("unlocked", "14:32").countdownInline).toBe(
      "Auto-locks in 14:32"
    );
    expect(getVaultStatusDockExpandedCopy("not_setup", null).title).toBe("Vault not set up");
  });

  it("resolves expanded state from preference and route", () => {
    expect(resolveVaultStatusDockExpanded("locked", null, false)).toBe(false);
    expect(resolveVaultStatusDockExpanded("locked", true, false)).toBe(false);
    expect(resolveVaultStatusDockExpanded("locked", false, false)).toBe(true);
    expect(resolveVaultStatusDockExpanded("locked", false, true)).toBe(false);
    expect(resolveVaultStatusDockExpanded("unsupported_prf", false, true)).toBe(false);
    expect(buildVaultStatusDockReturnPath("/vault", "tab=notes")).toBe("/vault?tab=notes");
    expect(buildVaultStatusDockReturnPath("/vault", "")).toBe("/vault");
  });
});
