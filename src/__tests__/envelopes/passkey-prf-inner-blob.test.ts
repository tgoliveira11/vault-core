import { describe, expect, it, vi } from "vitest";
import {
  createPasskeyPrfEnvelope,
  createPasskeyPrfEnvelopeWithSessionCache,
  createPasswordEnvelope,
  createRecoveryEnvelope,
  createUserVaultKey,
  deriveVaultPasswordKeyPairFromMetadata,
  exportUserVaultKey,
  extractInnerVaultKeyBlob,
  importUserVaultKey,
  rewrapInnerVaultKeyMaterialForPrfOutput,
  rewrapInnerVaultKeyMaterialForWrappingKeys,
  unlockWithPasswordEnvelope,
  VaultAuthorizationError,
  VaultKeyNotExtractableError,
} from "../../index.js";
import {
  cacheVaultInnerKeyMaterialAfterPasswordUnlock,
  cacheVaultInnerKeyMaterialAfterRecoveryUnlock,
  cacheVaultInnerKeyMaterialFromPasskeyUnlock,
  clearVaultInnerKeyMaterialCache,
  getCachedVaultInnerKeyMaterial,
  INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE,
  VaultInnerKeyMaterialCache,
} from "../../browser/inner-key-material-cache.js";
import {
  FIXTURE_ARGON2_SALT,
  FIXTURE_PRF_OUTPUT,
  FIXTURE_UVK_BYTES,
  FIXTURE_VAULT_PASSWORD,
  FIXTURE_12_WORD_PHRASE,
  LIQSENSE_COMPAT_PROFILE,
  LIQSENSE_COMPAT_SCOPE,
} from "../../testing/fixtures/liqsense-compat.js";
import { lockVaultSession, unlockVaultSession } from "../../session/auto-lock.js";
import { importAesKwKey } from "../../crypto/user-vault-key-crypto.js";

const LONG_PRF_OUTPUT = new Uint8Array(48);
LONG_PRF_OUTPUT.set(FIXTURE_PRF_OUTPUT);

describe("createPasskeyPrfEnvelope innerVaultKeyBlob", () => {
  it("creates passkey envelope after password unlock using session cache", async () => {
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
    await cacheVaultInnerKeyMaterialAfterPasswordUnlock(
      unlocked,
      envelope,
      FIXTURE_VAULT_PASSWORD
    );

    const passkeyEnvelope = await createPasskeyPrfEnvelopeWithSessionCache(
      unlocked,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(passkeyEnvelope.method).toBe("passkey_prf");
  });

  it("rejects passkey envelope creation without inner blob on non-extractable keys", async () => {
    const key = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: false });
    await expect(
      createPasskeyPrfEnvelope(
        key,
        FIXTURE_PRF_OUTPUT,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toThrow(VaultKeyNotExtractableError);
  });

  it("clears stale cache and throws actionable error on UVK mismatch", async () => {
    const vaultKey = await createUserVaultKey();
    const otherKey = await createUserVaultKey();
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
    await cacheVaultInnerKeyMaterialAfterPasswordUnlock(
      unlocked,
      envelope,
      FIXTURE_VAULT_PASSWORD
    );

    await expect(
      createPasskeyPrfEnvelopeWithSessionCache(
        otherKey,
        FIXTURE_PRF_OUTPUT,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toThrow(INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE);
    expect(getCachedVaultInnerKeyMaterial()).toBeNull();
  });

  it("accepts explicit innerVaultKeyBlob without cache", async () => {
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
    const raw = await exportUserVaultKey(vaultKey);
    const nonExtractable = await importUserVaultKey(raw, { extractable: false });
    const prfWrappingKey = await importAesKwKey(FIXTURE_PRF_OUTPUT.slice(0, 32));
    const rewrappedInner = await rewrapInnerVaultKeyMaterialForWrappingKeys(
      inner,
      keys.wrappingKey,
      prfWrappingKey,
      nonExtractable
    );

    clearVaultInnerKeyMaterialCache();
    const passkeyEnvelope = await createPasskeyPrfEnvelope(
      nonExtractable,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      undefined,
      { innerVaultKeyBlob: rewrappedInner }
    );
    expect(passkeyEnvelope.method).toBe("passkey_prf");
  });
});

describe("VaultInnerKeyMaterialCache", () => {
  it("exposes grouped cache helpers", () => {
    expect(typeof VaultInnerKeyMaterialCache.clear).toBe("function");
    expect(typeof VaultInnerKeyMaterialCache.getCached).toBe("function");
    expect(typeof VaultInnerKeyMaterialCache.cacheFromEnvelopeDecrypt).toBe("function");
    expect(typeof VaultInnerKeyMaterialCache.cacheFromPasskeyEnvelope).toBe("function");
  });

  it("clears cache on lockVaultSession", async () => {
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
    await unlockVaultSession(unlocked);
    await cacheVaultInnerKeyMaterialAfterPasswordUnlock(
      unlocked,
      envelope,
      FIXTURE_VAULT_PASSWORD
    );
    expect(getCachedVaultInnerKeyMaterial()).not.toBeNull();

    lockVaultSession();
    expect(getCachedVaultInnerKeyMaterial()).toBeNull();
  });
});

describe("browser inner-key cache helpers", () => {
  it("caches after recovery unlock and passkey unlock", async () => {
    clearVaultInnerKeyMaterialCache();
    const vaultKey = await createUserVaultKey();
    const phrase = FIXTURE_12_WORD_PHRASE;
    const { envelope: recoveryEnvelope } = await createRecoveryEnvelope(
      vaultKey,
      phrase,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    const passkeyEnvelope = await createPasskeyPrfEnvelope(
      vaultKey,
      LONG_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );

    await cacheVaultInnerKeyMaterialAfterRecoveryUnlock(
      vaultKey,
      recoveryEnvelope,
      phrase
    );
    expect(getCachedVaultInnerKeyMaterial()).not.toBeNull();
    clearVaultInnerKeyMaterialCache();

    await cacheVaultInnerKeyMaterialFromPasskeyUnlock(
      vaultKey,
      passkeyEnvelope,
      LONG_PRF_OUTPUT
    );
    expect(getCachedVaultInnerKeyMaterial()).not.toBeNull();
    clearVaultInnerKeyMaterialCache();

    const passkeyEnvelope32 = await createPasskeyPrfEnvelope(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    await cacheVaultInnerKeyMaterialFromPasskeyUnlock(
      vaultKey,
      passkeyEnvelope32,
      FIXTURE_PRF_OUTPUT
    );
    expect(getCachedVaultInnerKeyMaterial()).not.toBeNull();
  });

  it("creates passkey envelope with explicit innerVaultKeyBlob option (bypasses cache)", async () => {
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
    await cacheVaultInnerKeyMaterialAfterPasswordUnlock(
      unlocked,
      envelope,
      FIXTURE_VAULT_PASSWORD
    );
    const keys = await deriveVaultPasswordKeyPairFromMetadata(
      FIXTURE_VAULT_PASSWORD,
      envelope.kdfMetadata
    );
    const inner = await extractInnerVaultKeyBlob(
      envelope.encryptedVaultKey,
      keys.encryptionKey
    );
    const prfWrappingKey = await importAesKwKey(FIXTURE_PRF_OUTPUT.slice(0, 32));
    const rewrappedInner = await rewrapInnerVaultKeyMaterialForWrappingKeys(
      inner,
      keys.wrappingKey,
      prfWrappingKey,
      unlocked
    );

    const result = await createPasskeyPrfEnvelopeWithSessionCache(
      unlocked,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      undefined,
      { innerVaultKeyBlob: rewrappedInner }
    );
    expect(result.method).toBe("passkey_prf");
  });

  it("rewraps inner material between PRF outputs", async () => {
    const vaultKey = await createUserVaultKey();
    const passkeyEnvelope = await createPasskeyPrfEnvelope(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    const prfKey = await crypto.subtle.importKey(
      "raw",
      FIXTURE_PRF_OUTPUT.slice(0, 32),
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    const inner = await extractInnerVaultKeyBlob(
      passkeyEnvelope.encryptedVaultKey,
      prfKey
    );
    const newPrf = new Uint8Array(32);
    newPrf.set(FIXTURE_PRF_OUTPUT);
    newPrf[0] ^= 0xff;

    const rewrapped = await rewrapInnerVaultKeyMaterialForPrfOutput(
      inner,
      FIXTURE_PRF_OUTPUT,
      newPrf,
      vaultKey
    );
    expect(rewrapped.byteLength).toBeGreaterThan(0);
  });

  it("rejects cache helpers when envelope metadata is invalid", async () => {
    const vaultKey = await createUserVaultKey();
    await expect(
      cacheVaultInnerKeyMaterialAfterPasswordUnlock(
        vaultKey,
        { encryptedVaultKey: {} as never, kdfMetadata: null },
        FIXTURE_VAULT_PASSWORD
      )
    ).rejects.toThrow("Argon2id metadata");

    await expect(
      cacheVaultInnerKeyMaterialAfterRecoveryUnlock(
        vaultKey,
        { encryptedVaultKey: {} as never, kdfMetadata: null },
        FIXTURE_12_WORD_PHRASE
      )
    ).rejects.toThrow("Argon2id metadata");
  });

  it("createPasskeyPrfEnvelopeWithSessionCache without cache uses extractable key", async () => {
    clearVaultInnerKeyMaterialCache();
    const vaultKey = await createUserVaultKey();
    const passkeyEnvelope = await createPasskeyPrfEnvelopeWithSessionCache(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(passkeyEnvelope.method).toBe("passkey_prf");
  });

  it("rethrows non-authorization errors from session cache re-wrap", async () => {
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
    await cacheVaultInnerKeyMaterialAfterPasswordUnlock(
      unlocked,
      envelope,
      FIXTURE_VAULT_PASSWORD
    );

    const vaultKeyEnvelope = await import("../../crypto/vault-key-envelope.js");
    vi.spyOn(vaultKeyEnvelope, "rewrapInnerVaultKeyMaterialForWrappingKeys").mockRejectedValueOnce(
      new Error("crypto failure")
    );

    await expect(
      createPasskeyPrfEnvelopeWithSessionCache(
        unlocked,
        FIXTURE_PRF_OUTPUT,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toThrow("crypto failure");

    vi.restoreAllMocks();
  });
});
