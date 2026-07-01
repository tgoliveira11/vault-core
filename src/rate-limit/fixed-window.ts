import {
  DEFAULT_RATE_LIMIT_MAX_BUCKETS,
  type FixedWindowRateLimitConfig,
  type RateLimitDecision,
} from "./types.js";

type BucketState = {
  windowStartMs: number;
  count: number;
  lockedOutUntilMs: number | null;
};

export type FixedWindowRateLimiter = {
  check: (key: string) => RateLimitDecision;
  consume: (key: string) => RateLimitDecision;
  reset: (key: string) => void;
};

export type CreateFixedWindowRateLimiterOptions = {
  now?: () => number;
};

export { DEFAULT_RATE_LIMIT_MAX_BUCKETS };

function buildDecision(
  bucket: BucketState,
  config: FixedWindowRateLimitConfig,
  now: number
): RateLimitDecision {
  if (bucket.lockedOutUntilMs != null && now < bucket.lockedOutUntilMs) {
    return {
      allowed: false,
      remaining: 0,
      resetAtMs: bucket.lockedOutUntilMs,
      retryAfterMs: bucket.lockedOutUntilMs - now,
      lockedOut: true,
    };
  }

  const windowEndMs = bucket.windowStartMs + config.windowMs;
  const remaining = Math.max(0, config.max - bucket.count);
  const allowed = bucket.count < config.max;

  return {
    allowed,
    remaining: allowed ? remaining : 0,
    resetAtMs: windowEndMs,
    retryAfterMs: allowed ? 0 : windowEndMs - now,
    lockedOut: false,
  };
}

function refreshBucketIfExpired(bucket: BucketState, config: FixedWindowRateLimitConfig, now: number): void {
  if (bucket.lockedOutUntilMs != null && now >= bucket.lockedOutUntilMs) {
    bucket.lockedOutUntilMs = null;
    bucket.windowStartMs = now;
    bucket.count = 0;
    return;
  }

  if (now - bucket.windowStartMs >= config.windowMs) {
    bucket.windowStartMs = now;
    bucket.count = 0;
    bucket.lockedOutUntilMs = null;
  }
}

/**
 * In-memory fixed-window rate limiter with O(1) check/consume, lazy pruning, and a bounded bucket map.
 */
export function createFixedWindowRateLimiter(
  config: FixedWindowRateLimitConfig,
  options: CreateFixedWindowRateLimiterOptions = {}
): FixedWindowRateLimiter {
  const nowMs = options.now ?? (() => Date.now());
  const maxBuckets = config.maxBuckets ?? DEFAULT_RATE_LIMIT_MAX_BUCKETS;
  const buckets = new Map<string, BucketState>();

  function pruneExpired(now: number): void {
    for (const [key, bucket] of buckets) {
      const lockoutExpired = bucket.lockedOutUntilMs != null && now >= bucket.lockedOutUntilMs;
      const windowExpired = now - bucket.windowStartMs >= config.windowMs;
      if (lockoutExpired && windowExpired && bucket.count === 0) {
        buckets.delete(key);
      } else if (!bucket.lockedOutUntilMs && windowExpired && bucket.count === 0) {
        buckets.delete(key);
      }
    }
  }

  function evictOldestBucket(): void {
    let oldestKey: string | null = null;
    let oldestStart = Number.POSITIVE_INFINITY;
    for (const [key, bucket] of buckets) {
      if (bucket.windowStartMs < oldestStart) {
        oldestStart = bucket.windowStartMs;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      buckets.delete(oldestKey);
    }
  }

  function getOrCreateBucket(key: string, now: number): BucketState {
    let bucket = buckets.get(key);
    if (!bucket) {
      pruneExpired(now);
      if (buckets.size >= maxBuckets) {
        evictOldestBucket();
      }
      bucket = { windowStartMs: now, count: 0, lockedOutUntilMs: null };
      buckets.set(key, bucket);
      return bucket;
    }
    refreshBucketIfExpired(bucket, config, now);
    return bucket;
  }

  function check(key: string): RateLimitDecision {
    const now = nowMs();
    pruneExpired(now);
    const bucket = getOrCreateBucket(key, now);
    return buildDecision(bucket, config, now);
  }

  function consume(key: string): RateLimitDecision {
    const now = nowMs();
    pruneExpired(now);
    const bucket = getOrCreateBucket(key, now);
    const before = buildDecision(bucket, config, now);
    if (!before.allowed) {
      return before;
    }

    bucket.count += 1;

    if (bucket.count >= config.max && config.lockoutMs != null && config.lockoutMs > 0) {
      bucket.lockedOutUntilMs = now + config.lockoutMs;
    }

    const after = buildDecision(bucket, config, now);
    return { ...after, allowed: true };
  }

  function reset(key: string): void {
    buckets.delete(key);
  }

  return { check, consume, reset };
}
