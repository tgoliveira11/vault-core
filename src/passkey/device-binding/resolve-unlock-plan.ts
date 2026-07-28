import { vaultPasskeyOpaqueIdSchema } from "../model.js";
import type { PasskeyCredentialSelection } from "./scope-auth-options.js";
import type { VaultPasskeyBindingTarget } from "./types.js";

export type PasskeyUnlockIntent = "quick" | "explicit";

export type ResolvePasskeyUnlockPlanInput = {
  intent: PasskeyUnlockIntent;
  hasPasskeyPrfEnvelope: boolean;
  /** Preliminary browser capability only. Confirm PRF after the WebAuthn ceremony. */
  preliminaryPrfAvailable: boolean;
  bindingTarget?: VaultPasskeyBindingTarget | null;
  /** Discoverable selection is never implicit. The authenticated user's allow-list is the default. */
  explicitSelectionMode?: "allow-list" | "discoverable";
};

export type PasskeyUnlockPlan =
  | {
      status: "unavailable";
      reason: "no_envelope" | "prf_unavailable" | "binding_required";
    }
  | {
      status: "ready";
      intent: "quick";
      credentialSelection: Extract<PasskeyCredentialSelection, { mode: "exact" }>;
      selectedEnvelopeVariantId?: string;
    }
  | {
      status: "ready";
      intent: "explicit";
      credentialSelection: Exclude<PasskeyCredentialSelection, { mode: "exact" }>;
    };

function parseBindingTarget(
  value: VaultPasskeyBindingTarget | null | undefined
): VaultPasskeyBindingTarget | null {
  if (!value || typeof value !== "object") return null;
  const credentialId = vaultPasskeyOpaqueIdSchema.safeParse(value.credentialId);
  if (!credentialId.success) return null;

  if (value.selectedEnvelopeVariantId === undefined) {
    return { credentialId: credentialId.data };
  }

  const selectedEnvelopeVariantId = vaultPasskeyOpaqueIdSchema.safeParse(
    value.selectedEnvelopeVariantId
  );
  if (!selectedEnvelopeVariantId.success) return null;
  return {
    credentialId: credentialId.data,
    selectedEnvelopeVariantId: selectedEnvelopeVariantId.data,
  };
}

/**
 * Separates explicit passkey use from bound-browser quick unlock.
 * A binding is required only for quick routing and never becomes an authentication factor.
 */
export function resolvePasskeyUnlockPlan(
  input: ResolvePasskeyUnlockPlanInput
): PasskeyUnlockPlan {
  if (!input.hasPasskeyPrfEnvelope) {
    return { status: "unavailable", reason: "no_envelope" };
  }
  if (!input.preliminaryPrfAvailable) {
    return { status: "unavailable", reason: "prf_unavailable" };
  }

  if (input.intent === "explicit") {
    return {
      status: "ready",
      intent: "explicit",
      credentialSelection: {
        mode: input.explicitSelectionMode === "discoverable" ? "discoverable" : "allow-list",
      },
    };
  }

  const target = parseBindingTarget(input.bindingTarget);
  if (!target) {
    return { status: "unavailable", reason: "binding_required" };
  }

  return {
    status: "ready",
    intent: "quick",
    credentialSelection: { mode: "exact", credentialId: target.credentialId },
    ...(target.selectedEnvelopeVariantId
      ? { selectedEnvelopeVariantId: target.selectedEnvelopeVariantId }
      : {}),
  };
}
