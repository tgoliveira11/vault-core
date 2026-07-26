import { describe, expect, it } from "vitest";
import {
  vaultPasskeyCredentialMetadataSchema,
  vaultPasskeyCredentialStateSchema,
} from "../../passkey/model.js";
import { createPasskeyPrfEnvelope, createUserVaultKey } from "../../index.js";

const userId = "00000000-0000-4000-8000-000000000001";
const scope = { userId, resourceId: userId };
const profile = {
  cryptoVersion: "vault-v1" as const,
  aadContextVault: "test:vault:v1",
  aadContextEnvelope: "test:envelope:v1",
};

describe("vault passkey portable model", () => {
  it("supports one synced credential with many bindings and envelope variants", async () => {
    const vaultKey = await createUserVaultKey();
    const first = await createPasskeyPrfEnvelope(vaultKey, new Uint8Array(32).fill(1), scope, profile);
    const second = await createPasskeyPrfEnvelope(vaultKey, new Uint8Array(32).fill(2), scope, profile);
    const state = vaultPasskeyCredentialStateSchema.parse({
      credential: {
        credentialId: "credential-1",
        transports: ["internal", "hybrid"],
        credentialDeviceType: "multiDevice",
        backupEligible: true,
        credentialBackedUp: true,
      },
      bindings: [
        { bindingId: "browser-a", credentialId: "credential-1", selectedEnvelopeVariantId: "variant-a" },
        { bindingId: "browser-b", credentialId: "credential-1", selectedEnvelopeVariantId: "variant-b" },
      ],
      envelopeVariants: [
        { envelopeVariantId: "variant-a", credentialId: "credential-1", envelope: first },
        { envelopeVariantId: "variant-b", credentialId: "credential-1", envelope: second },
      ],
    });
    expect(state.bindings).toHaveLength(2);
    expect(state.envelopeVariants).toHaveLength(2);
  });

  it("rejects inconsistent backup metadata and duplicate transports", () => {
    expect(vaultPasskeyCredentialMetadataSchema.safeParse({
      credentialId: " credential-1",
    }).success).toBe(false);
    expect(vaultPasskeyCredentialMetadataSchema.safeParse({
      credentialId: "credential-1",
      credentialDeviceType: "singleDevice",
      backupEligible: true,
    }).success).toBe(false);
    expect(vaultPasskeyCredentialMetadataSchema.safeParse({
      credentialId: "credential-1",
      credentialDeviceType: "multiDevice",
      backupEligible: false,
    }).success).toBe(false);
    expect(vaultPasskeyCredentialMetadataSchema.safeParse({
      credentialId: "credential-1",
      credentialDeviceType: "singleDevice",
      credentialBackedUp: true,
    }).success).toBe(false);
    expect(vaultPasskeyCredentialMetadataSchema.safeParse({
      credentialId: "credential-1",
      transports: ["usb", "usb"],
    }).success).toBe(false);
  });

  it("rejects cross-credential, duplicate, and missing variant references", async () => {
    const vaultKey = await createUserVaultKey();
    const envelope = await createPasskeyPrfEnvelope(vaultKey, new Uint8Array(32).fill(3), scope, profile);
    const result = vaultPasskeyCredentialStateSchema.safeParse({
      credential: { credentialId: "credential-1" },
      bindings: [
        { bindingId: "same", credentialId: "credential-2", selectedEnvelopeVariantId: "missing" },
        { bindingId: "same", credentialId: "credential-1" },
      ],
      envelopeVariants: [
        { envelopeVariantId: "same-variant", credentialId: "credential-2", envelope },
        { envelopeVariantId: "same-variant", credentialId: "credential-1", envelope },
      ],
    });
    expect(result.success).toBe(false);
  });
});
