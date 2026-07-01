export const DEFAULT_RATE_LIMIT_MAX_BUCKETS = 10_000;

export type FixedWindowRateLimitConfig = {
  max: number;
  windowMs: number;
  lockoutMs?: number;
  /** Maximum tracked keys before evicting the oldest bucket. Defaults to 10_000. */
  maxBuckets?: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
  retryAfterMs: number;
  lockedOut: boolean;
};
