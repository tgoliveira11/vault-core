import { describe, expect, it, vi } from "vitest";
import { createFixedWindowRateLimiter } from "./fixed-window.js";

describe("createFixedWindowRateLimiter", () => {
  it("allows requests within the window limit", () => {
    let now = 1_000;
    const limiter = createFixedWindowRateLimiter(
      { max: 3, windowMs: 60_000 },
      { now: () => now }
    );

    expect(limiter.check("client").allowed).toBe(true);
    expect(limiter.consume("client").allowed).toBe(true);
    expect(limiter.consume("client").allowed).toBe(true);
    expect(limiter.consume("client").allowed).toBe(true);
    expect(limiter.consume("client").allowed).toBe(false);
    expect(limiter.check("client").remaining).toBe(0);
  });

  it("resets the window after it expires", () => {
    let now = 0;
    const limiter = createFixedWindowRateLimiter(
      { max: 2, windowMs: 1_000 },
      { now: () => now }
    );

    limiter.consume("client");
    limiter.consume("client");
    expect(limiter.check("client").allowed).toBe(false);

    now = 1_001;
    expect(limiter.check("client").allowed).toBe(true);
    expect(limiter.consume("client").allowed).toBe(true);
  });

  it("applies lockout after max is exceeded", () => {
    let now = 0;
    const limiter = createFixedWindowRateLimiter(
      { max: 2, windowMs: 10_000, lockoutMs: 5_000 },
      { now: () => now }
    );

    expect(limiter.consume("client").allowed).toBe(true);
    expect(limiter.consume("client").allowed).toBe(true);
    const blocked = limiter.check("client");
    expect(blocked.allowed).toBe(false);
    expect(blocked.lockedOut).toBe(true);

    now = 3_000;
    expect(limiter.check("client").allowed).toBe(false);
    expect(limiter.check("client").lockedOut).toBe(true);

    now = 5_001;
    expect(limiter.check("client").allowed).toBe(true);
  });

  it("clears a key with reset", () => {
    const limiter = createFixedWindowRateLimiter({ max: 1, windowMs: 60_000 });
    limiter.consume("client");
    expect(limiter.check("client").allowed).toBe(false);
    limiter.reset("client");
    expect(limiter.check("client").allowed).toBe(true);
  });

  it("prunes expired empty buckets lazily", () => {
    let now = 0;
    const limiter = createFixedWindowRateLimiter(
      { max: 1, windowMs: 1_000 },
      { now: () => now }
    );

    limiter.consume("ephemeral");
    now = 2_000;
    expect(limiter.check("fresh").allowed).toBe(true);
  });

  it("evicts the oldest bucket when maxBuckets is reached", () => {
    let now = 0;
    const limiter = createFixedWindowRateLimiter(
      { max: 5, windowMs: 60_000, maxBuckets: 2 },
      { now: () => now }
    );

    limiter.consume("first");
    now = 1_000;
    limiter.consume("second");
    now = 2_000;
    limiter.consume("third");

    expect(limiter.check("first").allowed).toBe(true);
    expect(limiter.check("second").allowed).toBe(true);
    expect(limiter.check("third").allowed).toBe(true);
  });

  it("isolates keys", () => {
    const limiter = createFixedWindowRateLimiter({ max: 1, windowMs: 60_000 });
    limiter.consume("a");
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });
});
