import { describe, expect, it } from "vitest";
import {
  PasskeyUnlockError,
  VaultAuthorizationError,
  VaultKeyNotExtractableError,
} from "../../errors/vault-errors.js";
import { INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE } from "../../session/inner-key-material-cache.js";
import {
  classifyPasskeyCryptoError,
  getDefaultPasskeyCryptoErrorMessage,
} from "../../errors/passkey-crypto-failure.js";

describe("classifyPasskeyCryptoError", () => {
  it("classifies non-extractable vault keys as rewrap_requires_unlock", () => {
    expect(classifyPasskeyCryptoError(new VaultKeyNotExtractableError())).toBe(
      "rewrap_requires_unlock"
    );
  });

  it("classifies stale inner-key cache mismatches as rewrap_requires_unlock", () => {
    expect(
      classifyPasskeyCryptoError(new Error(INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE))
    ).toBe("rewrap_requires_unlock");
  });

  it("classifies inner blob authorization failures as rewrap_requires_unlock", () => {
    expect(
      classifyPasskeyCryptoError(
        new VaultAuthorizationError("Inner vault key blob does not match the session vault key")
      )
    ).toBe("rewrap_requires_unlock");
  });

  it("classifies explicit PRF mismatch copy as prf_mismatch", () => {
    expect(classifyPasskeyCryptoError(new Error("PRF mismatch for this credential"))).toBe(
      "prf_mismatch"
    );
    expect(classifyPasskeyCryptoError(new Error("Wrong passkey selected"))).toBe("prf_mismatch");
  });

  it("classifies PasskeyUnlockError and subtle crypto failures as decrypt_failed", () => {
    expect(
      classifyPasskeyCryptoError(
        new PasskeyUnlockError("Could not decrypt your vault with this passkey")
      )
    ).toBe("decrypt_failed");
    expect(classifyPasskeyCryptoError(new DOMException("decrypt", "OperationError"))).toBe(
      "decrypt_failed"
    );
    expect(classifyPasskeyCryptoError(new DOMException("bad data", "DataError"))).toBe(
      "decrypt_failed"
    );
    expect(classifyPasskeyCryptoError(new Error("Decrypt failed during unwrap"))).toBe(
      "decrypt_failed"
    );
  });

  it("defaults unknown failures to unknown", () => {
    expect(classifyPasskeyCryptoError(new Error("network timeout"))).toBe("unknown");
    expect(classifyPasskeyCryptoError("unexpected")).toBe("unknown");
  });
});

describe("getDefaultPasskeyCryptoErrorMessage", () => {
  it("returns neutral English defaults for each kind", () => {
    expect(getDefaultPasskeyCryptoErrorMessage("prf_mismatch")).toMatch(/encryption key/i);
    expect(getDefaultPasskeyCryptoErrorMessage("rewrap_requires_unlock")).toMatch(/password or recovery/i);
    expect(getDefaultPasskeyCryptoErrorMessage("decrypt_failed")).toMatch(/decrypt/i);
    expect(getDefaultPasskeyCryptoErrorMessage("unknown")).toMatch(/try again/i);
  });

  it("returns English defaults for unsupported locales until translations ship", () => {
    const english = getDefaultPasskeyCryptoErrorMessage("decrypt_failed");
    expect(getDefaultPasskeyCryptoErrorMessage("decrypt_failed", "pt-BR")).toBe(english);
  });
});
