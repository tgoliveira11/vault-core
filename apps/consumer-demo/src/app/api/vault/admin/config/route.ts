import {
  buildVaultAdminConfigFromEnv,
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

export async function GET() {
  try {
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
    const body = (await request.json()) as { key?: string; value?: unknown };
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
    const status = /not overridable|must be/i.test(message) ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { key?: string };
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
