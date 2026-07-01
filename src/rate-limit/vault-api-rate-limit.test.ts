import { describe, expect, it } from "vitest";
import { buildVaultAdminConfigFromEnv } from "../admin/resolve-config.js";
import {
  buildVaultRateLimitHttpResponse,
  consumeVaultApiRateLimit,
  createVaultApiRateLimiter,
  createVaultApiRateLimiterFromAdminConfig,
} from "./vault-api-rate-limit.js";

describe("vault API rate limit", () => {
  it("consumes requests per namespace and client key", () => {
    const limiter = createVaultApiRateLimiter({ maxRequests: 2, windowMs: 60_000 });

    expect(consumeVaultApiRateLimit(limiter, "admin-config", "ip-1").allowed).toBe(true);
    expect(consumeVaultApiRateLimit(limiter, "admin-config", "ip-1").allowed).toBe(true);
    const blocked = consumeVaultApiRateLimit(limiter, "admin-config", "ip-1");
    expect(blocked.allowed).toBe(false);
    expect(consumeVaultApiRateLimit(limiter, "admin-config", "ip-2").allowed).toBe(true);
  });

  it("builds HTTP 429 response with Retry-After", () => {
    const response = buildVaultRateLimitHttpResponse({
      allowed: false,
      remaining: 0,
      resetAtMs: 5_000,
      retryAfterMs: 2_500,
      lockedOut: false,
    });

    expect(response.status).toBe(429);
    expect(response.headers["Retry-After"]).toBe("3");
    expect(response.body.error).toBe("Too many requests");
    expect(response.body.retryAfterMs).toBe(2_500);
  });

  it("builds limiter from admin config", () => {
    const config = buildVaultAdminConfigFromEnv({
      env: {
        VAULT_API_RATE_LIMIT_MAX_REQUESTS: "80",
        VAULT_API_RATE_LIMIT_WINDOW_SECONDS: "30",
      },
    });
    const limiter = createVaultApiRateLimiterFromAdminConfig(config);
    expect(limiter.config.maxRequests).toBe(80);
    expect(limiter.config.windowMs).toBe(30_000);
  });
});
