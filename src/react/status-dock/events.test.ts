/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { requestVaultDockExpand, subscribeVaultDockExpand } from "./events.js";

describe("vault dock expand events", () => {
  it("dispatches and subscribes to expand events", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeVaultDockExpand(listener, "test:vault-dock-expand");
    requestVaultDockExpand("test:vault-dock-expand");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    requestVaultDockExpand("test:vault-dock-expand");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
