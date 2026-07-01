import { describe, expect, it } from "vitest";
import { VaultRateLimitError } from "../errors/vault-errors.js";
import { buildVaultAdminConfigFromEnv } from "../admin/resolve-config.js";
import {
  assertVaultUnlockAllowed,
  createVaultUnlockRateLimiter,
  createVaultUnlockRateLimiterFromAdminConfig,
  recordVaultUnlockFailure,
  recordVaultUnlockSuccess,
  withVaultUnlockRateLimit,
} from "./vault-unlock-rate-limit.js";

describe("vault unlock rate limit", () => {
  it("blocks after max failures and clears on success", () => {
    const limiter = createVaultUnlockRateLimiter({
      maxFailures: 2,
      failureWindowMs: 60_000,
      lockoutMs: 30_000,
    });

    assertVaultUnlockAllowed(limiter, "user-1", "password");
    recordVaultUnlockFailure(limiter, "user-1", "password");
    recordVaultUnlockFailure(limiter, "user-1", "password");

    expect(() => assertVaultUnlockAllowed(limiter, "user-1", "password")).toThrow(
      VaultRateLimitError
    );

    recordVaultUnlockSuccess(limiter, "user-1", "password");
    expect(() => assertVaultUnlockAllowed(limiter, "user-1", "password")).not.toThrow();
  });

  it("scopes limits per action", () => {
    const limiter = createVaultUnlockRateLimiter({
      maxFailures: 1,
      failureWindowMs: 60_000,
      lockoutMs: 30_000,
    });

    recordVaultUnlockFailure(limiter, "user-1", "password");
    expect(() => assertVaultUnlockAllowed(limiter, "user-1", "password")).toThrow();
    expect(() => assertVaultUnlockAllowed(limiter, "user-1", "recovery_phrase")).not.toThrow();
  });

  it("wraps unlock attempts with withVaultUnlockRateLimit", async () => {
    const limiter = createVaultUnlockRateLimiter({
      maxFailures: 1,
      failureWindowMs: 60_000,
      lockoutMs: 30_000,
    });

    await expect(
      withVaultUnlockRateLimit(limiter, "user-1", "password", async () => {
        throw new Error("bad password");
      })
    ).rejects.toThrow("bad password");

    await expect(
      withVaultUnlockRateLimit(limiter, "user-1", "password", async () => "ok")
    ).rejects.toThrow(VaultRateLimitError);
  });

  it("records success with withVaultUnlockRateLimit", async () => {
    const limiter = createVaultUnlockRateLimiter({
      maxFailures: 2,
      failureWindowMs: 60_000,
      lockoutMs: 30_000,
    });

    await expect(
      withVaultUnlockRateLimit(limiter, "user-1", "password", async () => {
        throw new Error("bad password");
      })
    ).rejects.toThrow("bad password");

    await expect(
      withVaultUnlockRateLimit(limiter, "user-1", "password", async () => "ok")
    ).resolves.toBe("ok");
  });

  it("formats retry messages for seconds and minutes", () => {
    const minuteLimiter = createVaultUnlockRateLimiter({
      maxFailures: 1,
      failureWindowMs: 60_000,
      lockoutMs: 90_000,
    });
    recordVaultUnlockFailure(minuteLimiter, "user-1", "password");

    try {
      assertVaultUnlockAllowed(minuteLimiter, "user-1", "password");
    } catch (error) {
      expect((error as VaultRateLimitError).message).toMatch(/minute/);
    }

    const shortLockout = createVaultUnlockRateLimiter({
      maxFailures: 1,
      failureWindowMs: 60_000,
      lockoutMs: 5_000,
    });
    recordVaultUnlockFailure(shortLockout, "user-2", "password");
    try {
      assertVaultUnlockAllowed(shortLockout, "user-2", "password");
    } catch (error) {
      expect((error as VaultRateLimitError).message).toMatch(/second/);
    }
  });

  it("does not record failure when attempt throws VaultRateLimitError", async () => {
    const limiter = createVaultUnlockRateLimiter({
      maxFailures: 2,
      failureWindowMs: 60_000,
      lockoutMs: 30_000,
    });

    await expect(
      withVaultUnlockRateLimit(limiter, "user-1", "password", async () => {
        throw new VaultRateLimitError("limited", 1_000, 2_000);
      })
    ).rejects.toThrow(VaultRateLimitError);

    expect(() => assertVaultUnlockAllowed(limiter, "user-1", "password")).not.toThrow();
  });

  it("builds limiter from admin config", () => {
    const config = buildVaultAdminConfigFromEnv({
      env: {
        VAULT_UNLOCK_MAX_FAILURES: "3",
        VAULT_UNLOCK_FAILURE_WINDOW_MINUTES: "10",
        VAULT_UNLOCK_LOCKOUT_MINUTES: "20",
      },
    });
    const limiter = createVaultUnlockRateLimiterFromAdminConfig(config);
    expect(limiter.config.maxFailures).toBe(3);
    expect(limiter.config.failureWindowMs).toBe(10 * 60 * 1000);
    expect(limiter.config.lockoutMs).toBe(20 * 60 * 1000);
  });
});
