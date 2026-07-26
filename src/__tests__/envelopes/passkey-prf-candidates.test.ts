import { describe, expect, it, vi } from "vitest";
import { createUserVaultKey } from "../../keys/user-vault-key.js";
import { createPasskeyPrfEnvelope } from "../../envelopes/passkey-prf.js";
import {
  MAX_PASSKEY_PRF_ENVELOPE_CANDIDATES,
  unlockWithPasskeyPrfEnvelopeCandidates,
} from "../../envelopes/passkey-prf-candidates.js";

const userId = "00000000-0000-4000-8000-000000000001";
const scope = { userId, resourceId: userId };
const profile = {
  cryptoVersion: "vault-v1" as const,
  aadContextVault: "test:vault:v1",
  aadContextEnvelope: "test:envelope:v1",
};
const credentialId = "credential-1";
const firstPrf = new Uint8Array(32).fill(0x11);
const secondPrf = new Uint8Array(32).fill(0x22);
const missingPrf = new Uint8Array(32).fill(0x33);

async function fixtures() {
  const vaultKey = await createUserVaultKey();
  const first = await createPasskeyPrfEnvelope(vaultKey, firstPrf, scope, profile);
  const second = await createPasskeyPrfEnvelope(vaultKey, secondPrf, scope, profile);
  return {
    candidates: [
      { envelopeVariantId: "variant-a", credentialId, envelope: first },
      { envelopeVariantId: "variant-b", credentialId, envelope: second },
    ],
  };
}

describe("unlockWithPasskeyPrfEnvelopeCandidates", () => {
  it("matches the first or a later envelope variant", async () => {
    const { candidates } = await fixtures();
    const first = await unlockWithPasskeyPrfEnvelopeCandidates({
      verifiedCredentialId: credentialId,
      candidates,
      prfOutput: firstPrf,
      expectedScope: scope,
      profile,
    });
    expect(first).toMatchObject({ status: "matched", envelopeVariantId: "variant-a" });
    if (first.status === "matched") expect(first.vaultKey.extractable).toBe(false);

    const later = await unlockWithPasskeyPrfEnvelopeCandidates({
      verifiedCredentialId: credentialId,
      candidates,
      prfOutput: secondPrf,
      expectedScope: scope,
      profile,
    });
    expect(later).toMatchObject({ status: "matched", envelopeVariantId: "variant-b" });
    expect(JSON.stringify(later)).not.toContain(Buffer.from(secondPrf).toString("base64"));
  });

  it("returns typed no-match and PRF-unavailable results", async () => {
    const { candidates } = await fixtures();
    await expect(unlockWithPasskeyPrfEnvelopeCandidates({
      verifiedCredentialId: credentialId,
      candidates,
      prfOutput: missingPrf,
      expectedScope: scope,
      profile,
    })).resolves.toEqual({ status: "no_match", attemptedCandidateCount: 2 });
    await expect(unlockWithPasskeyPrfEnvelopeCandidates({
      verifiedCredentialId: credentialId,
      candidates: [],
      prfOutput: null,
      expectedScope: scope,
      profile,
    })).resolves.toEqual({ status: "prf_unavailable" });
  });

  it("rejects oversized, malformed, duplicate, cross-credential, and wrong-scope candidates", async () => {
    const { candidates } = await fixtures();
    const cases = [
      {
        candidates: Array.from(
          { length: MAX_PASSKEY_PRF_ENVELOPE_CANDIDATES + 1 },
          () => candidates[0]
        ),
        reason: "candidate_limit_exceeded",
      },
      { candidates: [{ nope: true }], reason: "invalid_candidate" },
      {
        candidates: [{
          ...candidates[0],
          envelope: {
            ...candidates[0]!.envelope,
            encryptedVaultKey: {
              ...candidates[0]!.envelope.encryptedVaultKey,
              iv: "#",
            },
          },
        }],
        reason: "invalid_candidate",
      },
      { candidates: [candidates[0], candidates[0]], reason: "duplicate_variant_id" },
      {
        candidates: [{ ...candidates[0], credentialId: "credential-2" }],
        reason: "credential_mismatch",
      },
      {
        candidates: [{
          ...candidates[0],
          envelope: {
            ...candidates[0]!.envelope,
            encryptedVaultKey: {
              ...candidates[0]!.envelope.encryptedVaultKey,
              aad: { ...candidates[0]!.envelope.encryptedVaultKey.aad, userId: "00000000-0000-4000-8000-000000000002" },
            },
          },
        }],
        reason: "scope_mismatch",
      },
      {
        candidates: [{
          ...candidates[0],
          envelope: {
            ...candidates[0]!.envelope,
            encryptedVaultKey: {
              ...candidates[0]!.envelope.encryptedVaultKey,
              aad: {
                ...candidates[0]!.envelope.encryptedVaultKey.aad,
                context: "wrong:envelope:v1",
              },
            },
          },
        }],
        reason: "scope_mismatch",
      },
    ];

    for (const testCase of cases) {
      await expect(unlockWithPasskeyPrfEnvelopeCandidates({
        verifiedCredentialId: credentialId,
        candidates: testCase.candidates,
        prfOutput: firstPrf,
        expectedScope: scope,
        profile,
      })).resolves.toMatchObject({ status: "malformed_candidate", reason: testCase.reason });
    }
  });

  it("accepts missing/null legacy context but rejects arbitrary explicit contexts", async () => {
    const { candidates } = await fixtures();
    const base = candidates[0]!;

    for (const context of [undefined, null] as const) {
      const legacyCandidate = {
        ...base,
        envelope: {
          ...base.envelope,
          encryptedVaultKey: {
            ...base.envelope.encryptedVaultKey,
            aad: {
              ...base.envelope.encryptedVaultKey.aad,
              context,
            },
          },
        },
      };
      await expect(unlockWithPasskeyPrfEnvelopeCandidates({
        verifiedCredentialId: credentialId,
        candidates: [legacyCandidate],
        prfOutput: firstPrf,
        expectedScope: scope,
        profile,
      })).resolves.toMatchObject({ status: "matched", envelopeVariantId: "variant-a" });
    }

    const explicitCandidate = {
      ...base,
      envelope: {
        ...base.envelope,
        encryptedVaultKey: {
          ...base.envelope.encryptedVaultKey,
          aad: {
            ...base.envelope.encryptedVaultKey.aad,
            context: "test:legacy-envelope:v0",
          },
        },
      },
    };

    await expect(unlockWithPasskeyPrfEnvelopeCandidates({
      verifiedCredentialId: credentialId,
      candidates: [explicitCandidate],
      prfOutput: firstPrf,
      expectedScope: scope,
      profile,
    })).resolves.toMatchObject({
      status: "malformed_candidate",
      reason: "scope_mismatch",
    });

    await expect(unlockWithPasskeyPrfEnvelopeCandidates({
      verifiedCredentialId: credentialId,
      candidates: [explicitCandidate],
      prfOutput: firstPrf,
      expectedScope: scope,
      profile: { ...profile, legacyVaultKeyAadContexts: ["test:legacy-envelope:v0"] },
    })).resolves.toMatchObject({ status: "matched", envelopeVariantId: "variant-a" });
  });

  it("returns a typed crypto failure without exposing the thrown error", async () => {
    const { candidates } = await fixtures();
    const spy = vi.spyOn(crypto.subtle, "importKey").mockRejectedValueOnce(new TypeError("secret detail"));
    try {
      const result = await unlockWithPasskeyPrfEnvelopeCandidates({
        verifiedCredentialId: credentialId,
        candidates,
        prfOutput: firstPrf,
        expectedScope: scope,
        profile,
      });
      expect(result).toEqual({
        status: "crypto_failure",
        reason: "crypto_unavailable",
        candidateIndex: 0,
      });
      expect(JSON.stringify(result)).not.toContain("secret detail");
    } finally {
      spy.mockRestore();
    }
  });

  it("classifies non-Error crypto failures without leaking them", async () => {
    const { candidates } = await fixtures();
    const spy = vi.spyOn(crypto.subtle, "importKey").mockRejectedValueOnce("internal failure");
    try {
      await expect(unlockWithPasskeyPrfEnvelopeCandidates({
        verifiedCredentialId: credentialId,
        candidates,
        prfOutput: firstPrf,
        expectedScope: scope,
        profile,
      })).resolves.toEqual({
        status: "crypto_failure",
        reason: "unexpected_crypto_error",
        candidateIndex: 0,
      });
    } finally {
      spy.mockRestore();
    }
  });
});
