import { describe, expect, it } from "vitest";
import { assertSafeVaultPublicMetadata } from "../../validation/public-metadata.js";

describe("assertSafeVaultPublicMetadata", () => {
  it("accepts bounded JSON metadata including shared non-circular objects", () => {
    const shared = { enabled: true };
    expect(() => assertSafeVaultPublicMetadata({
      credentialId: "credential-1",
      prfRequired: true,
      attempts: 1,
      nullable: null,
      list: ["a", false, shared],
      shared,
    })).not.toThrow();
  });

  it.each([
    [{ password: "secret" }, /Plaintext field/],
    [{ invalid: undefined }, /JSON values only/],
    [{ invalid: Number.POSITIVE_INFINITY }, /JSON values only/],
    [{ invalid: new Date() }, /plain objects only/],
    [{ invalid: Array.from({ length: 65 }, () => 1) }, /array length/],
    [Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`k${index}`, index])), /object size/],
    [{ ["x".repeat(129)]: true }, /invalid key/],
    [{ "": true }, /invalid key/],
    [{ large: "x".repeat(4_096) }, /4096 bytes/],
  ])("rejects unsafe metadata %#", (metadata, message) => {
    expect(() => assertSafeVaultPublicMetadata(metadata as Record<string, unknown>)).toThrow(message);
  });

  it("rejects excessive depth and circular references", () => {
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let index = 0; index < 8; index += 1) {
      const next: Record<string, unknown> = {};
      cursor.next = next;
      cursor = next;
    }
    expect(() => assertSafeVaultPublicMetadata(deep)).toThrow(/maximum depth/);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => assertSafeVaultPublicMetadata(cyclic)).toThrow(/circular/);
  });

  it("rejects non-object metadata received from untyped JavaScript", () => {
    expect(() => assertSafeVaultPublicMetadata(null as unknown as Record<string, unknown>))
      .toThrow(/plain object/);
    expect(() => assertSafeVaultPublicMetadata([] as unknown as Record<string, unknown>))
      .toThrow(/plain object/);
  });
});
