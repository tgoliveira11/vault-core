import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptField } from "../crypto/aes-gcm.js";
import { bytesToBase64Url } from "../crypto/encoding.js";
import {
  unwrapUserVaultKeyWithDerivedKeys,
} from "../crypto/vault-key-envelope.js";
import { createPasswordEnvelope } from "../envelopes/password.js";
import { deriveVaultPasswordKeyPairFromMetadata } from "../kdf/argon2id.js";
import { createUserVaultKey } from "../keys/user-vault-key.js";

const profile = {
  cryptoVersion: "vault-v1",
  aadContextEnvelope: "inner-zeroization-envelope-v1",
  aadContextVault: "inner-zeroization-vault-v1",
} as const;

const scope = {
  userId: "inner-zeroization-user",
  resourceId: "inner-zeroization-resource",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("decrypted inner vault-key zeroization", () => {
  it("zeroes inner bytes after ordinary unwrap discards them", async () => {
    const password = "ordinary unwrap zeroization password";
    const created = await createPasswordEnvelope(
      await createUserVaultKey(),
      password,
      scope,
      profile
    );
    const keys = await deriveVaultPasswordKeyPairFromMetadata(password, created.kdfMetadata);
    const fill = vi.spyOn(Uint8Array.prototype, "fill");

    await unwrapUserVaultKeyWithDerivedKeys(created.envelope.encryptedVaultKey, keys);

    expect(fill).toHaveBeenCalledWith(0);
  });

  it("zeroes decrypted inner bytes when key unwrap fails", async () => {
    const password = "failed unwrap zeroization password";
    const created = await createPasswordEnvelope(
      await createUserVaultKey(),
      password,
      scope,
      profile
    );
    const keys = await deriveVaultPasswordKeyPairFromMetadata(password, created.kdfMetadata);
    const malformedInner = new Uint8Array(41).fill(7);
    const encryptedVaultKey = await encryptField(
      bytesToBase64Url(malformedInner),
      keys.encryptionKey,
      { ...scope, field: "vault_key" },
      profile
    );
    const fill = vi.spyOn(Uint8Array.prototype, "fill");

    await expect(unwrapUserVaultKeyWithDerivedKeys(encryptedVaultKey, keys)).rejects.toThrow();

    expect(fill).toHaveBeenCalledWith(0);
  });
});
