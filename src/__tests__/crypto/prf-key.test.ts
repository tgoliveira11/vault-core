import { afterEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { importPrfAesGcmKey, importPrfAesKwKey } from "../../crypto/prf-key.js";

afterEach(() => vi.restoreAllMocks());

describe("PRF Web Crypto imports", () => {
  it.each([
    ["AES-GCM", importPrfAesGcmKey],
    ["AES-KW", importPrfAesKwKey],
  ] as const)("imports %s from a zeroed internal snapshot", async (name, importKey) => {
    const callerBytes = new Uint8Array(48).fill(0x5a);
    let importedBytes: Uint8Array | undefined;
    vi.spyOn(crypto.subtle, "importKey").mockImplementation(async (
      _format: KeyFormat,
      keyData: BufferSource
    ) => {
      importedBytes = keyData as Uint8Array;
      expect(importedBytes).toEqual(new Uint8Array(32).fill(0x5a));
      return {} as CryptoKey;
    });

    await importKey(callerBytes);

    expect(importedBytes).toEqual(new Uint8Array(32));
    expect(callerBytes).toEqual(new Uint8Array(48).fill(0x5a));
    expect(crypto.subtle.importKey).toHaveBeenCalledWith(
      "raw",
      expect.any(Uint8Array),
      { name, length: 256 },
      false,
      name === "AES-GCM" ? ["encrypt", "decrypt"] : ["wrapKey", "unwrapKey"]
    );
  });

  it("zeroes the snapshot when Web Crypto rejects and rejects short material before import", async () => {
    let importedBytes: Uint8Array | undefined;
    vi.spyOn(crypto.subtle, "importKey").mockImplementation(async (
      _format: KeyFormat,
      keyData: BufferSource
    ) => {
      importedBytes = keyData as Uint8Array;
      throw new Error("import failed");
    });

    await expect(importPrfAesGcmKey(new Uint8Array(32).fill(7))).rejects.toThrow("import failed");
    expect(importedBytes).toEqual(new Uint8Array(32));

    await expect(importPrfAesKwKey(new Uint8Array(31))).rejects.toThrow(/at least 32/);
    expect(crypto.subtle.importKey).toHaveBeenCalledTimes(1);
  });

  it("accepts a Uint8Array from another JavaScript realm", async () => {
    const crossRealm = runInNewContext("new Uint8Array(32).fill(9)") as Uint8Array;
    expect(crossRealm instanceof Uint8Array).toBe(false);
    await expect(importPrfAesGcmKey(crossRealm)).resolves.toMatchObject({
      algorithm: { name: "AES-GCM" },
    });
    await expect(importPrfAesKwKey(
      new Uint8ClampedArray(32) as unknown as Uint8Array
    )).rejects.toThrow(/at least 32/);
  });
});
