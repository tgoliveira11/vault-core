import { z } from "zod";
import { passkeyPrfEnvelopeSchema } from "../validation/schemas.js";

export const MAX_PASSKEY_OPAQUE_ID_LENGTH = 2048;
export const MAX_PASSKEY_TRANSPORTS = 8;
export const MAX_PASSKEY_BINDINGS_PER_CREDENTIAL = 64;
export const MAX_PASSKEY_ENVELOPE_VARIANTS_PER_CREDENTIAL = 32;

export const vaultPasskeyOpaqueIdSchema = z
  .string()
  .min(1)
  .max(MAX_PASSKEY_OPAQUE_ID_LENGTH)
  .refine((value) => value.trim() === value, "Passkey opaque identifiers cannot contain surrounding whitespace");

export const webAuthnTransportSchema = z.enum([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

export const vaultPasskeyCredentialDeviceTypeSchema = z.enum(["singleDevice", "multiDevice"]);

export const vaultPasskeyCredentialMetadataSchema = z.object({
  credentialId: vaultPasskeyOpaqueIdSchema,
  transports: z.array(webAuthnTransportSchema).max(MAX_PASSKEY_TRANSPORTS).optional(),
  credentialDeviceType: vaultPasskeyCredentialDeviceTypeSchema.optional(),
  backupEligible: z.boolean().optional(),
  credentialBackedUp: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.transports && new Set(value.transports).size !== value.transports.length) {
    context.addIssue({
      code: "custom",
      message: "Passkey transports must be unique",
      path: ["transports"],
    });
  }

  if (
    value.credentialDeviceType === "singleDevice" &&
    value.backupEligible === true
  ) {
    context.addIssue({
      code: "custom",
      message: "A single-device credential cannot be backup eligible",
      path: ["backupEligible"],
    });
  }

  if (
    value.credentialDeviceType === "multiDevice" &&
    value.backupEligible === false
  ) {
    context.addIssue({
      code: "custom",
      message: "A multi-device credential must be backup eligible",
      path: ["backupEligible"],
    });
  }

  if (
    value.credentialBackedUp === true &&
    (value.backupEligible === false || value.credentialDeviceType === "singleDevice")
  ) {
    context.addIssue({
      code: "custom",
      message: "Only a backup-eligible credential can be backed up",
      path: ["credentialBackedUp"],
    });
  }
});

export const vaultPasskeyBindingMetadataSchema = z.object({
  bindingId: vaultPasskeyOpaqueIdSchema,
  credentialId: vaultPasskeyOpaqueIdSchema,
  selectedEnvelopeVariantId: vaultPasskeyOpaqueIdSchema.optional(),
});

export const vaultPasskeyEnvelopeVariantSchema = z.object({
  envelopeVariantId: vaultPasskeyOpaqueIdSchema,
  credentialId: vaultPasskeyOpaqueIdSchema,
  envelope: passkeyPrfEnvelopeSchema,
});

/** Portable one-credential state. Persistence remains application-owned. */
export const vaultPasskeyCredentialStateSchema = z.object({
  credential: vaultPasskeyCredentialMetadataSchema,
  bindings: z.array(vaultPasskeyBindingMetadataSchema).max(MAX_PASSKEY_BINDINGS_PER_CREDENTIAL),
  envelopeVariants: z
    .array(vaultPasskeyEnvelopeVariantSchema)
    .min(1)
    .max(MAX_PASSKEY_ENVELOPE_VARIANTS_PER_CREDENTIAL),
}).superRefine((value, context) => {
  const credentialId = value.credential.credentialId;
  const bindingIds = new Set<string>();
  const variantIds = new Set<string>();

  value.envelopeVariants.forEach((variant, index) => {
    if (variant.credentialId !== credentialId) {
      context.addIssue({
        code: "custom",
        message: "Envelope variant credential does not match the credential state",
        path: ["envelopeVariants", index, "credentialId"],
      });
    }
    if (variantIds.has(variant.envelopeVariantId)) {
      context.addIssue({
        code: "custom",
        message: "Envelope variant identifiers must be unique",
        path: ["envelopeVariants", index, "envelopeVariantId"],
      });
    }
    variantIds.add(variant.envelopeVariantId);
  });

  value.bindings.forEach((binding, index) => {
    if (binding.credentialId !== credentialId) {
      context.addIssue({
        code: "custom",
        message: "Binding credential does not match the credential state",
        path: ["bindings", index, "credentialId"],
      });
    }
    if (bindingIds.has(binding.bindingId)) {
      context.addIssue({
        code: "custom",
        message: "Binding identifiers must be unique",
        path: ["bindings", index, "bindingId"],
      });
    }
    bindingIds.add(binding.bindingId);

    if (
      binding.selectedEnvelopeVariantId &&
      !variantIds.has(binding.selectedEnvelopeVariantId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Binding-selected envelope variant does not exist",
        path: ["bindings", index, "selectedEnvelopeVariantId"],
      });
    }
  });
});

export type WebAuthnTransport = z.infer<typeof webAuthnTransportSchema>;
export type VaultPasskeyCredentialDeviceType = z.infer<
  typeof vaultPasskeyCredentialDeviceTypeSchema
>;
export type VaultPasskeyCredentialMetadata = z.infer<typeof vaultPasskeyCredentialMetadataSchema>;
export type VaultPasskeyBindingMetadata = z.infer<typeof vaultPasskeyBindingMetadataSchema>;
export type VaultPasskeyEnvelopeVariant = z.infer<typeof vaultPasskeyEnvelopeVariantSchema>;
export type VaultPasskeyCredentialState = z.infer<typeof vaultPasskeyCredentialStateSchema>;
