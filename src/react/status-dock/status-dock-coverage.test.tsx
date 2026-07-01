/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDefaultVaultStatusDockExpanded,
  getVaultStatusDockExpandedCopy,
  getVaultStatusDockHandleLabel,
  vaultStatusDockAutoCollapseWhenExpanded,
} from "./copy.js";
import { requestVaultDockExpand, subscribeVaultDockExpand } from "./events.js";
import {
  VaultStatusIcon,
  VaultStatusIconError,
  VaultStatusIconLocked,
  VaultStatusIconNotSetup,
  VaultStatusIconUnlocked,
  VaultStatusDockChevron,
  VaultStatusDockLockIcon,
} from "./icons.js";
import {
  readVaultStatusDockCollapsedPreference,
  writeVaultStatusDockCollapsedPreference,
} from "./preference.js";
import { useVaultDockDismiss } from "./use-vault-dock-dismiss.js";

describe("status dock utilities", () => {
  afterEach(() => cleanup());

  it("covers expanded copy for error status", () => {
    expect(getVaultStatusDockExpandedCopy("error", null).title).toBe(
      "Vault status unavailable"
    );
  });

  it("covers resolveExpanded branches via copy helpers", () => {
    expect(getDefaultVaultStatusDockExpanded("locked")).toBe(false);
    expect(vaultStatusDockAutoCollapseWhenExpanded("unsupported_prf")).toBe(false);
    expect(getVaultStatusDockHandleLabel("unsupported_prf", null)).toBe("Vault");
  });

  it("renders all vault status icons", () => {
    render(<VaultStatusIconNotSetup />);
    render(<VaultStatusIconError />);
    render(<VaultStatusIconLocked />);
    render(<VaultStatusIconUnlocked />);
    render(<VaultStatusIcon status="not_setup" />);
    render(<VaultStatusIcon status="error" />);
    render(<VaultStatusIcon status="locked" />);
    render(<VaultStatusIcon status="unlocked" />);
    render(<VaultStatusIcon status="unsupported_prf" />);
    render(<VaultStatusDockChevron expanded />);
    render(<VaultStatusDockChevron expanded={false} />);
    render(<VaultStatusDockLockIcon />);
  });

  it("subscribes and unsubscribes expand events", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeVaultDockExpand(listener);
    requestVaultDockExpand();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    requestVaultDockExpand();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("no-ops expand events when window is unavailable", () => {
    const original = globalThis.window;
    // @ts-expect-error test stub
    delete globalThis.window;
    expect(requestVaultDockExpand()).toBeUndefined();
    const unsubscribe = subscribeVaultDockExpand(() => {});
    expect(unsubscribe()).toBeUndefined();
    globalThis.window = original;
  });

  it("returns null preference when window or storage is unavailable", () => {
    const original = globalThis.window;
    // @ts-expect-error test stub
    delete globalThis.window;
    expect(readVaultStatusDockCollapsedPreference("x")).toBeNull();
    expect(writeVaultStatusDockCollapsedPreference(true, "x")).toBeUndefined();
    globalThis.window = original;

    vi.stubGlobal("localStorage", { getItem: undefined, setItem: undefined });
    expect(readVaultStatusDockCollapsedPreference("x")).toBeNull();
    expect(writeVaultStatusDockCollapsedPreference(true, "x")).toBeUndefined();
  });

  it("returns null preference when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readVaultStatusDockCollapsedPreference("x")).toBeNull();
    expect(writeVaultStatusDockCollapsedPreference(true, "x")).toBeUndefined();
  });

  it("dismisses on outside click and escape", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const root = document.createElement("div");
    const panel = document.createElement("div");
    const handle = document.createElement("button");
    const outside = document.createElement("button");
    root.append(panel, handle);
    document.body.append(root, outside);

    const rootRef = { current: root };

    renderHook(() =>
      useVaultDockDismiss({
        rootRef,
        enabled: true,
        shouldPreventDismiss: () => false,
        onDismiss,
      })
    );

    fireEvent.mouseDown(outside);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(panel);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(handle);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(2);

    root.remove();
    outside.remove();
    vi.useRealTimers();
  });

  it("does not dismiss on outside mousedown while focus stays inside dock", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const root = document.createElement("div");
    const inner = document.createElement("input");
    const overlay = document.createElement("div");
    root.append(inner);
    document.body.append(root, overlay);

    renderHook(() =>
      useVaultDockDismiss({
        rootRef: { current: root },
        enabled: true,
        shouldPreventDismiss: () => false,
        onDismiss,
      })
    );

    inner.focus();
    fireEvent.mouseDown(overlay);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    root.remove();
    overlay.remove();
    vi.useRealTimers();
  });

  it("skips deferred dismiss when prevent flips before the outside-click timer", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    let prevent = false;
    const root = document.createElement("div");
    document.body.append(root);

    const { rerender } = renderHook(() =>
      useVaultDockDismiss({
        rootRef: { current: root },
        enabled: true,
        shouldPreventDismiss: () => prevent,
        onDismiss,
      })
    );

    fireEvent.mouseDown(document.body);
    prevent = true;
    rerender();
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    root.remove();
    vi.useRealTimers();
  });

  it("clears pending outside-click timer on unmount", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const root = document.createElement("div");
    document.body.append(root);

    const { unmount } = renderHook(() =>
      useVaultDockDismiss({
        rootRef: { current: root },
        enabled: true,
        shouldPreventDismiss: () => false,
        onDismiss,
      })
    );

    fireEvent.mouseDown(document.body);
    unmount();
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    root.remove();
    vi.useRealTimers();
  });

  it("dismisses on outside mousedown with non-node event target", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const root = document.createElement("div");
    document.body.append(root);

    renderHook(() =>
      useVaultDockDismiss({
        rootRef: { current: root },
        enabled: true,
        shouldPreventDismiss: () => false,
        onDismiss,
      })
    );

    const event = new MouseEvent("mousedown", { bubbles: true });
    Object.defineProperty(event, "target", { value: {} });
    document.dispatchEvent(event);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    root.remove();
    vi.useRealTimers();
  });

  it("does not dismiss when prevented or disabled", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const rootRef = { current: document.createElement("div") };

    const { rerender } = renderHook(
      ({ enabled, prevent }) =>
        useVaultDockDismiss({
          rootRef,
          enabled,
          shouldPreventDismiss: () => prevent,
          onDismiss,
        }),
      { initialProps: { enabled: false, prevent: false } }
    );

    fireEvent.mouseDown(document.body);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    rerender({ enabled: true, prevent: true });
    fireEvent.mouseDown(document.body);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

});
