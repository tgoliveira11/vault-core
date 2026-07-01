/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVaultLockOverlayPanels } from "./use-vault-lock-overlay-panels.js";

describe("useVaultLockOverlayPanels", () => {
  afterEach(() => cleanup());

  it("returns an empty list when inactive", () => {
    const { result } = renderHook(() => useVaultLockOverlayPanels(false));
    expect(result.current).toEqual([]);
  });

  it("returns a full viewport panel when active without exclusions", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });

    const { result } = renderHook(() => useVaultLockOverlayPanels(true));
    expect(result.current).toEqual([{ top: 0, left: 0, width: 1024, height: 768 }]);
  });

  it("updates panels when exclusions resize", () => {
    const element = document.createElement("div");
    element.setAttribute("data-vault-lock-overlay-exclude", "true");
    document.body.appendChild(element);

    const rectSpy = vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      top: 0,
      left: 0,
      right: 800,
      bottom: 64,
      width: 800,
      height: 64,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });

    const { result } = renderHook(() => useVaultLockOverlayPanels(true));
    expect(result.current).toEqual([{ top: 64, left: 0, width: 800, height: 536 }]);

    rectSpy.mockRestore();
    element.remove();
  });

  it("recomputes panels on window resize", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });

    const { result } = renderHook(() => useVaultLockOverlayPanels(true));

    act(() => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 640 });
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toEqual([{ top: 0, left: 0, width: 640, height: 600 }]);
  });

  it("observes exclusion elements with ResizeObserver when available", () => {
    let observerCallback: ResizeObserverCallback | null = null;
    const observe = vi.fn();
    const disconnect = vi.fn();
    class MockResizeObserver {
      observe = observe;
      disconnect = disconnect;
      constructor(callback: ResizeObserverCallback) {
        observerCallback = callback;
      }
    }

    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    const element = document.createElement("div");
    element.setAttribute("data-vault-lock-overlay-exclude", "true");
    document.body.appendChild(element);

    const rectSpy = vi
      .spyOn(element, "getBoundingClientRect")
      .mockReturnValue({
        top: 0,
        left: 0,
        right: 800,
        bottom: 64,
        width: 800,
        height: 64,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });

    const { result } = renderHook(() => useVaultLockOverlayPanels(true));
    expect(result.current).toEqual([{ top: 64, left: 0, width: 800, height: 536 }]);

    rectSpy.mockReturnValue({
      top: 0,
      left: 0,
      right: 800,
      bottom: 96,
      width: 800,
      height: 96,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    act(() => {
      observerCallback?.([], {} as ResizeObserver);
    });

    expect(result.current).toEqual([{ top: 96, left: 0, width: 800, height: 504 }]);

    rectSpy.mockRestore();
    element.remove();
    vi.unstubAllGlobals();
  });

  it("works when ResizeObserver is unavailable", () => {
    const original = globalThis.ResizeObserver;
    // @ts-expect-error test override
    delete globalThis.ResizeObserver;

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });

    const { result } = renderHook(() => useVaultLockOverlayPanels(true));
    expect(result.current).toEqual([{ top: 0, left: 0, width: 1024, height: 768 }]);

    globalThis.ResizeObserver = original;
  });

  it("removes listeners on unmount", () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useVaultLockOverlayPanels(true));
    unmount();
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function), true);
    removeListener.mockRestore();
  });

  it("clears panels when deactivated", () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useVaultLockOverlayPanels(active),
      { initialProps: { active: true } }
    );

    expect(result.current.length).toBeGreaterThan(0);

    act(() => {
      rerender({ active: false });
    });

    expect(result.current).toEqual([]);
  });
});
