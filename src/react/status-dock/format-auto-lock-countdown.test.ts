import { describe, expect, it } from "vitest";
import { formatAutoLockCountdown } from "./format-auto-lock-countdown.js";

describe("formatAutoLockCountdown", () => {
  it("formats remaining milliseconds as M:SS", () => {
    expect(formatAutoLockCountdown(14 * 60 * 1000 + 32 * 1000)).toBe("14:32");
    expect(formatAutoLockCountdown(65_000)).toBe("1:05");
    expect(formatAutoLockCountdown(500)).toBe("0:01");
    expect(formatAutoLockCountdown(0)).toBe("0:00");
  });
});
