// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  clearVaultAutoLockTimer,
  configureVaultSession,
  getVaultAutoLockRemainingMs,
  isVaultUnlocked,
  lockVaultSession,
  resetVaultSessionLockState,
  unlockVaultSession,
} from "../browser.js";
import { createUserVaultKey } from "../index.js";
import { useVaultLockState, useVaultUnlocked } from "./session/use-vault-unlocked.js";
import { useVaultSession } from "./session/use-vault-session.js";
import { VaultSessionProvider } from "./session/vault-session-provider.js";
import { useVaultClientStatus } from "./status/use-vault-client-status.js";

describe("React vault helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    configureVaultSession({ autoLockMinutes: 1 });
    resetVaultSessionLockState();
    lockVaultSession();
  });

  afterEach(() => {
    cleanup();
    clearVaultAutoLockTimer();
    resetVaultSessionLockState();
    lockVaultSession();
    vi.useRealTimers();
  });

  it("reports locked and unlocked lock states", async () => {
    const { result } = renderHook(() => useVaultLockState());
    expect(result.current).toBe("locked");

    await act(async () => unlockVaultSession(await createUserVaultKey()));
    expect(result.current).toBe("unlocked");
  });

  it("uses a locked server snapshot during SSR", () => {
    function ServerSnapshot() {
      return <span>{useVaultUnlocked() ? "unlocked" : "locked"}</span>;
    }

    expect(renderToString(<ServerSnapshot />)).toContain("locked");
  });

  it("configures, touches, and locks a session through the hook", async () => {
    const { result } = renderHook(() =>
      useVaultSession({
        sessionConfig: { autoLockMinutes: 0.001 },
        registerUnloadGuard: false,
        registerActivityGuard: false,
      })
    );
    await act(async () => unlockVaultSession(await createUserVaultKey()));
    expect(result.current.unlocked).toBe(true);

    act(() => result.current.touch());
    expect(getVaultAutoLockRemainingMs()).toBe(60);
    act(() => result.current.lock());
    expect(result.current.unlocked).toBe(false);
  });

  it("uses default hook options and registers the pagehide guard", async () => {
    const { result, unmount } = renderHook(() => useVaultSession());
    await act(async () => unlockVaultSession(await createUserVaultKey()));
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(result.current.unlocked).toBe(false);

    unmount();
    await act(async () => unlockVaultSession(await createUserVaultKey()));
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(isVaultUnlocked()).toBe(true);
  });

  it("renders provider children and applies session configuration", async () => {
    const { rerender, unmount } = render(
      <VaultSessionProvider
        sessionConfig={{ autoLockMinutes: 0.002 }}
        registerUnloadGuard={false}
        registerActivityGuard={false}
      >
        <span>vault child</span>
      </VaultSessionProvider>
    );
    expect(screen.getByText("vault child")).toBeTruthy();
    await act(async () => undefined);
    await act(async () => unlockVaultSession(await createUserVaultKey()));
    expect(getVaultAutoLockRemainingMs()).toBe(120);

    rerender(
      <VaultSessionProvider registerUnloadGuard>
        <span>vault child</span>
      </VaultSessionProvider>
    );
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(isVaultUnlocked()).toBe(false);
    unmount();
  });

  it("derives client status from server and in-memory state", async () => {
    const { result, rerender } = renderHook(
      ({ configured, prfSupported }) =>
        useVaultClientStatus(
          { configured, hasPasskeyPrfEnvelope: true },
          prfSupported
        ),
      { initialProps: { configured: true, prfSupported: false } }
    );
    expect(result.current).toBe("unsupported_prf");

    rerender({ configured: false, prfSupported: true });
    expect(result.current).toBe("not_setup");

    await act(async () => unlockVaultSession(await createUserVaultKey()));
    rerender({ configured: true, prfSupported: true });
    expect(result.current).toBe("unlocked");
  });
});
