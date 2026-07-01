import type { VaultAdminConfig } from "../admin/types.js";
import { createFixedWindowRateLimiter, type FixedWindowRateLimiter } from "./fixed-window.js";
import type { RateLimitDecision } from "./types.js";

export type VaultApiRateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

export const DEFAULT_VAULT_API_RATE_LIMIT: VaultApiRateLimitConfig = {
  maxRequests: 120,
  windowMs: 60 * 1000,
};

export type VaultApiRateLimiter = {
  limiter: FixedWindowRateLimiter;
  config: VaultApiRateLimitConfig;
};

export type VaultRateLimitHttpResponse = {
  status: 429;
  headers: { "Retry-After": string };
  body: {
    error: string;
    retryAfterMs: number;
    resetAtMs: number;
  };
};

function buildApiKey(namespace: string, clientKey: string): string {
  return `${namespace}:${clientKey}`;
}

export function createVaultApiRateLimiter(
  config: VaultApiRateLimitConfig = DEFAULT_VAULT_API_RATE_LIMIT
): VaultApiRateLimiter {
  return {
    config,
    limiter: createFixedWindowRateLimiter({
      max: config.maxRequests,
      windowMs: config.windowMs,
    }),
  };
}

export function createVaultApiRateLimiterFromAdminConfig(
  config: VaultAdminConfig
): VaultApiRateLimiter {
  return createVaultApiRateLimiter({
    maxRequests: config.rateLimit.apiMaxRequests,
    windowMs: config.rateLimit.apiWindowSeconds * 1000,
  });
}

export function consumeVaultApiRateLimit(
  rateLimiter: VaultApiRateLimiter,
  namespace: string,
  clientKey: string
): RateLimitDecision {
  return rateLimiter.limiter.consume(buildApiKey(namespace, clientKey));
}

export function buildVaultRateLimitHttpResponse(decision: RateLimitDecision): VaultRateLimitHttpResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  return {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds) },
    body: {
      error: "Too many requests",
      retryAfterMs: decision.retryAfterMs,
      resetAtMs: decision.resetAtMs,
    },
  };
}
