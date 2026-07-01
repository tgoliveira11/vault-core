import { describe, expect, it, vi } from "vitest";
import {
  createPasswordEnvelope,
  createPasskeyPrfEnvelope,
  createUserVaultKey,
  deriveVaultPasswordKeyFromMetadata,
  deriveVaultPasswordKeyPairFromMetadata,
  encryptField,
  exportAesKey,
  generateAesKey,
  importAesKey,
  importUserVaultKey,
  unlockWithPasswordEnvelope,
  userVaultKeysEqual,
  VaultAuthorizationError,
  VaultKeyNotExtractableError,
  assertUserVaultKeyNonExtractable,
  exportUserVaultKey,
} from "../index.js";
import {
  extractInnerVaultKeyBlob,
  rewrapInnerVaultKeyMaterialForDerivedKeys,
  unwrapUserVaultKeyWithPrfOutput,
} from "../crypto/vault-key-envelope.js";
import { generateUserVaultAesKey } from "../crypto/user-vault-key-crypto.js";
import { bytesToBase64Url } from "../crypto/encoding.js";
import {
  FIXTURE_ARGON2_SALT,
  FIXTURE_PRF_OUTPUT,
  FIXTURE_UVK_BYTES,
  FIXTURE_VAULT_PASSWORD,
  LIQSENSE_COMPAT_PROFILE,
  LIQSENSE_COMPAT_SCOPE,
} from "../testing/fixtures/liqsense-compat.js";

describe("non-extractable user vault key", () => {
  it("wraps and unwraps via AES-KW in password envelopes", async () => {
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

    expect(await userVaultKeysEqual(vaultKey, unlocked)).toBe(true);
    await expect(exportUserVaultKey(unlocked)).rejects.toThrow(VaultKeyNotExtractableError);
  });

  it("rejects envelope creation for non-extractable keys without inner blob", async () => {
    const key = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: false });
    await expect(
      createPasswordEnvelope(
        key,
        FIXTURE_VAULT_PASSWORD,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE,
        FIXTURE_ARGON2_SALT
      )
    ).rejects.toThrow(VaultKeyNotExtractableError);
  });

  it("reuses a pre-wrapped inner blob when provided", async () => {
    const vaultKey = await createUserVaultKey();
    const { envelope: first, kdfMetadata } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const oldKeys = await deriveVaultPasswordKeyPairFromMetadata(
      FIXTURE_VAULT_PASSWORD,
      kdfMetadata
    );
    const inner = await extractInnerVaultKeyBlob(
      first.encryptedVaultKey,
      oldKeys.encryptionKey
    );

    const { envelope: second } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT,
      { innerVaultKeyBlob: inner }
    );

    const unlocked = await unlockWithPasswordEnvelope(
      FIXTURE_VAULT_PASSWORD,
      second,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(await userVaultKeysEqual(vaultKey, unlocked)).toBe(true);
  });

  it("rejects re-wrap when inner blob does not match the vault key", async () => {
    const vaultKey = await createUserVaultKey();
    const otherKey = await createUserVaultKey();
    const { envelope, kdfMetadata } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const keys = await deriveVaultPasswordKeyPairFromMetadata(
      FIXTURE_VAULT_PASSWORD,
      kdfMetadata
    );
    const inner = await extractInnerVaultKeyBlob(
      envelope.encryptedVaultKey,
      keys.encryptionKey
    );

    await expect(
      createPasswordEnvelope(
        otherKey,
        FIXTURE_VAULT_PASSWORD,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE,
        FIXTURE_ARGON2_SALT,
        { innerVaultKeyBlob: inner }
      )
    ).rejects.toThrow(VaultAuthorizationError);
  });

  it("rejects re-wrap when the session key does not match", async () => {
    const vaultKey = await createUserVaultKey();
    const otherKey = await createUserVaultKey();
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const oldKeys = await deriveVaultPasswordKeyPairFromMetadata(
      FIXTURE_VAULT_PASSWORD,
      envelope.kdfMetadata
    );
    const inner = await extractInnerVaultKeyBlob(
      envelope.encryptedVaultKey,
      oldKeys.encryptionKey
    );
    const newKeys = await deriveVaultPasswordKeyPairFromMetadata(
      "different-password",
      envelope.kdfMetadata
    );

    await expect(
      rewrapInnerVaultKeyMaterialForDerivedKeys(
        inner,
        oldKeys,
        newKeys,
        otherKey
      )
    ).rejects.toThrow(VaultAuthorizationError);
  });

  it("unwraps legacy passkey envelopes with 32-byte inner material", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const prfKey = await crypto.subtle.importKey(
      "raw",
      FIXTURE_PRF_OUTPUT.slice(0, 32),
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    const encryptedVaultKey = await encryptField(
      bytesToBase64Url(FIXTURE_UVK_BYTES),
      prfKey,
      { ...LIQSENSE_COMPAT_SCOPE, field: "vault_key" },
      LIQSENSE_COMPAT_PROFILE
    );

    const unlocked = await unwrapUserVaultKeyWithPrfOutput(
      encryptedVaultKey,
      FIXTURE_PRF_OUTPUT,
      prfKey
    );
    expect(await userVaultKeysEqual(vaultKey, unlocked)).toBe(true);
  });

  it("covers low-level AES helpers and generateUserVaultAesKey", async () => {
    const aesKey = await generateAesKey();
    const raw = await exportAesKey(aesKey);
    expect(raw).toHaveLength(32);
    const imported = await importAesKey(raw);
    expect(await userVaultKeysEqual(aesKey, imported)).toBe(true);
    const uvk = await generateUserVaultAesKey();
    expect(uvk.type).toBe("secret");
  });

  it("derives password keys from persisted metadata", async () => {
    const { envelope } = await createPasswordEnvelope(
      await createUserVaultKey(),
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    const derived = await deriveVaultPasswordKeyFromMetadata(
      FIXTURE_VAULT_PASSWORD,
      envelope.kdfMetadata
    );
    expect(derived.type).toBe("secret");
    const pair = await deriveVaultPasswordKeyPairFromMetadata(
      FIXTURE_VAULT_PASSWORD,
      envelope.kdfMetadata
    );
    expect(pair.encryptionKey).toBeDefined();
    expect(pair.wrappingKey).toBeDefined();
  });

  it("rethrows unexpected export failures during key comparison", async () => {
    const key = await createUserVaultKey();
    vi.spyOn(crypto.subtle, "exportKey").mockRejectedValueOnce(new Error("unexpected export failure"));
    await expect(userVaultKeysEqual(key, key)).rejects.toThrow("unexpected export failure");
    vi.restoreAllMocks();
  });

  it("compares different non-extractable keys via encrypt probe", async () => {
    const a = await importUserVaultKey(crypto.getRandomValues(new Uint8Array(32)), {
      extractable: false,
    });
    const b = await importUserVaultKey(crypto.getRandomValues(new Uint8Array(32)), {
      extractable: false,
    });
    expect(await userVaultKeysEqual(a, b)).toBe(false);
  });

  it("rethrows unexpected exportUserVaultKey failures", async () => {
    const key = await createUserVaultKey();
    vi.spyOn(crypto.subtle, "exportKey").mockRejectedValueOnce(new Error("unexpected export failure"));
    await expect(exportUserVaultKey(key)).rejects.toThrow("unexpected export failure");
    vi.restoreAllMocks();
  });

  it("treats non-Error export failures as unexpected", async () => {
    const key = await createUserVaultKey();
    vi.spyOn(crypto.subtle, "exportKey").mockRejectedValueOnce("not-an-error");
    await expect(exportUserVaultKey(key)).rejects.toEqual("not-an-error");
    vi.restoreAllMocks();
  });

  it("rejects extractable keys for session storage", async () => {
    const extractable = await createUserVaultKey();
    await expect(assertUserVaultKeyNonExtractable(extractable)).rejects.toThrow(
      VaultAuthorizationError
    );
    const nonExtractable = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: false });
    await expect(assertUserVaultKeyNonExtractable(nonExtractable)).resolves.toBeUndefined();
  });

  it("rethrows unexpected errors from assertUserVaultKeyNonExtractable", async () => {
    const key = await createUserVaultKey();
    vi.spyOn(crypto.subtle, "exportKey").mockRejectedValueOnce(new Error("unexpected export failure"));
    await expect(assertUserVaultKeyNonExtractable(key)).rejects.toThrow("unexpected export failure");
    vi.restoreAllMocks();
  });

  it("creates passkey envelopes with AES-KW inner wrap", async () => {
    const vaultKey = await createUserVaultKey();
    const envelope = await createPasskeyPrfEnvelope(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(envelope.method).toBe("passkey_prf");
  });
});
