import { describe, expect, it } from "vitest";
import {
  createPasskeyPrfEnvelopeAfterIndependentAuthorization,
  createPasswordEnvelope,
  createRecoveryEnvelope,
  createUserVaultKey,
  exportUserVaultKey,
  unlockWithPasskeyPrfEnvelope,
  userVaultKeysEqual,
  VaultAuthorizationError,
  type PasswordEnvelope,
  type RecoveryPhraseEnvelope,
} from "../../index.js";
import {
  FIXTURE_12_WORD_PHRASE,
  FIXTURE_ARGON2_SALT,
  FIXTURE_PRF_OUTPUT,
  FIXTURE_VAULT_PASSWORD,
  LIQSENSE_COMPAT_PROFILE,
  LIQSENSE_COMPAT_SCOPE,
} from "../../testing/fixtures/liqsense-compat.js";

describe("createPasskeyPrfEnvelopeAfterIndependentAuthorization", () => {
  it("creates a PRF envelope from independent password authorization", async () => {
    const originalVaultKey = await createUserVaultKey();
    const { envelope: passwordEnvelope } = await createPasswordEnvelope(
      originalVaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    const result = await createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      authorization: {
        kind: "password",
        password: FIXTURE_VAULT_PASSWORD,
        envelope: passwordEnvelope,
      },
      verifiedCredentialId: "credential-synced",
      prfOutput: FIXTURE_PRF_OUTPUT,
      expectedScope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
      publicMetadata: { credentialId: "untrusted-override", appVersion: 2 },
    });

    expect(result.vaultKey.extractable).toBe(false);
    expect(result.envelope.publicMetadata).toEqual({
      credentialId: "credential-synced",
      prfRequired: true,
      appVersion: 2,
    });
    const unlocked = await unlockWithPasskeyPrfEnvelope(
      result.envelope,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(await userVaultKeysEqual(result.vaultKey, unlocked)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(FIXTURE_VAULT_PASSWORD);
  });

  it("creates a PRF envelope from independent recovery authorization", async () => {
    const originalVaultKey = await createUserVaultKey();
    const { envelope: recoveryEnvelope } = await createRecoveryEnvelope(
      originalVaultKey,
      FIXTURE_12_WORD_PHRASE,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      { phraseLength: 12 },
      FIXTURE_ARGON2_SALT
    );

    const result = await createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      authorization: {
        kind: "recovery_phrase",
        recoveryPhrase: FIXTURE_12_WORD_PHRASE,
        envelope: recoveryEnvelope,
      },
      verifiedCredentialId: "credential-recovery",
      prfOutput: FIXTURE_PRF_OUTPUT,
      expectedScope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
    });

    const unlocked = await unlockWithPasskeyPrfEnvelope(
      result.envelope,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(await userVaultKeysEqual(result.vaultKey, unlocked)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("abandon");
  });

  it("upgrades legacy raw inner key material without exporting the returned UVK", async () => {
    const originalVaultKey = await createUserVaultKey();
    const rawVaultKey = await exportUserVaultKey(originalVaultKey);
    const { envelope: legacyPasswordEnvelope } = await createPasswordEnvelope(
      originalVaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT,
      { innerVaultKeyBlob: rawVaultKey }
    );

    const result = await createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      authorization: {
        kind: "password",
        password: FIXTURE_VAULT_PASSWORD,
        envelope: legacyPasswordEnvelope,
      },
      verifiedCredentialId: "credential-legacy",
      prfOutput: FIXTURE_PRF_OUTPUT,
      expectedScope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
    });

    expect(result.vaultKey.extractable).toBe(false);
    const unlocked = await unlockWithPasskeyPrfEnvelope(
      result.envelope,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(await userVaultKeysEqual(result.vaultKey, unlocked)).toBe(true);
  });

  it("accepts missing, null, and allowlisted legacy AAD only while legacy routing is enabled", async () => {
    const originalVaultKey = await createUserVaultKey();
    const { envelope: canonicalEnvelope } = await createPasswordEnvelope(
      originalVaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const withoutContext = {
      ...canonicalEnvelope,
      encryptedVaultKey: {
        ...canonicalEnvelope.encryptedVaultKey,
        aad: { ...canonicalEnvelope.encryptedVaultKey.aad, context: undefined },
      },
    };
    const withNullContext = {
      ...canonicalEnvelope,
      encryptedVaultKey: {
        ...canonicalEnvelope.encryptedVaultKey,
        aad: { ...canonicalEnvelope.encryptedVaultKey.aad, context: null },
      },
    };

    for (const [credentialId, envelope] of [
      ["credential-missing-context", withoutContext],
      ["credential-null-context", withNullContext],
    ] as const) {
      const result = await createPasskeyPrfEnvelopeAfterIndependentAuthorization({
        authorization: {
          kind: "password",
          password: FIXTURE_VAULT_PASSWORD,
          envelope,
        },
        verifiedCredentialId: credentialId,
        prfOutput: FIXTURE_PRF_OUTPUT,
        expectedScope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
      });
      expect(result.vaultKey.extractable).toBe(false);
    }

    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      authorization: {
        kind: "password",
        password: FIXTURE_VAULT_PASSWORD,
        envelope: withoutContext,
      },
      verifiedCredentialId: "credential-strict",
      prfOutput: FIXTURE_PRF_OUTPUT,
      expectedScope: LIQSENSE_COMPAT_SCOPE,
      profile: { ...LIQSENSE_COMPAT_PROFILE, legacyVaultKeyUnlock: false },
    })).rejects.toThrow(/context mismatch/i);
  });

  it("accepts only explicitly allowlisted legacy AAD strings", async () => {
    const legacyContext = "liqsense:vault-envelope:legacy-v0";
    const originalVaultKey = await createUserVaultKey();
    const { envelope } = await createPasswordEnvelope(
      originalVaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      { ...LIQSENSE_COMPAT_PROFILE, aadContextEnvelope: legacyContext },
      FIXTURE_ARGON2_SALT
    );
    const authorization = {
      kind: "password" as const,
      password: FIXTURE_VAULT_PASSWORD,
      envelope,
    };

    const allowed = await createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      authorization,
      verifiedCredentialId: "credential-allowlisted-context",
      prfOutput: FIXTURE_PRF_OUTPUT,
      expectedScope: LIQSENSE_COMPAT_SCOPE,
      profile: {
        ...LIQSENSE_COMPAT_PROFILE,
        legacyVaultKeyAadContexts: [legacyContext],
      },
    });
    expect(allowed.vaultKey.extractable).toBe(false);

    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      authorization,
      verifiedCredentialId: "credential-arbitrary-context",
      prfOutput: FIXTURE_PRF_OUTPUT,
      expectedScope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
    })).rejects.toThrow(/context mismatch/i);
  });

  it("rejects wrong secrets, scope, and recovery word count", async () => {
    const originalVaultKey = await createUserVaultKey();
    const { envelope: passwordEnvelope } = await createPasswordEnvelope(
      originalVaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const { envelope: recoveryEnvelope } = await createRecoveryEnvelope(
      originalVaultKey,
      FIXTURE_12_WORD_PHRASE,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      { phraseLength: 12 },
      FIXTURE_ARGON2_SALT
    );
    const base = {
      verifiedCredentialId: "credential-a",
      prfOutput: FIXTURE_PRF_OUTPUT,
      expectedScope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
    };

    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      authorization: { kind: "password", password: "wrong", envelope: passwordEnvelope },
    })).rejects.toBeTruthy();
    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      expectedScope: {
        ...LIQSENSE_COMPAT_SCOPE,
        resourceId: "00000000-0000-4000-8000-000000000002",
      },
      authorization: {
        kind: "password",
        password: FIXTURE_VAULT_PASSWORD,
        envelope: passwordEnvelope,
      },
    })).rejects.toThrow(/resourceId mismatch/i);
    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      authorization: {
        kind: "recovery_phrase",
        recoveryPhrase: FIXTURE_12_WORD_PHRASE,
        envelope: recoveryEnvelope,
        expectedWordCount: 24,
      },
    })).rejects.toThrow(/24-word recovery phrase/i);
  });

  it("rejects invalid credential, PRF, and KDF inputs before creating an envelope", async () => {
    const originalVaultKey = await createUserVaultKey();
    const { envelope } = await createPasswordEnvelope(
      originalVaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const authorization = {
      kind: "password" as const,
      password: FIXTURE_VAULT_PASSWORD,
      envelope,
    };
    const base = {
      authorization,
      verifiedCredentialId: "credential-a",
      prfOutput: FIXTURE_PRF_OUTPUT,
      expectedScope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
    };

    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      verifiedCredentialId: " invalid",
    })).rejects.toThrow(TypeError);
    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      prfOutput: new Uint8Array(31),
    })).rejects.toThrow(VaultAuthorizationError);
    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      prfOutput: "not-bytes" as unknown as Uint8Array,
    })).rejects.toThrow(VaultAuthorizationError);
    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      publicMetadata: { password: FIXTURE_VAULT_PASSWORD },
    })).rejects.toThrow(/Plaintext field/);
    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      publicMetadata: null as unknown as Record<string, unknown>,
    })).rejects.toThrow(/plain object/);
    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      verifiedCredentialId: "c".repeat(2_048),
      publicMetadata: { note: "x".repeat(3_000) },
    })).rejects.toThrow(/4096 bytes/);

    const invalidPasswordEnvelope = {
      ...envelope,
      kdfMetadata: null,
    } as unknown as PasswordEnvelope;
    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      authorization: { ...authorization, envelope: invalidPasswordEnvelope },
    })).rejects.toBeTruthy();

    const invalidRecoveryEnvelope = {
      ...envelope,
      method: "recovery_phrase",
      kdfMetadata: null,
    } as unknown as RecoveryPhraseEnvelope;
    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      authorization: {
        kind: "recovery_phrase",
        recoveryPhrase: FIXTURE_12_WORD_PHRASE,
        envelope: invalidRecoveryEnvelope,
      },
    })).rejects.toBeTruthy();
    await expect(createPasskeyPrfEnvelopeAfterIndependentAuthorization({
      ...base,
      authorization: {
        kind: "passkey_prf",
      } as unknown as typeof authorization,
    })).rejects.toThrow(/password or recovery phrase/i);
  });
});
