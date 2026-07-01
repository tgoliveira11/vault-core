import {
  buildVaultAdminConfigFromEnv,
  createVaultApiRateLimiterFromAdminConfig,
  createVaultUnlockRateLimiterFromAdminConfig,
} from "@tgoliveira/vault-core";
import { PRF_SALT_PREFIX, VAULT_PROFILE } from "@/lib/vault-profile";

function buildDemoAdminConfig() {
  return buildVaultAdminConfigFromEnv({
    env: process.env,
    profile: VAULT_PROFILE,
    prfSaltPrefix: PRF_SALT_PREFIX,
    productName: process.env.APP_NAME ?? "Vault Core Demo",
  });
}

let unlockRateLimiter: ReturnType<typeof createVaultUnlockRateLimiterFromAdminConfig> | null =
  null;
let apiRateLimiter: ReturnType<typeof createVaultApiRateLimiterFromAdminConfig> | null = null;

export function getDemoVaultUnlockRateLimiter() {
  if (!unlockRateLimiter) {
    unlockRateLimiter = createVaultUnlockRateLimiterFromAdminConfig(buildDemoAdminConfig());
  }
  return unlockRateLimiter;
}

export function getDemoVaultApiRateLimiter() {
  if (!apiRateLimiter) {
    apiRateLimiter = createVaultApiRateLimiterFromAdminConfig(buildDemoAdminConfig());
  }
  return apiRateLimiter;
}

export function resolveDemoVaultApiClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
