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
import { createUserVaultKey } from "../../index.js";
import {
  createVaultFullUnlockPageMatcher,
  VaultStatusDock,
  type VaultStatusDockLinkProps,
} from "./vault-status-dock.js";
import { VaultDockQuickUnlock } from "./vault-dock-quick-unlock.js";
import { requestVaultDockExpand } from "./events.js";
import {
  readVaultStatusDockCollapsedPreference,
  writeVaultStatusDockCollapsedPreference,
} from "./preference.js";

const serverStatus = { configured: true, hasPasskeyPrfEnvelope: false };
const preferenceStore = new Map<string, string>();

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

function renderDock(overrides: Partial<ComponentProps<typeof VaultStatusDock>> = {}) {
  return render(
    <div className="vc-status-dock-host">
      <VaultStatusDock
        serverStatus={serverStatus}
        prfSupported
        pathname="/vault"
        unlockPath="/vault/unlock"
        autoLockMinutes={15}
        renderQuickUnlock={({ loading, error, onPasskeyUnlockFailed }) => (
          <VaultDockQuickUnlock
            loading={loading}
            error={error}
            serverStatus={serverStatus}
            onUnlockPassword={vi.fn()}
            onPasskeyUnlockFailed={onPasskeyUnlockFailed}
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
    installLocalStorageStub();
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
    await unlockVaultSession(await createUserVaultKey());
    renderDock();
    const handle = screen.getByTestId("vault-status-dock-handle");
    expect(handle.className).toContain("vc-status-dock-handle--open");
    expect(screen.getByText("Vault open")).toBeTruthy();
  });

  it("expands unlocked panel with lock now and stay unlocked actions", async () => {
    await act(async () => {
      await unlockVaultSession(await createUserVaultKey());
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
    await unlockVaultSession(await createUserVaultKey());
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
      await unlockVaultSession(await createUserVaultKey());
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
      await unlockVaultSession(await createUserVaultKey());
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
      await unlockVaultSession(await createUserVaultKey());
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
      await unlockVaultSession(await createUserVaultKey());
    });
    renderDock({ autoLockMinutes: 5 });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByRole("button", { name: /stay unlocked 5 min/i })).toBeTruthy();
  });

  it("uses vault session auto-lock minutes when dock prop is omitted", async () => {
    configureVaultSession({ autoLockMinutes: 5 });
    await act(async () => {
      await unlockVaultSession(await createUserVaultKey());
    });
    renderDock({ autoLockMinutes: undefined });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByRole("button", { name: /stay unlocked 5 min/i })).toBeTruthy();
  });

  it("does not reset auto-lock countdown when expanding or collapsing the dock", async () => {
    vi.useFakeTimers();
    await act(async () => {
      await unlockVaultSession(await createUserVaultKey());
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
      await unlockVaultSession(await createUserVaultKey());
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
    configureVaultSession({ autoLockMinutes: 0.001 });
    await act(async () => {
      await unlockVaultSession(await createUserVaultKey());
    });
    renderDock();
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    expect(screen.getByTestId("vault-status-dock")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(61);
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
    vi.spyOn(browser, "isPrfExtensionSupported").mockReturnValue(true);
    renderDock({
      serverStatus: { configured: true, hasPasskeyPrfEnvelope: true },
      prfSupported: true,
    });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    const link = screen.getByRole("link", { name: /more unlock options/i });
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(screen.getByTestId("vault-status-dock-handle")).toBeTruthy();
    vi.restoreAllMocks();
  });

  it("redirects to full unlock when dock passkey unlock fails", async () => {
    vi.spyOn(browser, "isPrfExtensionSupported").mockReturnValue(true);
    const onNavigateToUnlock = vi.fn();
    const onUnlockPasskey = vi.fn().mockRejectedValue(new DOMException("cancelled", "NotAllowedError"));
    renderDock({
      onNavigateToUnlock,
      pathname: "/vault",
      serverStatus: { configured: true, hasPasskeyPrfEnvelope: true },
      prfSupported: true,
      renderQuickUnlock: ({ loading, error, onPasskeyUnlockFailed }) => (
        <VaultDockQuickUnlock
          loading={loading}
          error={error}
          serverStatus={{ configured: true, hasPasskeyPrfEnvelope: true }}
          onUnlockPassword={vi.fn()}
          onUnlockPasskey={onUnlockPasskey}
          passkeyReady
          onPasskeyUnlockFailed={onPasskeyUnlockFailed}
        />
      ),
    });
    fireEvent.click(screen.getByTestId("vault-status-dock-handle"));
    await waitFor(() => {
      expect(onUnlockPasskey).toHaveBeenCalled();
    });
    expect(onNavigateToUnlock).toHaveBeenCalledWith("/vault/unlock?next=%2Fvault");
    vi.restoreAllMocks();
  });
});
