import {
  assertNoVaultPlaintextFields,
  buildVaultAdminConfigFromEnv,
  buildVaultRateLimitHttpResponse,
  consumeVaultApiRateLimit,
  listVaultAdminConfigEntries,
  validateVaultAdminOverride,
} from "@tgoliveira/vault-core";
import { NextResponse } from "next/server";
import { getVaultAdminEnv } from "@/lib/env/vault-from-env";
import {
  deleteVaultAdminOverride,
  loadVaultAdminOverrides,
  setVaultAdminOverride,
} from "@/lib/vault-admin-overrides";
import { PRF_SALT_PREFIX, VAULT_PROFILE } from "@/lib/vault-profile";
import {
  getDemoVaultApiRateLimiter,
  resolveDemoVaultApiClientKey,
} from "@/lib/vault-rate-limit";

function enforceDemoVaultApiRateLimit(request: Request) {
  const decision = consumeVaultApiRateLimit(
    getDemoVaultApiRateLimiter(),
    "vault-admin-config",
    resolveDemoVaultApiClientKey(request)
  );
  if (decision.allowed) return null;
  const limited = buildVaultRateLimitHttpResponse(decision);
  return NextResponse.json(limited.body, {
    status: limited.status,
    headers: limited.headers,
  });
}

async function buildResolvedConfig() {
  const adminOverrides = await loadVaultAdminOverrides();
  return buildVaultAdminConfigFromEnv({
    env: process.env,
    profile: VAULT_PROFILE,
    prfSaltPrefix: PRF_SALT_PREFIX,
    productName: process.env.APP_NAME ?? "Vault Core Demo",
    adminOverrides,
  });
}

export async function GET(request: Request) {
  try {
    const rateLimited = enforceDemoVaultApiRateLimit(request);
    if (rateLimited) return rateLimited;

    const adminOverrides = await loadVaultAdminOverrides();
    const config = await buildResolvedConfig();
    const env = getVaultAdminEnv();
    return NextResponse.json({
      entries: listVaultAdminConfigEntries(config, env, adminOverrides),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rateLimited = enforceDemoVaultApiRateLimit(request);
    if (rateLimited) return rateLimited;

    const body = (await request.json()) as { key?: string; value?: unknown };
    assertNoVaultPlaintextFields(body);
    if (!body.key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }
    validateVaultAdminOverride(body.key, body.value);
    await setVaultAdminOverride(body.key, body.value);

    const adminOverrides = await loadVaultAdminOverrides();
    const config = await buildResolvedConfig();
    const env = getVaultAdminEnv();
    return NextResponse.json({
      entries: listVaultAdminConfigEntries(config, env, adminOverrides),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save override";
    const status = /not overridable|must be|Plaintext field/i.test(message) ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const rateLimited = enforceDemoVaultApiRateLimit(request);
    if (rateLimited) return rateLimited;

    const body = (await request.json()) as { key?: string };
    assertNoVaultPlaintextFields(body);
    if (!body.key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }
    await deleteVaultAdminOverride(body.key);

    const adminOverrides = await loadVaultAdminOverrides();
    const config = await buildResolvedConfig();
    const env = getVaultAdminEnv();
    return NextResponse.json({
      entries: listVaultAdminConfigEntries(config, env, adminOverrides),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete override";
    const status = /not overridable|must be|Plaintext field/i.test(message) ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
