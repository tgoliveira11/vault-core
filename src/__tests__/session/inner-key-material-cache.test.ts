import { describe, expect, it } from "vitest";
import {
  createPasswordEnvelope,
  createUserVaultKey,
  deriveVaultPasswordKeyPairFromMetadata,
  extractInnerVaultKeyBlob,
  importUserVaultKey,
  unlockWithPasswordEnvelope,
  VaultAuthorizationError,
  assertInnerVaultKeyBlobMatchesVaultKey,
} from "../../index.js";
import {
  cacheVaultInnerKeyMaterialFromEnvelopeDecrypt,
  cacheVaultInnerKeyMaterialFromPasskeyEnvelope,
  clearVaultInnerKeyMaterialCache,
  getCachedVaultInnerKeyMaterial,
  INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE,
  resolveInnerVaultKeyBlobForWrap,
} from "../../session/inner-key-material-cache.js";
import {
  FIXTURE_ARGON2_SALT,
  FIXTURE_PRF_OUTPUT,
  FIXTURE_UVK_BYTES,
  FIXTURE_VAULT_PASSWORD,
  LIQSENSE_COMPAT_PROFILE,
  LIQSENSE_COMPAT_SCOPE,
} from "../../testing/fixtures/liqsense-compat.js";
import { createPasskeyPrfEnvelope } from "../../index.js";
import { importAesKwKey } from "../../crypto/user-vault-key-crypto.js";

const LONG_PRF_OUTPUT = new Uint8Array(48);
LONG_PRF_OUTPUT.set(FIXTURE_PRF_OUTPUT);

describe("inner-key-material-cache", () => {
  it("stores and retrieves inner material in memory only", async () => {
    clearVaultInnerKeyMaterialCache();
    const vaultKey = await createUserVaultKey();
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const keys = await deriveVaultPasswordKeyPairFromMetadata(
      FIXTURE_VAULT_PASSWORD,
      envelope.kdfMetadata
    );
    const inner = await extractInnerVaultKeyBlob(
      envelope.encryptedVaultKey,
      keys.encryptionKey
    );

    await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
      inner,
      keys.wrappingKey,
      vaultKey
    );
    const cached = getCachedVaultInnerKeyMaterial();
    expect(cached?.inner).toEqual(inner);
    expect(cached?.wrappingKey).toBe(keys.wrappingKey);

    clearVaultInnerKeyMaterialCache();
    expect(getCachedVaultInnerKeyMaterial()).toBeNull();
  });

  it("resolveInnerVaultKeyBlobForWrap returns cached inner when valid", async () => {
    const vaultKey = await createUserVaultKey();
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const unlocked = await unlockWithPasswordEnvelope(
      FIXTURE_VAULT_PASSWORD,
      envelope,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    const keys = await deriveVaultPasswordKeyPairFromMetadata(
      FIXTURE_VAULT_PASSWORD,
      envelope.kdfMetadata
    );
    const inner = await extractInnerVaultKeyBlob(
      envelope.encryptedVaultKey,
      keys.encryptionKey
    );
    await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
      inner,
      keys.wrappingKey,
      unlocked
    );

    const resolved = await resolveInnerVaultKeyBlobForWrap(unlocked);
    expect(resolved?.innerVaultKeyBlob).toEqual(inner);
  });

  it("rejects cache population when inner does not match session key", async () => {
    const vaultKey = await createUserVaultKey();
    const otherKey = await createUserVaultKey();
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const keys = await deriveVaultPasswordKeyPairFromMetadata(
      FIXTURE_VAULT_PASSWORD,
      envelope.kdfMetadata
    );
    const inner = await extractInnerVaultKeyBlob(
      envelope.encryptedVaultKey,
      keys.encryptionKey
    );

    await expect(
      cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(inner, keys.wrappingKey, otherKey)
    ).rejects.toThrow(VaultAuthorizationError);
  });

  it("exports actionable mismatch message", () => {
    expect(INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE).toContain("Unlock again");
  });

  it("cacheFromPasskeyEnvelope stores inner material", async () => {
    clearVaultInnerKeyMaterialCache();
    const vaultKey = await createUserVaultKey();
    const passkeyEnvelope = await createPasskeyPrfEnvelope(
      vaultKey,
      LONG_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    const prfKey = await crypto.subtle.importKey(
      "raw",
      LONG_PRF_OUTPUT.slice(0, 32),
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    await cacheVaultInnerKeyMaterialFromPasskeyEnvelope(
      passkeyEnvelope.encryptedVaultKey,
      LONG_PRF_OUTPUT,
      prfKey,
      vaultKey
    );
    expect(getCachedVaultInnerKeyMaterial()).not.toBeNull();
  });

  it("cacheFromPasskeyEnvelope accepts 32-byte PRF output", async () => {
    clearVaultInnerKeyMaterialCache();
    const vaultKey = await createUserVaultKey();
    const passkeyEnvelope = await createPasskeyPrfEnvelope(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    const prfKey = await crypto.subtle.importKey(
      "raw",
      FIXTURE_PRF_OUTPUT,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    await cacheVaultInnerKeyMaterialFromPasskeyEnvelope(
      passkeyEnvelope.encryptedVaultKey,
      FIXTURE_PRF_OUTPUT,
      prfKey,
      vaultKey
    );
    expect(getCachedVaultInnerKeyMaterial()).not.toBeNull();
  });

  it("resolveInnerVaultKeyBlobForWrap clears stale cache", async () => {
    const vaultKey = await createUserVaultKey();
    const otherKey = await createUserVaultKey();
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const keys = await deriveVaultPasswordKeyPairFromMetadata(
      FIXTURE_VAULT_PASSWORD,
      envelope.kdfMetadata
    );
    const inner = await extractInnerVaultKeyBlob(
      envelope.encryptedVaultKey,
      keys.encryptionKey
    );
    await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
      inner,
      keys.wrappingKey,
      vaultKey
    );

    await expect(resolveInnerVaultKeyBlobForWrap(otherKey)).rejects.toThrow(
      INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE
    );
    expect(getCachedVaultInnerKeyMaterial()).toBeNull();
  });

  it("resolveInnerVaultKeyBlobForWrap returns options when cache is empty", async () => {
    clearVaultInnerKeyMaterialCache();
    const vaultKey = await createUserVaultKey();
    const resolved = await resolveInnerVaultKeyBlobForWrap(vaultKey);
    expect(resolved).toBeUndefined();
  });

  it("resolveInnerVaultKeyBlobForWrap returns explicit options unchanged", async () => {
    const inner = new Uint8Array(32);
    const resolved = await resolveInnerVaultKeyBlobForWrap(
      await createUserVaultKey(),
      { innerVaultKeyBlob: inner }
    );
    expect(resolved?.innerVaultKeyBlob).toBe(inner);
  });

  it("assertInnerVaultKeyBlobMatchesVaultKey accepts legacy raw inner material", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const wrappingKey = await importAesKwKey(new Uint8Array(32));
    await expect(
      assertInnerVaultKeyBlobMatchesVaultKey(FIXTURE_UVK_BYTES, vaultKey, wrappingKey)
    ).resolves.toBeUndefined();
  });
});
