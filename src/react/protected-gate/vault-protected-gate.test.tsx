/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVaultAutoLockTimer,
  lockVaultSession,
  resetVaultSessionLockState,
  unlockVaultSession,
} from "../../browser.js";
import { createUserVaultKey } from "../../index.js";
import { requestVaultDockExpand } from "../status-dock/events.js";
import { VaultLockOverlayExclude } from "./vault-lock-overlay-exclude.js";
import { VaultProtectedGate } from "./vault-protected-gate.js";

vi.mock("../status-dock/events.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../status-dock/events.js")>();
  return {
    ...actual,
    requestVaultDockExpand: vi.fn(actual.requestVaultDockExpand),
  };
});

describe("VaultProtectedGate", () => {
  beforeEach(() => {
    resetVaultSessionLockState();
    lockVaultSession();
  });

  afterEach(() => {
    cleanup();
    clearVaultAutoLockTimer();
    resetVaultSessionLockState();
    lockVaultSession();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders children without overlay when unlocked", async () => {
    await act(async () => unlockVaultSession(await createUserVaultKey()));
    render(
      <VaultProtectedGate configured>
        <p>Protected content</p>
      </VaultProtectedGate>
    );
    expect(screen.getByText("Protected content")).toBeTruthy();
    expect(screen.queryByTestId("vault-lock-overlay")).toBeNull();
  });

  it("shows blur overlay and keeps children mounted when locked", () => {
    render(
      <VaultProtectedGate configured>
        <p>Protected content</p>
      </VaultProtectedGate>
    );
    expect(screen.getByText("Protected content")).toBeTruthy();
    expect(screen.getByTestId("vault-lock-overlay")).toBeTruthy();
    expect(screen.getByText("Protected content").closest("[aria-hidden='true']")).toBeTruthy();
  });

  it("carves out VaultLockOverlayExclude regions from the overlay", () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.getAttribute("data-vault-lock-overlay-exclude") === "true") {
          return {
            top: 0,
            left: 0,
            right: 800,
            bottom: 72,
            width: 800,
            height: 72,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    render(
      <>
        <VaultLockOverlayExclude>
          <header data-testid="excluded-header">App header</header>
        </VaultLockOverlayExclude>
        <VaultProtectedGate configured>
          <p>Protected content</p>
        </VaultProtectedGate>
      </>
    );

    const overlay = screen.getByTestId("vault-lock-overlay");
    expect(overlay.style.top).toBe("72px");
    rectSpy.mockRestore();
  });

  it("applies overlayClassName and overlayBackground to the lock overlay", () => {
    render(
      <VaultProtectedGate
        configured
        overlayClassName="demo-lock-overlay"
        overlayBackground="color-mix(in srgb, #f8fafc 92%, transparent)"
      >
        <p>Protected content</p>
      </VaultProtectedGate>
    );
    const overlay = screen.getByTestId("vault-lock-overlay");
    expect(overlay.classList.contains("vc-vault-lock-overlay")).toBe(true);
    expect(overlay.classList.contains("demo-lock-overlay")).toBe(true);
    expect(overlay.style.getPropertyValue("--vc-vault-lock-overlay-color")).toBe(
      "color-mix(in srgb, #f8fafc 92%, transparent)"
    );
  });

  it("expands the dock on Enter while locked", () => {
    render(
      <VaultProtectedGate configured>
        <p>Protected content</p>
      </VaultProtectedGate>
    );
    fireEvent.keyDown(document, { key: "Enter" });
    expect(requestVaultDockExpand).toHaveBeenCalledTimes(1);
  });

  it("does not expand the dock on Enter inside an input", () => {
    render(
      <VaultProtectedGate configured>
        <input aria-label="note title" />
      </VaultProtectedGate>
    );
    fireEvent.keyDown(screen.getByLabelText("note title"), { key: "Enter" });
    expect(requestVaultDockExpand).not.toHaveBeenCalled();
  });

  it("uses onExpandDock when provided", () => {
    const onExpandDock = vi.fn();
    render(
      <VaultProtectedGate configured onExpandDock={onExpandDock}>
        <p>Protected content</p>
      </VaultProtectedGate>
    );
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onExpandDock).toHaveBeenCalledTimes(1);
    expect(requestVaultDockExpand).not.toHaveBeenCalled();
  });

  it("shows loading fallback while setup status is unknown", () => {
    render(
      <VaultProtectedGate configured={null}>
        <p>Protected content</p>
      </VaultProtectedGate>
    );
    expect(screen.getByText("Checking vault session…")).toBeTruthy();
    expect(screen.queryByText("Protected content")).toBeNull();
  });

  it("redirects to setup when vault is not configured", () => {
    const onRedirectToSetup = vi.fn();
    render(
      <VaultProtectedGate
        configured={false}
        redirectToSetup="/vault/setup"
        onRedirectToSetup={onRedirectToSetup}
      >
        <p>Protected content</p>
      </VaultProtectedGate>
    );
    expect(onRedirectToSetup).toHaveBeenCalledWith("/vault/setup");
    expect(screen.queryByText("Protected content")).toBeNull();
  });
});
