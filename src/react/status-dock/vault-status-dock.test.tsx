/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVaultAutoLockTimer,
  configureVaultSession,
  getVaultAutoLockRemainingMs,
  lockVaultSession,
  resetVaultSessionLockState,
  unlockVaultSession,
} from "../../browser.js";
import * as browser from "../../browser.js";
import { createNonExtractableSessionVaultKey } from "../../testing/session-vault-key.js";
import {
  createVaultFullUnlockPageMatcher,
  VaultStatusDock,
  type VaultStatusDockLinkProps,
} from "./vault-status-dock.js";
import { VaultDockQuickUnlock } from "./vault-dock-quick-unlock.js";
import { requestVaultDockExpand } from "./events.js";
import { resetPasskeyAutoStartDedupe } from "./passkey-auto-start-dedupe.js";
import {
  readVaultStatusDockCollapsedPreference,
  writeVaultStatusDockCollapsedPreference,
} from "./preference.js";

const serverStatus = { configured: true, hasPasskeyPrfEnvelope: false };
const preferenceStore = new Map<string, string>();
const sessionStore = new Map<string, string>();

function installLocalStorageStub() {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => preferenceStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      preferenceStore.set(key, value);
    },
    removeItem: (key: string) => {
      preferenceStore.delete(key);
    },
    clear: () => {
      preferenceStore.clear();
    },
  });
}

function installSessionStorageStub() {
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => sessionStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      sessionStore.set(key, value);
    },
    removeItem: (key: string) => {
      sessionStore.delete(key);
    },
    clear: () => {
      sessionStore.clear();
    },
  });
}

function renderDock(overrides: Partial<ComponentProps<typeof VaultStatusDock>> = {}) {
  return render(
    <div className="vc-status-dock-host">
      <VaultStatusDock
        serverStatus={serverStatus}
        prfSupported
        pathname="/vault"
        unlockPath="/vault/unlock"
        autoLockMinutes={15}
        passkeyAutoStartDelayMs={0}
        collapsedPreferenceKey="test:dock:collapsed"
        renderQuickUnlock={({
          loading,
          error,
          onPasskeyUnlockFailed,
          onPasskeyUnlockCancelled,
          bindAutoStartPasskey,
        }) => (
          <VaultDockQuickUnlock
            loading={loading}
            error={error}
            serverStatus={serverStatus}
            onUnlockPassword={vi.fn()}
            onPasskeyUnlockFailed={onPasskeyUnlockFailed}
            onPasskeyUnlockCancelled={onPasskeyUnlockCancelled}
            bindAutoStartPasskey={bindAutoStartPasskey}
          />
        )}
        {...overrides}
      />
    </div>
  );
}

describe("VaultStatusDock", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    preferenceStore.clear();
    sessionStore.clear();
    installLocalStorageStub();
    installSessionStorageStub();
    resetPasskeyAutoStartDedupe("test:dock:collapsed:passkey-auto-start");
    configureVaultSession({ autoLockMinutes: 15 });
    resetVaultSessionLockState();
    lockVaultSession();
  });

  afterEach(() => {
    cleanup();
    clearVaultAutoLockTimer();
    resetVaultSessionLockState();
    lockVaultSession();
  });

  it("renders collapsed locked handle with reserved countdown width", () => {
    renderDock();
    const handle = screen.getByTestId("vault-status-dock-handle");
    expect(handle.className).toContain("vc-status-dock-handle--closed");
    expect(screen.getByText("Vault locked")).toBeTruthy();
    const time = handle.querySelector(".vc-status-dock-handle__time");
    expect(time).toBeTruthy();
    expect(time?.className).toContain("vc-status-dock-handle__time--reserved");
    expect(time?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders emergency locked state from server snapshot", () => {
    renderDock({
      serverStatus: {
        configured: true,
        emergencyModeEnabled: true,
        emergencyModeActive: true,
        decoyConfigured: true,
      },
    });
    expect(screen.getByText("Vault locked")).toBeTruthy();
  });

  it("renders unlocked panel when emergency unlocked", async () => {
    const key = await createNonExtractableSessionVaultKey();
    await unlockVaultSession(key, { role: "decoy" });
    renderDock({
      serverStatus: {
        configured: true,
        emergencyModeEnabled: true,
        emergencyModeActive: true,
        decoyConfigured: true,
      },
    });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getAllByText("Vault open").length).toBeGreaterThan(0);
  });

  it("expands locked panel with quick unlock", () => {
    renderDock();
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    const dock = screen.getByTestId("vault-status-dock");
    expect(dock.className).toContain("vc-status-dock-panel--closed");
    expect(dock.className).toContain("vc-status-dock-panel--unlocked");
    expect(screen.getByLabelText(/vault password/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /more unlock options/i })).toBeTruthy();
    const handle = screen.getByTestId("vault-status-dock-handle");
    expect(handle.getAttribute("aria-expanded")).toBe("true");
    expect(handle.className).toContain("vc-status-dock-handle--closed");
    expect(handle.querySelector(".vc-status-dock-handle__label")?.textContent).toBe("Vault locked");
  });

  it("keeps duress behavior disabled by default", async () => {
    vi.useFakeTimers();
    try {
      const onDuressSignalChange = vi.fn();
      renderDock({ onDuressSignalChange });
      const handle = screen.getByTestId("vault-status-dock-handle");
      fireEvent.pointerDown(handle, { pointerType: "touch", button: 0 });
      await act(async () => {
        vi.advanceTimersByTime(1_100);
      });
      expect(onDuressSignalChange).not.toHaveBeenCalledWith(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("enables handle duress behavior only when explicitly opted in", async () => {
    vi.useFakeTimers();
    try {
      const onDuressSignalChange = vi.fn();
      renderDock({ emergencyModeEnabled: true, onDuressSignalChange });
      const handle = screen.getByTestId("vault-status-dock-handle");
      fireEvent.pointerDown(handle, { pointerType: "touch", button: 0 });
      await act(async () => {
        vi.advanceTimersByTime(1_100);
      });
      expect(onDuressSignalChange).toHaveBeenCalledWith(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps locked handle visible when expanded quick-unlock panel is open", async () => {
    renderDock();
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();
    const handle = screen.getByTestId("vault-status-dock-handle");
    expect(handle.querySelector(".vc-status-dock-handle__time--reserved")).toBeTruthy();

    fireEvent.mouseDown(document.body);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();
    expect(handle.getAttribute("aria-expanded")).toBe("true");

    const passwordInput = screen.getByLabelText(/vault password/i);
    passwordInput.blur();
    const outside = document.createElement("button");
    document.body.append(outside);
    fireEvent.mouseDown(outside);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByTestId("vault-status-dock")).toBeNull();
    expect(screen.getByTestId("vault-status-dock-handle").getAttribute("aria-expanded")).toBe(
      "false"
    );
    outside.remove();
  });

  it("hides when vault is not configured", () => {
    renderDock({ serverStatus: { configured: false } });
    expect(screen.queryByTestId("vault-status-dock-handle")).toBeNull();
  });

  it("shows collapsed handle on full unlock page while locked", () => {
    renderDock({ pathname: "/vault/unlock" });
    const handle = screen.getByTestId("vault-status-dock-handle");
    expect(handle).toBeTruthy();
    expect(handle.getAttribute("data-vault-state")).toBe("locked");
    expect(screen.queryByTestId("vault-status-dock")).toBeNull();
  });

  it("shows unlocked handle when session is open", async () => {
    await unlockVaultSession(await createNonExtractableSessionVaultKey());
    renderDock();
    const handle = screen.getByTestId("vault-status-dock-handle");
    expect(handle.className).toContain("vc-status-dock-handle--open");
    expect(screen.getByText("Vault open")).toBeTruthy();
  });

  it("expands unlocked panel with lock now and stay unlocked actions", async () => {
    await act(async () => {
      await unlockVaultSession(await createNonExtractableSessionVaultKey());
    });
    renderDock();
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    const dock = screen.getByTestId("vault-status-dock");
    expect(dock.className).toContain("vc-status-dock-panel--unlocked");
    expect(screen.getByRole("button", { name: /stay unlocked 15 min/i })).toBeTruthy();
    const lockNow = screen.getByRole("button", { name: /lock now/i });
    expect(lockNow.className).toContain("vc-status-dock__action--subtle");
    const handle = screen.getByTestId("vault-status-dock-handle");
    expect(handle.getAttribute("aria-expanded")).toBe("true");
    expect(handle.className).toContain("vc-status-dock-handle--open");
    expect(handle.querySelector(".vc-status-dock-handle__label")?.textContent).toBe("Vault open");
  });

  it("keeps unlocked handle visible with countdown when expanded panel is open", async () => {
    await unlockVaultSession(await createNonExtractableSessionVaultKey());
    renderDock();
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();
    const handle = screen.getByTestId("vault-status-dock-handle");
    expect(handle.querySelector(".vc-status-dock-handle__time")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /stay unlocked 15 min/i }));
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("vault-status-dock")).toBeNull();
    expect(screen.getByTestId("vault-status-dock-handle").getAttribute("aria-expanded")).toBe("false");
  });

  it("collapses after successful unlock from locked expanded state", async () => {
    renderDock();
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();
    await act(async () => {
      await unlockVaultSession(await createNonExtractableSessionVaultKey());
    });
    expect(screen.getByTestId("vault-status-dock-handle")).toBeTruthy();
    expect(screen.queryByTestId("vault-status-dock")).toBeNull();
  });

  it("responds to requestVaultDockExpand", async () => {
    renderDock();
    await act(async () => {
      await Promise.resolve();
      requestVaultDockExpand();
    });
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();
  });

  it("persists collapsed preference", () => {
    renderDock({ collapsedPreferenceKey: "test:dock:collapsed" });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(readVaultStatusDockCollapsedPreference("test:dock:collapsed")).toBe(true);
    writeVaultStatusDockCollapsedPreference(false, "test:dock:collapsed");
    expect(readVaultStatusDockCollapsedPreference("test:dock:collapsed")).toBe(false);
  });

  it("createVaultFullUnlockPageMatcher matches unlock path", () => {
    const matcher = createVaultFullUnlockPageMatcher("/vault/unlock");
    expect(matcher("/vault/unlock")).toBe(true);
    expect(matcher("/vault")).toBe(false);
  });

  it("returns null when not visible", () => {
    renderDock({ visible: false });
    expect(screen.queryByTestId("vault-status-dock-handle")).toBeNull();
  });

  it("locks vault on lock now", async () => {
    await act(async () => {
      await unlockVaultSession(await createNonExtractableSessionVaultKey());
    });
    renderDock({ onLock: vi.fn() });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    fireEvent.click(screen.getByRole("button", { name: /lock now/i }));
    expect(screen.getByTestId("vault-status-dock-handle").getAttribute("data-vault-state")).toBe(
      "locked"
    );
  });

  it("renders unsupported_prf as locked dock state", () => {
    renderDock({
      serverStatus: { configured: true, hasPasskeyPrfEnvelope: true },
      prfSupported: false,
    });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();
  });

  it("touches session on stay unlocked and resets the timer", async () => {
    vi.useFakeTimers();
    const onStayUnlocked = vi.fn();
    await act(async () => {
      await unlockVaultSession(await createNonExtractableSessionVaultKey());
    });
    vi.advanceTimersByTime(30_000);
    expect(getVaultAutoLockRemainingMs()).toBe(14 * 60 * 1000 + 30_000);

    renderDock({ onStayUnlocked });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    fireEvent.click(screen.getByRole("button", { name: /stay unlocked 15 min/i }));
    expect(onStayUnlocked).toHaveBeenCalled();
    expect(getVaultAutoLockRemainingMs()).toBe(15 * 60 * 1000);
    vi.useRealTimers();
  });

  it("shows stay unlocked label with configured auto-lock minutes", async () => {
    await act(async () => {
      await unlockVaultSession(await createNonExtractableSessionVaultKey());
    });
    renderDock({ autoLockMinutes: 5 });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByRole("button", { name: /stay unlocked 5 min/i })).toBeTruthy();
  });

  it("uses vault session auto-lock minutes when dock prop is omitted", async () => {
    configureVaultSession({ autoLockMinutes: 5 });
    await act(async () => {
      await unlockVaultSession(await createNonExtractableSessionVaultKey());
    });
    renderDock({ autoLockMinutes: undefined });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByRole("button", { name: /stay unlocked 5 min/i })).toBeTruthy();
  });

  it("does not reset auto-lock countdown when expanding or collapsing the dock", async () => {
    vi.useFakeTimers();
    await act(async () => {
      await unlockVaultSession(await createNonExtractableSessionVaultKey());
    });
    vi.advanceTimersByTime(30_000);
    const remainingBefore = getVaultAutoLockRemainingMs();
    expect(remainingBefore).toBe(14 * 60 * 1000 + 30_000);

    renderDock();
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(getVaultAutoLockRemainingMs()).toBe(remainingBefore);

    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(getVaultAutoLockRemainingMs()).toBe(remainingBefore);
    vi.useRealTimers();
  });

  it("hides quick unlock when disabled", () => {
    renderDock({ quickUnlockEnabled: false });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.queryByTestId("vault-status-dock")).toBeNull();
  });

  it("uses custom unlock href builder and link component", () => {
    const Link = ({ href, children, onClick, className }: VaultStatusDockLinkProps) => (
      <a href={href} className={className} onClick={onClick} data-testid="custom-link">
        {children}
      </a>
    );
    renderDock({
      LinkComponent: Link,
      buildUnlockHref: (path) => `/vault/unlock?return=${encodeURIComponent(path)}`,
    });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    const link = screen.getByTestId("custom-link");
    expect(link.getAttribute("href")).toContain("return=%2Fvault");
  });

  it("does not expand on full unlock page when locked", () => {
    renderDock({ pathname: "/vault/unlock" });
    expect(screen.getByTestId("vault-status-dock-handle")).toBeTruthy();
    expect(screen.queryByTestId("vault-status-dock")).toBeNull();
  });

  it("respects stored collapsed preference", () => {
    writeVaultStatusDockCollapsedPreference(true, "test:dock:collapsed");
    renderDock({ collapsedPreferenceKey: "test:dock:collapsed" });
    expect(screen.getByTestId("vault-status-dock-handle")).toBeTruthy();
    expect(screen.queryByTestId("vault-status-dock")).toBeNull();
  });

  it("prevents dismiss while loading", () => {
    renderDock({ loading: true });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    fireEvent.mouseDown(document.body);
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();
  });

  it("does not collapse when clicking inside the expanded dock", async () => {
    await act(async () => {
      await unlockVaultSession(await createNonExtractableSessionVaultKey());
    });
    renderDock();
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    fireEvent.mouseDown(screen.getByRole("button", { name: /stay unlocked 15 min/i }));
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();
  });

  it("collapses expanded unlocked panel when auto-lock fires", async () => {
    vi.useFakeTimers();
    configureVaultSession({ autoLockMinutes: 1 });
    await act(async () => {
      await unlockVaultSession(await createNonExtractableSessionVaultKey());
    });
    renderDock();
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(60_001);
    });

    expect(screen.queryByTestId("vault-status-dock")).toBeNull();
    const handle = screen.getByTestId("vault-status-dock-handle");
    expect(handle.className).toContain("vc-status-dock-handle--closed");
    expect(screen.getByText("Vault locked")).toBeTruthy();
    expect(handle.getAttribute("data-vault-state")).toBe("locked");
    vi.useRealTimers();
  });

  it("shows full unlock link label when passkey envelope exists but PRF is unavailable", () => {
    renderDock({
      serverStatus: { configured: true, hasPasskeyPrfEnvelope: true },
      prfSupported: false,
    });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByRole("link", { name: /open full unlock page/i })).toBeTruthy();
  });

  it("starts expanded when collapse preference is false", () => {
    writeVaultStatusDockCollapsedPreference(false, "test:dock:collapsed");
    renderDock({ collapsedPreferenceKey: "test:dock:collapsed" });
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();
  });

  it("builds return path with current search params", () => {
    window.history.pushState({}, "", "/vault?tab=notes");
    renderDock({ pathname: "/vault" });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    const link = screen.getByRole("link", { name: /more unlock options/i });
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain("tab=notes");
    window.history.pushState({}, "", "/");
  });

  it("shows more unlock options when passkey PRF is available", () => {
    vi.spyOn(browser, "isPrfExtensionHeuristicallyAvailable").mockReturnValue(true);
    renderDock({
      serverStatus: { configured: true, hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisBrowser: true },
      prfSupported: true,
    });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    const link = screen.getByRole("link", { name: /more unlock options/i });
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(screen.getByTestId("vault-status-dock-handle")).toBeTruthy();
    vi.restoreAllMocks();
  });

  it("does not redirect to full unlock when dock passkey unlock is cancelled", async () => {
    vi.spyOn(browser, "isPrfExtensionHeuristicallyAvailable").mockReturnValue(true);
    const onNavigateToUnlock = vi.fn();
    const onUnlockPasskey = vi.fn().mockRejectedValue(new DOMException("cancelled", "NotAllowedError"));
    renderDock({
      onNavigateToUnlock,
      pathname: "/vault",
      serverStatus: { configured: true, hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisBrowser: true },
      prfSupported: true,
      renderQuickUnlock: ({
        loading,
        error,
        onPasskeyUnlockFailed,
        onPasskeyUnlockCancelled,
        bindAutoStartPasskey,
      }) => (
        <VaultDockQuickUnlock
          loading={loading}
          error={error}
          serverStatus={{ configured: true, hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisBrowser: true }}
          onUnlockPassword={vi.fn()}
          onUnlockPasskey={onUnlockPasskey}
          passkeyReady
          passkeyOptionsReady
          autoStartPasskey={false}
          onPasskeyUnlockFailed={onPasskeyUnlockFailed}
          onPasskeyUnlockCancelled={onPasskeyUnlockCancelled}
          bindAutoStartPasskey={bindAutoStartPasskey}
        />
      ),
    });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    fireEvent.click(screen.getByRole("button", { name: /unlock with passkey/i }));
    await waitFor(() => {
      expect(onUnlockPasskey).toHaveBeenCalled();
    });
    expect(onNavigateToUnlock).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("redirects to full unlock when dock passkey unlock fails with PRF unavailable", async () => {
    vi.spyOn(browser, "isPrfExtensionHeuristicallyAvailable").mockReturnValue(true);
    const onNavigateToUnlock = vi.fn();
    const onUnlockPasskey = vi.fn().mockRejectedValue(new Error("PRF unavailable in this browser"));
    renderDock({
      onNavigateToUnlock,
      pathname: "/vault",
      serverStatus: { configured: true, hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisBrowser: true },
      prfSupported: true,
      renderQuickUnlock: ({
        loading,
        error,
        onPasskeyUnlockFailed,
        onPasskeyUnlockCancelled,
        bindAutoStartPasskey,
      }) => (
        <VaultDockQuickUnlock
          loading={loading}
          error={error}
          serverStatus={{ configured: true, hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisBrowser: true }}
          onUnlockPassword={vi.fn()}
          onUnlockPasskey={onUnlockPasskey}
          passkeyReady
          passkeyOptionsReady
          autoStartPasskey={false}
          onPasskeyUnlockFailed={onPasskeyUnlockFailed}
          onPasskeyUnlockCancelled={onPasskeyUnlockCancelled}
          bindAutoStartPasskey={bindAutoStartPasskey}
        />
      ),
    });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    fireEvent.click(screen.getByRole("button", { name: /unlock with passkey/i }));
    await waitFor(() => {
      expect(onNavigateToUnlock).toHaveBeenCalledWith("/vault/unlock?next=%2Fvault");
    });
    vi.restoreAllMocks();
  });

  it("uses the two-second passkey delay by default only when emergency mode is enabled", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(browser, "isPrfExtensionHeuristicallyAvailable").mockReturnValue(true);
      const onUnlockPasskey = vi.fn().mockResolvedValue(undefined);

      render(
        <div className="vc-status-dock-host">
          <VaultStatusDock
            serverStatus={{ configured: true, hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisBrowser: true }}
            prfSupported
            pathname="/vault"
            unlockPath="/vault/unlock"
            autoLockMinutes={15}
            emergencyModeEnabled
            collapsedPreferenceKey="test:dock:delay"
            renderQuickUnlock={({
              bindAutoStartPasskey,
              onPasskeyUnlockFailed,
              onPasskeyUnlockCancelled,
            }) => (
              <VaultDockQuickUnlock
                serverStatus={{ configured: true, hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisBrowser: true }}
                onUnlockPassword={vi.fn()}
                onUnlockPasskey={onUnlockPasskey}
                passkeyReady
                passkeyOptionsReady
                bindAutoStartPasskey={bindAutoStartPasskey}
                onPasskeyUnlockFailed={onPasskeyUnlockFailed}
                onPasskeyUnlockCancelled={onPasskeyUnlockCancelled}
              />
            )}
          />
        </div>
      );

      fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
      expect(onUnlockPasskey).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(onUnlockPasskey).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("auto-starts passkey immediately by default when emergency mode is disabled", async () => {
    vi.spyOn(browser, "isPrfExtensionHeuristicallyAvailable").mockReturnValue(true);
    const onUnlockPasskey = vi.fn().mockResolvedValue(undefined);

    render(
      <div className="vc-status-dock-host">
        <VaultStatusDock
          serverStatus={{
            configured: true,
            hasPasskeyPrfEnvelope: true,
            passkeyUnlockAvailableOnThisBrowser: true,
          }}
          prfSupported
          pathname="/vault"
          unlockPath="/vault/unlock"
          autoLockMinutes={15}
          collapsedPreferenceKey="test:dock:immediate-default"
          renderQuickUnlock={({
            bindAutoStartPasskey,
            onPasskeyUnlockFailed,
            onPasskeyUnlockCancelled,
          }) => (
            <VaultDockQuickUnlock
              serverStatus={{
                configured: true,
                hasPasskeyPrfEnvelope: true,
                passkeyUnlockAvailableOnThisBrowser: true,
              }}
              onUnlockPassword={vi.fn()}
              onUnlockPasskey={onUnlockPasskey}
              passkeyReady
              passkeyOptionsReady
              bindAutoStartPasskey={bindAutoStartPasskey}
              onPasskeyUnlockFailed={onPasskeyUnlockFailed}
              onPasskeyUnlockCancelled={onPasskeyUnlockCancelled}
            />
          )}
        />
      </div>
    );

    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    await waitFor(() => expect(onUnlockPasskey).toHaveBeenCalledTimes(1));
    vi.restoreAllMocks();
  });

  it("dedupes passkey auto-start across quick-unlock remount", async () => {
    vi.spyOn(browser, "isPrfExtensionHeuristicallyAvailable").mockReturnValue(true);
    const onUnlockPasskey = vi.fn().mockResolvedValue(undefined);

    function PasskeyQuickUnlock(
      props: ComponentProps<typeof VaultDockQuickUnlock> & {
        bindAutoStartPasskey: ComponentProps<typeof VaultDockQuickUnlock>["bindAutoStartPasskey"];
      }
    ) {
      return <VaultDockQuickUnlock {...props} />;
    }

    const { unmount } = renderDock({
      serverStatus: { configured: true, hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisBrowser: true },
      prfSupported: true,
      renderQuickUnlock: ({
        loading,
        error,
        onPasskeyUnlockFailed,
        onPasskeyUnlockCancelled,
        bindAutoStartPasskey,
      }) => (
        <PasskeyQuickUnlock
          loading={loading}
          error={error}
          serverStatus={{ configured: true, hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisBrowser: true }}
          onUnlockPassword={vi.fn()}
          onUnlockPasskey={onUnlockPasskey}
          passkeyReady
          passkeyOptionsReady
          onPasskeyUnlockFailed={onPasskeyUnlockFailed}
          onPasskeyUnlockCancelled={onPasskeyUnlockCancelled}
          bindAutoStartPasskey={bindAutoStartPasskey}
        />
      ),
    });

    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    await waitFor(() => {
      expect(onUnlockPasskey).toHaveBeenCalledTimes(1);
    });

    unmount();
    renderDock({
      serverStatus: { configured: true, hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisBrowser: true },
      prfSupported: true,
      renderQuickUnlock: ({
        loading,
        error,
        onPasskeyUnlockFailed,
        onPasskeyUnlockCancelled,
        bindAutoStartPasskey,
      }) => (
        <PasskeyQuickUnlock
          loading={loading}
          error={error}
          serverStatus={{ configured: true, hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisBrowser: true }}
          onUnlockPassword={vi.fn()}
          onUnlockPasskey={onUnlockPasskey}
          passkeyReady
          passkeyOptionsReady
          onPasskeyUnlockFailed={onPasskeyUnlockFailed}
          onPasskeyUnlockCancelled={onPasskeyUnlockCancelled}
          bindAutoStartPasskey={bindAutoStartPasskey}
        />
      ),
    });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    await waitFor(() => {
      expect(onUnlockPasskey).toHaveBeenCalledTimes(1);
    });
    vi.restoreAllMocks();
  });
});
