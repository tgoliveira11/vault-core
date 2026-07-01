/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const unlockedRef = { current: false };

vi.mock("../session/use-vault-unlocked.js", () => ({
  useVaultUnlocked: () => unlockedRef.current,
}));

import { useVaultUnlockPageNavigation } from "./use-vault-unlock-page-navigation.js";

function Harness(props: Parameters<typeof useVaultUnlockPageNavigation>[0]) {
  useVaultUnlockPageNavigation(props);
  return null;
}

describe("useVaultUnlockPageNavigation", () => {
  afterEach(() => {
    cleanup();
    unlockedRef.current = false;
  });

  it("redirects to setup when vault is not configured", () => {
    const onNavigate = vi.fn();
    render(
      <Harness configured={false} returnPath="/vault" setupPath="/vault/setup" onNavigate={onNavigate} />
    );
    expect(onNavigate).toHaveBeenCalledWith("/vault/setup");
  });

  it("redirects to return path when vault is unlocked", () => {
    unlockedRef.current = true;
    const onNavigate = vi.fn();
    render(
      <Harness configured={true} returnPath="/notes" setupPath="/vault/setup" onNavigate={onNavigate} />
    );
    expect(onNavigate).toHaveBeenCalledWith("/notes");
  });

  it("waits while configured is null", () => {
    const onNavigate = vi.fn();
    render(
      <Harness configured={null} returnPath="/vault" setupPath="/vault/setup" onNavigate={onNavigate} />
    );
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
