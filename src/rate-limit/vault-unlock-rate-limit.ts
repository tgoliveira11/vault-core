import { VaultRateLimitError } from "../errors/vault-errors.js";
import type { VaultAdminConfig } from "../admin/types.js";
import { createFixedWindowRateLimiter, type FixedWindowRateLimiter } from "./fixed-window.js";

export type VaultUnlockRateLimitConfig = {
  maxFailures: number;
  failureWindowMs: number;
  lockoutMs: number;
};

export const DEFAULT_VAULT_UNLOCK_RATE_LIMIT: VaultUnlockRateLimitConfig = {
  maxFailures: 5,
  failureWindowMs: 15 * 60 * 1000,
  lockoutMs: 30 * 60 * 1000,
};

export type VaultUnlockRateLimitAction = "password" | "recovery_phrase" | "passkey_prf";

export type VaultUnlockRateLimiter = {
  limiter: FixedWindowRateLimiter;
  config: VaultUnlockRateLimitConfig;
};

function buildUnlockKey(scopeKey: string, action: VaultUnlockRateLimitAction): string {
  return `${scopeKey}:${action}`;
}

function formatUnlockRateLimitMessage(retryAfterMs: number): string {
  const totalSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  if (totalSeconds < 60) {
    return `Too many failed unlock attempts. Try again in ${totalSeconds} second${totalSeconds === 1 ? "" : "s"}.`;
  }
  const minutes = Math.ceil(totalSeconds / 60);
  return `Too many failed unlock attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export function createVaultUnlockRateLimiter(
  config: VaultUnlockRateLimitConfig = DEFAULT_VAULT_UNLOCK_RATE_LIMIT
): VaultUnlockRateLimiter {
  return {
    config,
    limiter: createFixedWindowRateLimiter({
      max: config.maxFailures,
      windowMs: config.failureWindowMs,
      lockoutMs: config.lockoutMs,
    }),
  };
}

export function createVaultUnlockRateLimiterFromAdminConfig(
  config: VaultAdminConfig
): VaultUnlockRateLimiter {
  return createVaultUnlockRateLimiter({
    maxFailures: config.rateLimit.unlockMaxFailures,
    failureWindowMs: config.rateLimit.unlockFailureWindowMinutes * 60 * 1000,
    lockoutMs: config.rateLimit.unlockLockoutMinutes * 60 * 1000,
  });
}

export function assertVaultUnlockAllowed(
  rateLimiter: VaultUnlockRateLimiter,
  scopeKey: string,
  action: VaultUnlockRateLimitAction
): void {
  const decision = rateLimiter.limiter.check(buildUnlockKey(scopeKey, action));
  if (decision.allowed) return;

  throw new VaultRateLimitError(
    formatUnlockRateLimitMessage(decision.retryAfterMs),
    decision.retryAfterMs,
    decision.resetAtMs
  );
}

export function recordVaultUnlockFailure(
  rateLimiter: VaultUnlockRateLimiter,
  scopeKey: string,
  action: VaultUnlockRateLimitAction
): void {
  rateLimiter.limiter.consume(buildUnlockKey(scopeKey, action));
}

export function recordVaultUnlockSuccess(
  rateLimiter: VaultUnlockRateLimiter,
  scopeKey: string,
  action: VaultUnlockRateLimitAction
): void {
  rateLimiter.limiter.reset(buildUnlockKey(scopeKey, action));
}

export async function withVaultUnlockRateLimit<T>(
  rateLimiter: VaultUnlockRateLimiter,
  scopeKey: string,
  action: VaultUnlockRateLimitAction,
  attempt: () => Promise<T>
): Promise<T> {
  assertVaultUnlockAllowed(rateLimiter, scopeKey, action);
  try {
    const result = await attempt();
    recordVaultUnlockSuccess(rateLimiter, scopeKey, action);
    return result;
  } catch (error) {
    if (!(error instanceof VaultRateLimitError)) {
      recordVaultUnlockFailure(rateLimiter, scopeKey, action);
    }
    throw error;
  }
}
