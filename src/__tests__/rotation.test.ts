import { describe, expect, it } from "vitest";
import {
  createPasswordEnvelope,
  createRecoveryEnvelope,
  createPasskeyPrfEnvelope,
  importUserVaultKey,
  createUserVaultKey,
  rotateVaultPassword,
  rotateRecoveryPhrase,
  maybeUpgradePasswordEnvelopeAfterUnlock,
  maybeUpgradeRecoveryEnvelopeAfterUnlock,
  unlockWithPasswordEnvelope,
  VaultAuthorizationError,
  VaultPasswordUnchangedError,
  LEGACY_ARGON2ID_PARAMS,
  LEGACY_KDF_VERSION,
  serializeArgon2idMetadata,
  deriveArgon2idAesKey,
  normalizeRecoveryPhrase,
} from "../index.js";
import {
  FIXTURE_ARGON2_SALT,
  FIXTURE_PRF_OUTPUT,
  FIXTURE_UVK_BYTES,
  FIXTURE_VAULT_PASSWORD,
  FIXTURE_12_WORD_PHRASE,
  LIQSENSE_COMPAT_PROFILE,
  LIQSENSE_COMPAT_SCOPE,
} from "../testing/fixtures/liqsense-compat.js";
import { encryptField, exportAesKey } from "../crypto/aes-gcm.js";
import { bytesToBase64Url, stringToBytes } from "../crypto/encoding.js";

async function createLegacyRecoveryEnvelope(
  vaultKey: CryptoKey,
  phrase: string
) {
  const derivedKey = await deriveArgon2idAesKey(
    stringToBytes(normalizeRecoveryPhrase(phrase)),
    FIXTURE_ARGON2_SALT,
    LEGACY_ARGON2ID_PARAMS
  );
  const legacyMetadata = serializeArgon2idMetadata(
    FIXTURE_ARGON2_SALT,
    LEGACY_ARGON2ID_PARAMS,
    LEGACY_KDF_VERSION
  );

  const encryptedVaultKey = await encryptField(
    bytesToBase64Url(await exportAesKey(vaultKey)),
    derivedKey,
    { ...LIQSENSE_COMPAT_SCOPE, field: "vault_key" },
    LIQSENSE_COMPAT_PROFILE
  );

  return {
    method: "recovery_phrase" as const,
    encryptedVaultKey,
    kdfMetadata: legacyMetadata,
    publicMetadata: { phraseLength: 12 as const },
  };
}

async function createLegacyPasswordEnvelope(
  vaultKey: CryptoKey,
  password: string
) {
  const derivedKey = await deriveArgon2idAesKey(
    stringToBytes(password.normalize("NFKC")),
    FIXTURE_ARGON2_SALT,
    LEGACY_ARGON2ID_PARAMS
  );
  const legacyMetadata = serializeArgon2idMetadata(
    FIXTURE_ARGON2_SALT,
    LEGACY_ARGON2ID_PARAMS,
    LEGACY_KDF_VERSION
  );

  const encryptedVaultKey = await encryptField(
    bytesToBase64Url(await exportAesKey(vaultKey)),
    derivedKey,
    { ...LIQSENSE_COMPAT_SCOPE, field: "vault_key" },
    LIQSENSE_COMPAT_PROFILE
  );

  return {
    method: "password" as const,
    encryptedVaultKey,
    kdfMetadata: legacyMetadata,
  };
}

describe("vault password rotation", () => {
  it("rotates the vault password while keeping the same UVK", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const { envelope: currentEnvelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    const { envelope: rotated } = await rotateVaultPassword({
      vaultKey,
      currentPassword: FIXTURE_VAULT_PASSWORD,
      newPassword: "new-vault-password-rotation-test",
      currentEnvelope,
      scope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
    });

    expect(rotated.kdfMetadata.version).toBe("kdf-v2");
    expect(rotated.kdfMetadata.memory).toBe(131072);

    const unlocked = await unlockWithPasswordEnvelope(
      "new-vault-password-rotation-test",
      rotated,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    const originalRaw = await crypto.subtle.exportKey("raw", vaultKey);
    const unlockedRaw = await crypto.subtle.exportKey("raw", unlocked);
    expect(new Uint8Array(unlockedRaw)).toEqual(new Uint8Array(originalRaw));
  });

  it("rejects unchanged passwords", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    await expect(
      rotateVaultPassword({
        vaultKey,
        currentPassword: FIXTURE_VAULT_PASSWORD,
        newPassword: FIXTURE_VAULT_PASSWORD,
        currentEnvelope: envelope,
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
      })
    ).rejects.toBeInstanceOf(VaultPasswordUnchangedError);
  });

  it("rejects rotation when the in-memory vault key does not match the envelope", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const otherKey = await createUserVaultKey();
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    await expect(
      rotateVaultPassword({
        vaultKey: otherKey,
        currentPassword: FIXTURE_VAULT_PASSWORD,
        newPassword: "brand-new-password",
        currentEnvelope: envelope,
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
      })
    ).rejects.toBeInstanceOf(VaultAuthorizationError);
  });

  it("rejects wrong current password during rotation", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    await expect(
      rotateVaultPassword({
        vaultKey,
        currentPassword: "wrong-password",
        newPassword: "brand-new-password",
        currentEnvelope: envelope,
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
      })
    ).rejects.toThrow();
  });

  it("skips upgrade when the password envelope is already recommended", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    const result = await maybeUpgradePasswordEnvelopeAfterUnlock({
      vaultKey,
      vaultPassword: FIXTURE_VAULT_PASSWORD,
      envelope,
      scope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
    });

    expect(result.upgradeRecommended).toBe(false);
    expect(result.upgradedEnvelope).toBeNull();
  });

  it("upgrades legacy kdf-v1 envelopes after unlock", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const legacyEnvelope = await createLegacyPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD
    );

    const { upgradedEnvelope, upgradeRecommended } =
      await maybeUpgradePasswordEnvelopeAfterUnlock({
        vaultKey,
        vaultPassword: FIXTURE_VAULT_PASSWORD,
        envelope: legacyEnvelope,
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
      });

    expect(upgradeRecommended).toBe(true);
    expect(upgradedEnvelope?.kdfMetadata.version).toBe("kdf-v2");
  });

  it("rejects legacy upgrade when the in-memory vault key does not match", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const otherKey = await createUserVaultKey();
    const legacyEnvelope = await createLegacyPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD
    );

    await expect(
      maybeUpgradePasswordEnvelopeAfterUnlock({
        vaultKey: otherKey,
        vaultPassword: FIXTURE_VAULT_PASSWORD,
        envelope: legacyEnvelope,
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
      })
    ).rejects.toBeInstanceOf(VaultAuthorizationError);
  });
});

describe("recovery phrase rotation", () => {
  it("defaults to a 24-word recovery phrase when wordCount is omitted", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const { envelope: passwordEnvelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    const result = await rotateRecoveryPhrase({
      vaultKey,
      authorization: {
        kind: "password",
        currentPassword: FIXTURE_VAULT_PASSWORD,
        passwordEnvelope,
      },
      scope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
    });

    expect(result.recoveryPhrase.split(" ").length).toBe(24);
  });

  it("rotates recovery phrase when authorized with the current vault password", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const { envelope: passwordEnvelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    const result = await rotateRecoveryPhrase({
      vaultKey,
      authorization: {
        kind: "password",
        currentPassword: FIXTURE_VAULT_PASSWORD,
        passwordEnvelope,
      },
      scope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
      wordCount: 12,
      recoveryKitProductName: "Test App",
    });

    expect(result.envelope.method).toBe("recovery_phrase");
    expect(result.recoveryPhrase.split(" ").length).toBe(12);
    expect(result.recoveryKitText).toMatch(/Test App Vault Recovery Kit/);
    expect(result.envelope.kdfMetadata.version).toBe("kdf-v2");
  });

  it("rotates recovery phrase when authorized with passkey PRF", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const passkeyEnvelope = await createPasskeyPrfEnvelope(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );

    const result = await rotateRecoveryPhrase({
      vaultKey,
      authorization: {
        kind: "passkey_prf",
        prfOutput: FIXTURE_PRF_OUTPUT,
        passkeyEnvelope,
      },
      scope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
      newRecoveryPhrase: FIXTURE_12_WORD_PHRASE,
      wordCount: 12,
    });

    expect(result.recoveryPhrase).toBe(FIXTURE_12_WORD_PHRASE);
    expect(result.envelope.kdfMetadata.version).toBe("kdf-v2");
  });

  it("requires recovery phrase confirmation when provided", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const { envelope: passwordEnvelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    await expect(
      rotateRecoveryPhrase({
        vaultKey,
        authorization: {
          kind: "password",
          currentPassword: FIXTURE_VAULT_PASSWORD,
          passwordEnvelope,
        },
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
        newRecoveryPhrase: FIXTURE_12_WORD_PHRASE,
        wordCount: 12,
        confirmNewRecoveryPhrase:
          "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon absent",
      })
    ).rejects.toThrow();
  });

  it("rejects invalid recovery phrase input", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const { envelope: passwordEnvelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    await expect(
      rotateRecoveryPhrase({
        vaultKey,
        authorization: {
          kind: "password",
          currentPassword: FIXTURE_VAULT_PASSWORD,
          passwordEnvelope,
        },
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
        newRecoveryPhrase: "not a valid phrase",
        wordCount: 12,
      })
    ).rejects.toBeInstanceOf(VaultAuthorizationError);
  });

  it("rejects recovery phrase word-count mismatch", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const { envelope: passwordEnvelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    await expect(
      rotateRecoveryPhrase({
        vaultKey,
        authorization: {
          kind: "password",
          currentPassword: FIXTURE_VAULT_PASSWORD,
          passwordEnvelope,
        },
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
        newRecoveryPhrase: FIXTURE_12_WORD_PHRASE,
        wordCount: 24,
      })
    ).rejects.toBeInstanceOf(VaultAuthorizationError);
  });

  it("rejects recovery rotation when password authorization fails", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const { envelope: passwordEnvelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    await expect(
      rotateRecoveryPhrase({
        vaultKey,
        authorization: {
          kind: "password",
          currentPassword: "wrong-password",
          passwordEnvelope,
        },
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
        wordCount: 12,
      })
    ).rejects.toThrow();
  });

  it("skips recovery upgrade when the envelope is already recommended", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const { envelope } = await createRecoveryEnvelope(
      vaultKey,
      FIXTURE_12_WORD_PHRASE,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      { phraseLength: 12 },
      FIXTURE_ARGON2_SALT
    );

    const result = await maybeUpgradeRecoveryEnvelopeAfterUnlock({
      vaultKey,
      recoveryPhrase: FIXTURE_12_WORD_PHRASE,
      envelope,
      scope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
      expectedWordCount: 12,
    });

    expect(result.upgradeRecommended).toBe(false);
    expect(result.upgradedEnvelope).toBeNull();
  });

  it("upgrades legacy recovery envelopes after unlock", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const legacyEnvelope = await createLegacyRecoveryEnvelope(
      vaultKey,
      FIXTURE_12_WORD_PHRASE
    );

    const { upgradedEnvelope, upgradeRecommended } =
      await maybeUpgradeRecoveryEnvelopeAfterUnlock({
        vaultKey,
        recoveryPhrase: FIXTURE_12_WORD_PHRASE,
        envelope: legacyEnvelope,
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
        expectedWordCount: 12,
      });

    expect(upgradeRecommended).toBe(true);
    expect(upgradedEnvelope?.kdfMetadata.version).toBe("kdf-v2");
  });

  it("upgrades legacy recovery envelopes without explicit expected word count", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const legacyEnvelope = {
      ...(await createLegacyRecoveryEnvelope(vaultKey, FIXTURE_12_WORD_PHRASE)),
      publicMetadata: undefined,
    };

    const { upgradedEnvelope, upgradeRecommended } =
      await maybeUpgradeRecoveryEnvelopeAfterUnlock({
        vaultKey,
        recoveryPhrase: FIXTURE_12_WORD_PHRASE,
        envelope: legacyEnvelope,
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
      });

    expect(upgradeRecommended).toBe(true);
    expect(upgradedEnvelope?.publicMetadata?.phraseLength).toBe(12);
  });

  it("rejects legacy recovery upgrade when the in-memory vault key does not match", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const otherKey = await createUserVaultKey();
    const legacyEnvelope = await createLegacyRecoveryEnvelope(
      vaultKey,
      FIXTURE_12_WORD_PHRASE
    );

    await expect(
      maybeUpgradeRecoveryEnvelopeAfterUnlock({
        vaultKey: otherKey,
        recoveryPhrase: FIXTURE_12_WORD_PHRASE,
        envelope: legacyEnvelope,
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
        expectedWordCount: 12,
      })
    ).rejects.toBeInstanceOf(VaultAuthorizationError);
  });
});

describe("vault rotation authorization", () => {
  it("compares user vault keys in constant time", async () => {
    const { userVaultKeysEqual, createUserVaultKey } = await import("../index.js");
    const a = await createUserVaultKey();
    const b = await createUserVaultKey();
    expect(await userVaultKeysEqual(a, a)).toBe(true);
    expect(await userVaultKeysEqual(a, b)).toBe(false);

    const shortKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(16),
      { name: "AES-GCM", length: 128 },
      true,
      ["encrypt", "decrypt"]
    );
    expect(await userVaultKeysEqual(a, shortKey)).toBe(false);
  });

  it("rejects passkey authorization when the in-memory vault key does not match", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const otherKey = await createUserVaultKey();
    const passkeyEnvelope = await createPasskeyPrfEnvelope(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );

    await expect(
      rotateRecoveryPhrase({
        vaultKey: otherKey,
        authorization: {
          kind: "passkey_prf",
          prfOutput: FIXTURE_PRF_OUTPUT,
          passkeyEnvelope,
        },
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
        wordCount: 12,
      })
    ).rejects.toBeInstanceOf(VaultAuthorizationError);
  });

  it("rejects passkey authorization with invalid PRF output length", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES);
    const passkeyEnvelope = await createPasskeyPrfEnvelope(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );

    await expect(
      rotateRecoveryPhrase({
        vaultKey,
        authorization: {
          kind: "passkey_prf",
          prfOutput: new Uint8Array(8),
          passkeyEnvelope,
        },
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
        wordCount: 12,
      })
    ).rejects.toBeInstanceOf(VaultAuthorizationError);
  });
});
