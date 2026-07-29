import { describe, expect, it } from "vitest";
import {
  createPortableVaultBrokerEncryptedVaultKey,
  generatePortableVaultOpaqueAadScope,
  generatePortableVaultUnlockKey,
  PORTABLE_VAULT_UNLOCK_KEY_BYTES,
  unlockPortableVaultBrokerEncryptedVaultKey,
} from "../crypto/portable-vault-broker-envelope.js";
import { createUserVaultKey, userVaultKeysEqual } from "../keys/user-vault-key.js";
import { generateUserVaultAesKey } from "../crypto/user-vault-key-crypto.js";

const profile = {
  cryptoVersion: "vault-v1",
  aadContextEnvelope: "portable-test-envelope-v1",
  aadContextVault: "portable-test-vault-v1",
} as const;

describe("portable vault broker envelope", () => {
  it("generates random PUK and opaque AAD identifiers", () => {
    const first = generatePortableVaultUnlockKey();
    const second = generatePortableVaultUnlockKey();
    const scope = generatePortableVaultOpaqueAadScope();

    expect(first).toHaveLength(PORTABLE_VAULT_UNLOCK_KEY_BYTES);
    expect(second).toHaveLength(PORTABLE_VAULT_UNLOCK_KEY_BYTES);
    expect(first).not.toEqual(second);
    expect(scope.userId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(scope.resourceId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(scope.userId).not.toBe(scope.resourceId);
  });

  it("round-trips a UVK with domain-separated PUK keys and strict opaque AAD", async () => {
    const vaultKey = await createUserVaultKey();
    const puk = generatePortableVaultUnlockKey();
    const scope = generatePortableVaultOpaqueAadScope();
    const encrypted = await createPortableVaultBrokerEncryptedVaultKey(
      vaultKey,
      puk,
      scope,
      profile
    );
    const restored = await unlockPortableVaultBrokerEncryptedVaultKey(
      encrypted,
      puk,
      scope,
      profile
    );

    expect(await userVaultKeysEqual(vaultKey, restored)).toBe(true);
    expect(restored.extractable).toBe(false);
    expect(encrypted.aad).toEqual({
      ...scope,
      field: "vault_key",
      context: profile.aadContextEnvelope,
    });
  });

  it("supports a caller-provided inner blob for a non-extractable session UVK", async () => {
    const original = await createUserVaultKey();
    const puk = generatePortableVaultUnlockKey();
    const scope = generatePortableVaultOpaqueAadScope();
    const first = await createPortableVaultBrokerEncryptedVaultKey(original, puk, scope, profile);
    const restored = await unlockPortableVaultBrokerEncryptedVaultKey(first, puk, scope, profile);

    const encrypted = await createPortableVaultBrokerEncryptedVaultKey(
      restored,
      puk,
      scope,
      profile,
      { innerVaultKeyBlob: new Uint8Array(40) }
    ).catch((error: unknown) => error);

    expect(encrypted).toBeInstanceOf(Error);
  });

  it("fails closed for malformed PUKs, wrong PUKs, and wrong AAD scope", async () => {
    const vaultKey = await createUserVaultKey();
    const puk = generatePortableVaultUnlockKey();
    const scope = generatePortableVaultOpaqueAadScope();
    const encrypted = await createPortableVaultBrokerEncryptedVaultKey(vaultKey, puk, scope, profile);

    await expect(
      createPortableVaultBrokerEncryptedVaultKey(
        vaultKey,
        new Uint8Array(31),
        scope,
        profile
      )
    ).rejects.toThrow("exactly 32 bytes");
    await expect(
      unlockPortableVaultBrokerEncryptedVaultKey(
        encrypted,
        new Uint8Array(31),
        scope,
        profile
      )
    ).rejects.toThrow("exactly 32 bytes");
    await expect(
      unlockPortableVaultBrokerEncryptedVaultKey(
        encrypted,
        generatePortableVaultUnlockKey(),
        scope,
        profile
      )
    ).rejects.toBeDefined();
    await expect(
      unlockPortableVaultBrokerEncryptedVaultKey(
        encrypted,
        puk,
        { ...scope, resourceId: crypto.randomUUID() },
        profile
      )
    ).rejects.toThrow("resourceId mismatch");
  });

  it("rejects a non-extractable first UVK when no inner material is available", async () => {
    await expect(
      createPortableVaultBrokerEncryptedVaultKey(
        await generateUserVaultAesKey(),
        generatePortableVaultUnlockKey(),
        generatePortableVaultOpaqueAadScope(),
        profile
      )
    ).rejects.toThrow("Cannot wrap a non-extractable vault key");
  });
});
