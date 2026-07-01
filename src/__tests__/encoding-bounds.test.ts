import { describe, expect, it } from "vitest";
import {
  MAX_VAULT_CIPHERTEXT_BYTES,
  MAX_VAULT_IV_BYTES,
  VaultPayloadSizeError,
} from "../index.js";
import { bytesToBase64Url, decodeBoundedBase64Url } from "../crypto/encoding.js";
import { decryptField, encryptField, generateAesKey } from "../crypto/aes-gcm.js";
import {
  LIQSENSE_COMPAT_PROFILE,
  LIQSENSE_COMPAT_SCOPE,
} from "../testing/fixtures/liqsense-compat.js";

describe("bounded base64url decoding", () => {
  it("decodes valid fields within limits", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const encoded = bytesToBase64Url(bytes);
    expect(decodeBoundedBase64Url(encoded, MAX_VAULT_IV_BYTES)).toEqual(bytes);
  });

  it("rejects encoded strings that exceed the max byte budget", () => {
    const oversized = "A".repeat(20);
    expect(() => decodeBoundedBase64Url(oversized, MAX_VAULT_IV_BYTES)).toThrow(
      VaultPayloadSizeError
    );
  });

  it("rejects decoded output larger than max bytes", () => {
    const bytes = new Uint8Array(MAX_VAULT_IV_BYTES + 1);
    const encoded = bytesToBase64Url(bytes);
    expect(() => decodeBoundedBase64Url(encoded, MAX_VAULT_IV_BYTES)).toThrow(
      VaultPayloadSizeError
    );
  });

  it("rejects invalid base64url input", () => {
    expect(() => decodeBoundedBase64Url("%%%", MAX_VAULT_IV_BYTES)).toThrow(
      VaultPayloadSizeError
    );
  });
});

describe("decryptField payload bounds", () => {
  it("rejects ciphertext fields larger than the configured maximum", async () => {
    const key = await generateAesKey();
    const payload = await encryptField("hello", key, {
      ...LIQSENSE_COMPAT_SCOPE,
      field: "vault_payload",
    }, LIQSENSE_COMPAT_PROFILE);

    const oversized = bytesToBase64Url(new Uint8Array(MAX_VAULT_CIPHERTEXT_BYTES + 1));
    await expect(
      decryptField({ ...payload, ciphertext: oversized }, key)
    ).rejects.toThrow(VaultPayloadSizeError);
  });
});
