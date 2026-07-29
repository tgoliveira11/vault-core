import {
  alignPrfExtensionsForCredential,
  prepareWebAuthnPrfExtensions,
  type PublicKeyCredentialRequestOptionsInput,
} from "./webauthn-prf-options.js";
import {
  scopeAuthenticationOptionsToCredential,
  selectAuthenticationCredentials,
  type PasskeyCredentialSelection,
} from "../passkey/device-binding/scope-auth-options.js";
import { PasskeyCredentialScopeError } from "../errors/vault-errors.js";
import {
  applyVaultUnlockTransportPolicy,
  type VaultUnlockTransportPolicy,
} from "./vault-unlock-transports.js";

export type PrepareVaultUnlockAuthenticationOptionsContext = {
  credentialId?: string;
  userAgent?: string;
  /** When true, keep only the credential matching `credentialId` in allowCredentials. */
  filterSingleCredential?: boolean;
  /** Defaults to preserve so stored transports are not removed. */
  transportPolicy?: VaultUnlockTransportPolicy;
  /** Preferred explicit selection. Do not combine with legacy credential/filter fields. */
  credentialSelection?: PasskeyCredentialSelection;
};

/**
 * Prepares WebAuthn authentication options for PRF-gated passkey ceremonies (vault unlock,
 * passkey enable/disable, envelope re-wrap, and other management flows): PRF salt coercion,
 * canonical single-input alignment with required user verification, optional strict
 * single-credential filtering, and explicit transport policy.
 */
export function prepareVaultUnlockAuthenticationOptions<
  T extends PublicKeyCredentialRequestOptionsInput,
>(options: T, context: PrepareVaultUnlockAuthenticationOptionsContext = {}): T {
  let prepared: PublicKeyCredentialRequestOptionsInput = { ...options };
  const transportPolicy = context.transportPolicy ?? "preserve";
  const discoverable = transportPolicy === "discoverable";
  if (
    context.credentialSelection &&
    (context.credentialId !== undefined ||
      context.filterSingleCredential !== undefined)
  ) {
    throw new PasskeyCredentialScopeError(
      "conflicting_credential_selection",
      "Explicit credential selection cannot be combined with legacy scoping fields"
    );
  }
  if (
    context.credentialSelection &&
    ((transportPolicy === "discoverable" && context.credentialSelection.mode !== "discoverable") ||
      (context.credentialSelection.mode === "discoverable" &&
        transportPolicy !== "preserve" &&
        transportPolicy !== "discoverable"))
  ) {
    throw new PasskeyCredentialScopeError(
      "conflicting_credential_selection",
      "Credential selection conflicts with the requested transport policy"
    );
  }

  if (context.credentialSelection) {
    prepared = selectAuthenticationCredentials(prepared, context.credentialSelection);
  }

  if (
    !context.credentialSelection &&
    context.filterSingleCredential === true &&
    !context.credentialId &&
    !discoverable
  ) {
    throw new PasskeyCredentialScopeError(
      "invalid_credential_id",
      "Strict WebAuthn credential filtering requires a credential id"
    );
  }

  if (
    !context.credentialSelection &&
    context.filterSingleCredential &&
    context.credentialId &&
    !discoverable
  ) {
    prepared = scopeAuthenticationOptionsToCredential(prepared, {
      credentialId: context.credentialId,
    });
  }

  if (prepared.extensions) {
    prepared = {
      ...prepared,
      extensions: prepareWebAuthnPrfExtensions(prepared.extensions),
    };
  }

  prepared = alignPrfExtensionsForCredential(
    prepared,
    discoverable
      ? undefined
      : context.credentialSelection?.mode === "exact"
        ? context.credentialSelection.credentialId
        : context.credentialId
  );

  const canonicalPrfFirst = prepared.extensions?.prf?.eval?.first;
  if (canonicalPrfFirst instanceof ArrayBuffer) {
    prepared = {
      ...prepared,
      userVerification: "required",
      extensions: {
        ...prepared.extensions,
        prf: {
          eval: { first: canonicalPrfFirst },
        },
      },
    };
  }
  prepared = applyVaultUnlockTransportPolicy(
    prepared,
    transportPolicy,
    context.userAgent
  );

  return prepared as T;
}
