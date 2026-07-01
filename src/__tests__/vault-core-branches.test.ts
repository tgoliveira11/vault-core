import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ARGON2ID_LIMITS,
  PasskeyPrfRequiredError,
  PasskeyUnlockError,
  RecoveryPhraseConfirmationError,
  VaultConflictError,
  VaultKeyNotExtractableError,
  VaultNotFoundError,
  assertRecoveryPhraseConfirmation,
  assertRecoveryPhraseUnlockInput,
  assertRecoveryPhraseWordConfirmation,
  assertSafeArgon2idParams,
  assertSafeArgon2idSalt,
  assertVaultKeyAad,
  assertVaultPayloadAad,
  buildRecoveryKitContent,
  containsSentinel,
  createPasskeyPrfEnvelope,
  createPasswordEnvelope,
  createRecoveryEnvelope,
  createRecoveryKitText,
  createRecoveryPhrase,
  createUserVaultKey,
  deriveArgon2idAesKey,
  deriveRecoveryPhraseKey,
  deriveRecoveryPhraseKeyFromMetadata,
  deriveVaultPasswordKey,
  decryptField,
  encryptedPayloadSchema,
  exportUserVaultKey,
  extractPasskeyPrfOutput,
  getRecoveryConfirmationPromptCount,
  getRecoveryPhraseWordCount,
  importUserVaultKey,
  isPasskeySupported,
  isPrfExtensionSupported,
  parseArgon2idMetadata,
  parseRecoveryPhraseWordCount,
  pickRecoveryConfirmationIndices,
  randomBytes,
  resolveAadContext,
  scanForSentinels,
  serializeArgon2idMetadata,
  storedEnvelopeSchema,
  unlockVaultFromPasskeyEnvelope,
  unlockWithPasskeyPrfEnvelope,
  unlockWithPasswordEnvelope,
  unlockWithRecoveryEnvelope,
  unwrapVaultKeyFromPasskey,
  validateNoPlaintextLeak,
  validateRecoveryPhraseFormat,
  vaultSetupEnvelopeFieldsSchema,
  wrapVaultKeyForPasskey,
  wrapVaultKeyForPassword,
  wrapVaultKeyForRecoveryPhrase,
  SENTINEL_PRIVATE_NOTE,
} from "../index.js";
import {
  FIXTURE_12_WORD_PHRASE,
  FIXTURE_ARGON2_SALT,
  FIXTURE_PRF_OUTPUT,
  FIXTURE_UVK_BYTES,
  FIXTURE_VAULT_PASSWORD,
  LIQSENSE_COMPAT_PROFILE,
  LIQSENSE_COMPAT_SCOPE,
} from "../testing/fixtures/liqsense-compat.js";
import type { EncryptedVaultPayload } from "../validation/schemas.js";

const OTHER_ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recovery helper branches", () => {
  it("rejects unsupported phrase lengths and reports known lengths", () => {
    expect(() => createRecoveryPhrase({ wordCount: 18 as 12 })).toThrow(/12 or 24/);
    expect(getRecoveryPhraseWordCount(FIXTURE_12_WORD_PHRASE)).toBe(12);
    expect(getRecoveryPhraseWordCount("one two")).toBeNull();
    expect(getRecoveryConfirmationPromptCount(12)).toBe(3);
    expect(getRecoveryConfirmationPromptCount(24)).toBe(4);
  });

  it("parses both recovery metadata field names", () => {
    expect(parseRecoveryPhraseWordCount({ phraseLength: 12 })).toBe(12);
    expect(parseRecoveryPhraseWordCount({ wordCount: 24 })).toBe(24);
    expect(parseRecoveryPhraseWordCount({ phraseLength: 18 })).toBeNull();
    expect(parseRecoveryPhraseWordCount(null)).toBeNull();
  });

  it("validates recovery unlock input and expected length", () => {
    expect(() => assertRecoveryPhraseUnlockInput("invalid")).toThrow(/valid/);
    expect(() => assertRecoveryPhraseUnlockInput(FIXTURE_12_WORD_PHRASE, 24)).toThrow(
      /uses a 24-word/
    );
    expect(() => assertRecoveryPhraseUnlockInput(FIXTURE_12_WORD_PHRASE, 12)).not.toThrow();
    expect(validateRecoveryPhraseFormat("")).toBe(false);
    expect(validateRecoveryPhraseFormat("one two three")).toBe(false);
    expect(
      validateRecoveryPhraseFormat(FIXTURE_12_WORD_PHRASE.replace(/\w+$/, "zoo"))
    ).toBe(false);
  });

  it("checks full and selected-word confirmations", () => {
    expect(() =>
      assertRecoveryPhraseConfirmation(FIXTURE_12_WORD_PHRASE, `${FIXTURE_12_WORD_PHRASE} extra`)
    ).toThrow(RecoveryPhraseConfirmationError);
    expect(() => assertRecoveryPhraseConfirmation("invalid", "invalid")).toThrow(
      /not valid/
    );
    expect(() =>
      assertRecoveryPhraseConfirmation(FIXTURE_12_WORD_PHRASE, FIXTURE_12_WORD_PHRASE)
    ).not.toThrow();

    expect(() => assertRecoveryPhraseWordConfirmation("invalid", { 1: "invalid" })).toThrow(
      /not valid/
    );
    expect(() =>
      assertRecoveryPhraseWordConfirmation(FIXTURE_12_WORD_PHRASE, { 1: "wrong" }, [1])
    ).toThrow(/Word #1/);
    expect(() =>
      assertRecoveryPhraseWordConfirmation(FIXTURE_12_WORD_PHRASE, { 99: "word" }, [99])
    ).toThrow(/indices are invalid/);
    expect(() =>
      assertRecoveryPhraseWordConfirmation(FIXTURE_12_WORD_PHRASE, {})
    ).toThrow(/does not match/);
    expect(() =>
      assertRecoveryPhraseWordConfirmation(FIXTURE_12_WORD_PHRASE, {}, [])
    ).toThrow(/indices are invalid/);
    expect(() =>
      assertRecoveryPhraseWordConfirmation(FIXTURE_12_WORD_PHRASE, {}, [1, 1])
    ).toThrow(/indices are invalid/);
    expect(() => pickRecoveryConfirmationIndices(2, 3)).toThrow(/Not enough/);
    expect(new Set(pickRecoveryConfirmationIndices(24, 4)).size).toBe(4);
  });

  it("rejects invalid phrases before recovery KDF derivation", async () => {
    await expect(deriveRecoveryPhraseKey("invalid")).rejects.toThrow(/Invalid/);
    const metadata = serializeArgon2idMetadata(FIXTURE_ARGON2_SALT);
    await expect(deriveRecoveryPhraseKeyFromMetadata("invalid", metadata)).rejects.toThrow(
      /Invalid/
    );
  });

  it("exercises recovery envelope validation and deprecated wrappers", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const wrapped = await wrapVaultKeyForRecoveryPhrase(
      vaultKey,
      FIXTURE_12_WORD_PHRASE,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    await expect(
      unlockWithRecoveryEnvelope(
        FIXTURE_12_WORD_PHRASE,
        { ...wrapped, kdfMetadata: null } as never,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toThrow(/requires Argon2id/);

    const { envelope } = await createRecoveryEnvelope(
      vaultKey,
      FIXTURE_12_WORD_PHRASE,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      undefined,
      FIXTURE_ARGON2_SALT
    );
    await expect(
      unlockWithRecoveryEnvelope(
        FIXTURE_12_WORD_PHRASE,
        envelope,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE,
        { expectedWordCount: 12 }
      )
    ).resolves.toBeInstanceOf(CryptoKey);
  });
});

describe("passkey PRF branches", () => {
  it("detects passkey and PRF extension support", () => {
    vi.stubGlobal("PublicKeyCredential", undefined);
    expect(isPasskeySupported()).toBe(false);
    expect(isPrfExtensionSupported()).toBe(false);

    class WithoutPrf {}
    vi.stubGlobal("PublicKeyCredential", WithoutPrf);
    expect(isPasskeySupported()).toBe(true);
    expect(isPrfExtensionSupported()).toBe(false);

    class WithPrf {
      getClientExtensionResults() {}
    }
    vi.stubGlobal("PublicKeyCredential", WithPrf);
    expect(isPrfExtensionSupported()).toBe(true);
  });

  it("extracts only sufficiently long PRF results", () => {
    expect(extractPasskeyPrfOutput({})).toBeNull();
    expect(
      extractPasskeyPrfOutput({ prf: { results: { first: new ArrayBuffer(16) } } })
    ).toBeNull();
    expect(
      extractPasskeyPrfOutput({ prf: { results: { first: new ArrayBuffer(32) } } })
    ).toHaveLength(32);
  });

  it("handles missing and invalid PRF outputs", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const envelope = await createPasskeyPrfEnvelope(
      vaultKey,
      new Uint8Array(64).fill(7),
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      { credentialId: "test" }
    );
    await expect(
      unlockWithPasskeyPrfEnvelope(
        envelope,
        null,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toBeInstanceOf(PasskeyPrfRequiredError);
    await expect(
      unlockWithPasskeyPrfEnvelope(
        envelope,
        null,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE,
        { prfRequired: false }
      )
    ).rejects.toBeInstanceOf(PasskeyUnlockError);
    await expect(
      unlockWithPasskeyPrfEnvelope(
        envelope,
        new Uint8Array(32).fill(9),
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toBeInstanceOf(PasskeyUnlockError);
    await expect(
      unwrapVaultKeyFromPasskey(
        envelope.encryptedVaultKey,
        new Uint8Array(8),
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toThrow(/32 bytes/);
  });

  it("supports deprecated passkey envelope forms", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const encryptedVaultKey = await wrapVaultKeyForPasskey(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE.userId,
      LIQSENSE_COMPAT_SCOPE.resourceId,
      LIQSENSE_COMPAT_PROFILE
    );
    await expect(
      unlockVaultFromPasskeyEnvelope(
        encryptedVaultKey,
        FIXTURE_PRF_OUTPUT,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).resolves.toBeInstanceOf(CryptoKey);

    const envelope = await createPasskeyPrfEnvelope(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    await expect(
      unlockVaultFromPasskeyEnvelope(
        envelope,
        FIXTURE_PRF_OUTPUT,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).resolves.toBeInstanceOf(CryptoKey);
  });
});

describe("AAD and KDF validation branches", () => {
  async function makePayloads() {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const payload = {
      ...envelope.encryptedVaultKey,
      aad: {
        ...envelope.encryptedVaultKey.aad,
        field: "vault_payload" as const,
        context: LIQSENSE_COMPAT_PROFILE.aadContextVault,
      },
    };
    return { envelope, payload };
  }

  it("rejects every mismatched key AAD field", async () => {
    const { envelope } = await makePayloads();
    const original = envelope.encryptedVaultKey;
    expect(() => assertVaultKeyAad(LIQSENSE_COMPAT_SCOPE.userId, original, LIQSENSE_COMPAT_PROFILE)).not.toThrow();
    for (const [property, value, message] of [
      ["userId", OTHER_ID, "userId"],
      ["resourceId", OTHER_ID, "resourceId"],
      ["field", "vault_payload", "field"],
      ["context", "other-context", "context"],
    ] as const) {
      const changed = { ...original, aad: { ...original.aad, [property]: value } } as EncryptedVaultPayload;
      expect(() => assertVaultKeyAad(LIQSENSE_COMPAT_SCOPE, changed, LIQSENSE_COMPAT_PROFILE)).toThrow(message);
    }
  });

  it("rejects every mismatched payload AAD field", async () => {
    const { payload } = await makePayloads();
    expect(() => assertVaultPayloadAad(LIQSENSE_COMPAT_SCOPE, payload, LIQSENSE_COMPAT_PROFILE)).not.toThrow();
    for (const [property, value, message] of [
      ["userId", OTHER_ID, "userId"],
      ["resourceId", OTHER_ID, "resourceId"],
      ["field", "vault_key", "field"],
      ["context", "other-context", "context"],
    ] as const) {
      const changed = { ...payload, aad: { ...payload.aad, [property]: value } } as EncryptedVaultPayload;
      expect(() => assertVaultPayloadAad(LIQSENSE_COMPAT_SCOPE, changed, LIQSENSE_COMPAT_PROFILE)).toThrow(message);
    }
  });

  it("enforces every Argon2id resource bound", async () => {
    const valid = { memory: 65536, iterations: 3, parallelism: 1 };
    expect(() => assertSafeArgon2idParams(valid)).not.toThrow();
    for (const [property, value] of [
      ["memory", ARGON2ID_LIMITS.memory.min - 1],
      ["memory", ARGON2ID_LIMITS.memory.max + 1],
      ["iterations", 0],
      ["iterations", ARGON2ID_LIMITS.iterations.max + 1],
      ["parallelism", 0],
      ["parallelism", ARGON2ID_LIMITS.parallelism.max + 1],
      ["memory", 1.5],
    ] as const) {
      expect(() => assertSafeArgon2idParams({ ...valid, [property]: value })).toThrow();
    }

    expect(() => assertSafeArgon2idSalt(new Uint8Array(16))).not.toThrow();
    expect(() => assertSafeArgon2idSalt(new Uint8Array(15))).toThrow();
    expect(() => assertSafeArgon2idSalt(new Uint8Array(65))).toThrow();
    expect(() => parseArgon2idMetadata({ ...serializeArgon2idMetadata(FIXTURE_ARGON2_SALT), salt: "x".repeat(129) })).toThrow(/too large/);
    await expect(
      deriveArgon2idAesKey(new Uint8Array([1]), FIXTURE_ARGON2_SALT, {
        ...valid,
        hashLength: 16,
      })
    ).rejects.toThrow(/hash length/);
  });

  it("covers password defaults, invalid metadata, and deprecated wrapping", async () => {
    const derived = await deriveVaultPasswordKey(FIXTURE_VAULT_PASSWORD);
    expect(derived.metadata.salt).toBeTruthy();
    const vaultKey = await createUserVaultKey();
    await expect(
      unlockWithPasswordEnvelope(
        FIXTURE_VAULT_PASSWORD,
        { encryptedVaultKey: {} as EncryptedVaultPayload, kdfMetadata: null } as never,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toThrow(/requires Argon2id/);

    const wrapped = await wrapVaultKeyForPassword(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    await expect(
      unlockWithPasswordEnvelope(
        FIXTURE_VAULT_PASSWORD,
        wrapped,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).resolves.toBeInstanceOf(CryptoKey);
  });
});

describe("small public utilities", () => {
  it("resolves explicit, envelope, and payload AAD contexts", () => {
    expect(resolveAadContext({ field: "vault_payload", context: "explicit" }, LIQSENSE_COMPAT_PROFILE)).toBe("explicit");
    expect(resolveAadContext({ field: "vault_key" }, LIQSENSE_COMPAT_PROFILE)).toBe(LIQSENSE_COMPAT_PROFILE.aadContextEnvelope);
    expect(resolveAadContext({ field: "vault_payload" }, LIQSENSE_COMPAT_PROFILE)).toBe(LIQSENSE_COMPAT_PROFILE.aadContextVault);
  });

  it("exports keys, random bytes, and validates schemas", async () => {
    const key = await createUserVaultKey();
    expect(await exportUserVaultKey(key)).toHaveLength(32);
    const nonExtractableKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: false });
    await expect(exportUserVaultKey(nonExtractableKey)).rejects.toThrow(VaultKeyNotExtractableError);
    expect(randomBytes(17)).toHaveLength(17);
    expect(encryptedPayloadSchema.safeParse({}).success).toBe(false);
  });

  it("rejects method and KDF mismatches in envelope schemas", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    expect(storedEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(
      storedEnvelopeSchema.safeParse({ ...envelope, method: "passkey_prf" }).success
    ).toBe(false);
    expect(
      storedEnvelopeSchema.safeParse({ ...envelope, kdfMetadata: null }).success
    ).toBe(false);
    expect(
      vaultSetupEnvelopeFieldsSchema.safeParse({
        cryptoVersion: "vault-v1",
        encryptedBlob: envelope.encryptedVaultKey,
        passwordEnvelope: { ...envelope, method: "recovery_phrase" },
        recoveryEnvelope: { ...envelope, method: "password" },
      }).success
    ).toBe(false);
  });

  it("normalizes non-Error Web Crypto decryption failures", async () => {
    vi.spyOn(crypto.subtle, "decrypt").mockRejectedValue("crypto failure");
    await expect(
      decryptField(
        {
          version: "enc-v1",
          alg: "AES-GCM",
          iv: "AA",
          ciphertext: "AA",
          aad: {
            ...LIQSENSE_COMPAT_SCOPE,
            field: "vault_payload",
            context: LIQSENSE_COMPAT_PROFILE.aadContextVault,
          },
        },
        await createUserVaultKey()
      )
    ).rejects.toThrow("Decryption failed");
  });

  it("builds custom and deprecated recovery kits", () => {
    const custom = createRecoveryKitText({
      recoveryPhrase: FIXTURE_12_WORD_PHRASE,
      wordCount: 12,
      productName: "Vault",
      warnings: ["Custom warning"],
    });
    expect(custom).toContain("Custom warning");
    expect(buildRecoveryKitContent(FIXTURE_12_WORD_PHRASE, { wordCount: 12, productName: "Vault" })).toContain("Store this offline");
  });

  it("scans and detects sentinels in both result states", () => {
    expect(scanForSentinels({ note: SENTINEL_PRIVATE_NOTE })).toContain(SENTINEL_PRIVATE_NOTE);
    expect(validateNoPlaintextLeak({ note: SENTINEL_PRIVATE_NOTE }).ok).toBe(false);
    expect(containsSentinel(`prefix-${SENTINEL_PRIVATE_NOTE}`)).toBe(true);
    expect(containsSentinel("safe")).toBe(false);
  });

  it("constructs exported domain errors", () => {
    expect(new VaultConflictError("conflict").name).toBe("VaultConflictError");
    expect(new VaultNotFoundError("missing").name).toBe("VaultNotFoundError");
    expect(new PasskeyPrfRequiredError("required").name).toBe("PasskeyPrfRequiredError");
    expect(new PasskeyUnlockError("failed").name).toBe("PasskeyUnlockError");
    expect(new RecoveryPhraseConfirmationError("failed").name).toBe("RecoveryPhraseConfirmationError");
  });
});
