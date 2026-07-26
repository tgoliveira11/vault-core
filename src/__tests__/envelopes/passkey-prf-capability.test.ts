import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPrfExtensionHeuristicallyAvailable,
  isPrfExtensionSupported,
} from "../../envelopes/passkey-prf-support.js";
import { resolvePasskeyPrfCapability } from "../../envelopes/passkey-prf-capability.js";

class PrfCapablePublicKeyCredential {
  getClientExtensionResults() {}
}

describe("resolvePasskeyPrfCapability", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("distinguishes heuristic and unavailable states with overrides", () => {
    expect(resolvePasskeyPrfCapability({ heuristicOverride: true })).toEqual({
      state: "heuristic",
      source: "heuristic",
    });
    expect(resolvePasskeyPrfCapability({ heuristicOverride: false })).toMatchObject({
      state: "unavailable",
      source: "heuristic",
    });
  });

  it("confirms or rejects registration results", () => {
    expect(resolvePasskeyPrfCapability({
      ceremony: "registration",
      clientExtensionResults: { prf: { enabled: true } },
    })).toEqual({ state: "confirmed_registration", source: "registration" });
    expect(resolvePasskeyPrfCapability({
      ceremony: "registration",
      clientExtensionResults: { prf: { enabled: false } },
    })).toMatchObject({ state: "unavailable", reason: "credential_prf_disabled" });
    expect(resolvePasskeyPrfCapability({ ceremony: "registration" })).toMatchObject({
      state: "incompatible",
      reason: "missing_registration_confirmation",
    });
  });

  it("confirms authentication only when usable PRF output exists", () => {
    expect(resolvePasskeyPrfCapability({
      ceremony: "authentication",
      verifiedCredentialId: "credential-1",
      clientExtensionResults: { prf: { results: { first: new ArrayBuffer(32) } } },
    })).toEqual({ state: "confirmed_authentication", source: "authentication" });
    expect(resolvePasskeyPrfCapability({
      ceremony: "authentication",
      verifiedCredentialId: "credential-1",
    })).toMatchObject({
      state: "incompatible",
      reason: "missing_authentication_result",
    });
    expect(resolvePasskeyPrfCapability({
      ceremony: "authentication",
      verifiedCredentialId: "credential-1",
      clientExtensionResults: { prf: { results: { first: new ArrayBuffer(8) } } },
    })).toMatchObject({
      state: "incompatible",
      reason: "invalid_authentication_result",
    });
    expect(resolvePasskeyPrfCapability({
      ceremony: "authentication",
      verifiedCredentialId: "credential-1",
      clientExtensionResults: {
        prf: {
          evalByCredential: {
            "credential-1": { first: new ArrayBuffer(8) },
            ignored: null,
          },
        },
      },
    })).toMatchObject({
      state: "incompatible",
      reason: "invalid_authentication_result",
    });
    expect(resolvePasskeyPrfCapability({
      ceremony: "authentication",
      verifiedCredentialId: "credential-1",
      clientExtensionResults: { prf: { evalByCredential: "invalid" } },
    })).toMatchObject({
      state: "incompatible",
      reason: "missing_authentication_result",
    });
    expect(resolvePasskeyPrfCapability({
      ceremony: "authentication",
      verifiedCredentialId: "credential-1",
      clientExtensionResults: {
        prf: {
          evalByCredential: {
            "credential-2": { first: new ArrayBuffer(32) },
          },
        },
      },
    })).toMatchObject({
      state: "incompatible",
      reason: "invalid_authentication_result",
    });
    for (const verifiedCredentialId of [undefined, "", " credential-1", "x".repeat(2049)]) {
      expect(resolvePasskeyPrfCapability({
        ceremony: "authentication",
        verifiedCredentialId,
      } as never)).toMatchObject({
        state: "incompatible",
        reason: "missing_verified_credential_id",
      });
    }
  });

  it("keeps the legacy boolean as a heuristic alias and allows the Apple workaround override", () => {
    vi.stubGlobal("PublicKeyCredential", PrfCapablePublicKeyCredential);
    const iphone17 = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)";
    expect(isPrfExtensionHeuristicallyAvailable({ userAgent: iphone17 })).toBe(false);
    expect(isPrfExtensionHeuristicallyAvailable({
      userAgent: iphone17,
      appleMobileWorkaround: false,
    })).toBe(true);
    expect(isPrfExtensionSupported({ heuristicOverride: true })).toBe(true);
  });
});
