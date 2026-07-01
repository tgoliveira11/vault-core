/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { shouldVaultLockOverlayExpandDock } from "./should-vault-lock-overlay-expand-dock.js";

function keyDownOn(
  target: EventTarget | null,
  overrides: Partial<KeyboardEventInit> = {}
): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
    ...overrides,
  });
}

describe("shouldVaultLockOverlayExpandDock", () => {
  it("returns true for plain Enter", () => {
    const event = keyDownOn(document.body);
    Object.defineProperty(event, "target", { value: document.body });
    expect(shouldVaultLockOverlayExpandDock(event)).toBe(true);
  });

  it("returns false for modified Enter", () => {
    const event = keyDownOn(document.body, { shiftKey: true });
    Object.defineProperty(event, "target", { value: document.body });
    expect(shouldVaultLockOverlayExpandDock(event)).toBe(false);
  });

  it("returns false when focus is in an input", () => {
    const input = document.createElement("input");
    const event = keyDownOn(input);
    Object.defineProperty(event, "target", { value: input });
    expect(shouldVaultLockOverlayExpandDock(event)).toBe(false);
  });

  it("returns false when focus is in a textarea", () => {
    const textarea = document.createElement("textarea");
    const event = keyDownOn(textarea);
    Object.defineProperty(event, "target", { value: textarea });
    expect(shouldVaultLockOverlayExpandDock(event)).toBe(false);
  });

  it("returns false for contenteditable targets", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const event = keyDownOn(editable);
    Object.defineProperty(event, "target", { value: editable });
    expect(shouldVaultLockOverlayExpandDock(event)).toBe(false);
  });
});
