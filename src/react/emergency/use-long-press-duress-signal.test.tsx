/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPressDuressSignal } from "../../react/emergency/use-long-press-duress-signal.js";

function Probe({ thresholdMs }: { thresholdMs?: number }) {
  const signal = useLongPressDuressSignal({ thresholdMs });
  return (
    <button
      type="button"
      data-testid="target"
      data-signaled={signal.duressSignaled ? "true" : "false"}
      onPointerDown={signal.onPointerDown}
      onPointerUp={signal.onPointerUp}
      onPointerLeave={signal.onPointerLeave}
      onPointerCancel={signal.onPointerCancel}
    >
      press
    </button>
  );
}

describe("useLongPressDuressSignal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("latches after threshold duration", () => {
    const { getByTestId } = render(<Probe thresholdMs={1000} />);
    const target = getByTestId("target");

    act(() => {
      fireEvent.pointerDown(target);
    });

    expect(target.getAttribute("data-signaled")).toBe("false");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(target.getAttribute("data-signaled")).toBe("true");
  });

  it("does not latch on short press", () => {
    const { getByTestId } = render(<Probe thresholdMs={1000} />);
    const target = getByTestId("target");

    act(() => {
      fireEvent.pointerDown(target);
      vi.advanceTimersByTime(200);
      fireEvent.pointerUp(target);
    });

    expect(target.getAttribute("data-signaled")).toBe("false");
  });

  it("cancels on pointer leave", () => {
    const { getByTestId } = render(<Probe thresholdMs={500} />);
    const target = getByTestId("target");

    act(() => {
      fireEvent.pointerDown(target);
      vi.advanceTimersByTime(200);
      fireEvent.pointerLeave(target);
      vi.advanceTimersByTime(500);
    });

    expect(target.getAttribute("data-signaled")).toBe("false");
  });

  it("supports disabled mode", () => {
    function DisabledProbe() {
      const signal = useLongPressDuressSignal({ disabled: true });
      return (
        <button
          type="button"
          data-testid="target"
          data-signaled={signal.duressSignaled ? "true" : "false"}
          onPointerDown={signal.onPointerDown}
        >
          press
        </button>
      );
    }

    const { getByTestId } = render(<DisabledProbe />);
    const target = getByTestId("target");

    act(() => {
      fireEvent.pointerDown(target);
      vi.advanceTimersByTime(2000);
    });

    expect(target.getAttribute("data-signaled")).toBe("false");
  });

  it("cancels on pointer cancel", () => {
    const { getByTestId } = render(<Probe thresholdMs={1000} />);
    const target = getByTestId("target");

    act(() => {
      fireEvent.pointerDown(target);
      fireEvent.pointerCancel(target);
      vi.advanceTimersByTime(1500);
    });

    expect(target.getAttribute("data-signaled")).toBe("false");
  });

  it("ignores non-primary mouse button", () => {
    const { getByTestId } = render(<Probe thresholdMs={500} />);
    const target = getByTestId("target");

    act(() => {
      fireEvent.pointerDown(target, { button: 2, pointerType: "mouse" });
      vi.advanceTimersByTime(600);
    });

    expect(target.getAttribute("data-signaled")).toBe("false");
  });
});
