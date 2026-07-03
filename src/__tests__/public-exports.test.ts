import { describe, expect, it } from "vitest";
import {
  assertInnerVaultKeyBlobMatchesVaultKey,
  extractInnerVaultKeyBlob,
  rewrapInnerVaultKeyMaterialForDerivedKeys,
  rewrapEncryptedVaultKeyForDerivedKeys,
  wrapUserVaultKeyWithPrfOutput,
  unwrapUserVaultKeyWithPrfOutput,
  extractPasskeyPrfOutput,
  prfBytesForAes256Import,
  type WrapUserVaultKeyOptions,
} from "../index.js";

describe("public vault-key envelope exports", () => {
  it("exports vault-key envelope helpers from the package root", () => {
    expect(typeof assertInnerVaultKeyBlobMatchesVaultKey).toBe("function");
    expect(typeof extractInnerVaultKeyBlob).toBe("function");
    expect(typeof rewrapInnerVaultKeyMaterialForDerivedKeys).toBe("function");
    expect(typeof rewrapEncryptedVaultKeyForDerivedKeys).toBe("function");
    expect(typeof wrapUserVaultKeyWithPrfOutput).toBe("function");
    expect(typeof unwrapUserVaultKeyWithPrfOutput).toBe("function");
    expect(typeof extractPasskeyPrfOutput).toBe("function");
    expect(typeof prfBytesForAes256Import).toBe("function");
  });

  it("exports WrapUserVaultKeyOptions as a type", () => {
    const options: WrapUserVaultKeyOptions = { innerVaultKeyBlob: new Uint8Array(32) };
    expect(options.innerVaultKeyBlob).toBeInstanceOf(Uint8Array);
  });
});
