import { PasskeyCredentialScopeError } from "../errors/vault-errors.js";
import {
  scopeAuthenticationOptionsToCredential,
  selectAuthenticationCredentials,
  type PasskeyCredentialSelection,
} from "../passkey/device-binding/scope-auth-options.js";
import { buildPrfSaltBytes } from "./prf-salt-bytes.js";
import {
  prepareVaultUnlockAuthenticationOptions,
  type PrepareVaultUnlockAuthenticationOptionsContext,
} from "./vault-unlock-auth-options.js";
import type { PublicKeyCredentialRequestOptionsInput } from "./webauthn-prf-options.js";
import type { VaultUnlockTransportPolicy } from "./vault-unlock-transports.js";

export type PrepareVaultPasskeyPrfAuthenticationOptionsInput<
  T extends PublicKeyCredentialRequestOptionsInput = PublicKeyCredentialRequestOptionsInput,
> = {
  userId: string;
  prfSaltPrefix: string;
  serverOptions: T;
  credentialId?: string;
  userAgent?: string;
  filterSingleCredential?: boolean;
  /** When true, strictly scope to credentialId before ceremony prep. */
  scopeToCredential?: boolean;
  /** @deprecated Use scopeToCredential. */
  scopeToDevice?: boolean;
  transportPolicy?: VaultUnlockTransportPolicy;
  /** Preferred explicit exact, allow-list, or discoverable credential selection. */
  credentialSelection?: PasskeyCredentialSelection;
  /**
   * Optional JSON preparer (for example `@tgoliveira/secure-auth/client`
   * `prepareAuthenticationOptions`) that converts base64url challenge and credential ids to
   * `ArrayBuffer` before vault-core PRF preparation.
   */
  prepareJson?: (options: T) => PublicKeyCredentialRequestOptionsInput;
};

function resolveCredentialIdForPrf(
  options: PublicKeyCredentialRequestOptionsInput,
  credentialId?: string
): string | undefined {
  if (credentialId) {
    return credentialId;
  }

  if (options.allowCredentials?.length === 1) {
    return options.allowCredentials[0]?.id;
  }

  return undefined;
}

function mergePrfSaltExtensions(
  options: PublicKeyCredentialRequestOptionsInput,
  salt: ArrayBuffer,
  credentialId?: string
): PublicKeyCredentialRequestOptionsInput {
  const targetCredentialId = resolveCredentialIdForPrf(options, credentialId);
  const existingPrf = options.extensions?.prf;

  if (targetCredentialId) {
    return {
      ...options,
      extensions: {
        ...options.extensions,
        prf: {
          ...existingPrf,
          evalByCredential: {
            ...existingPrf?.evalByCredential,
            [targetCredentialId]: { first: salt },
          },
        },
      },
    };
  }

  return {
    ...options,
    extensions: {
      ...options.extensions,
      prf: {
        ...existingPrf,
        eval: { first: salt },
      },
    },
  };
}

/**
 * Prepares WebAuthn authentication options for any PRF-gated passkey ceremony: vault unlock,
 * passkey enable/disable, envelope re-wrap, or other management flows that feed PRF output into
 * `createPasskeyPrfEnvelope*` or `unwrapVaultKeyFromPasskey*`.
 *
 * Pipeline: optional JSON preparer → merge PRF salt from `buildPrfSaltBytes` → optional strict
 * credential scoping → `prepareVaultUnlockAuthenticationOptions` (salt coercion, iOS `eval`
 * parity, explicit transport policy).
 */
export async function prepareVaultPasskeyPrfAuthenticationOptions<
  T extends PublicKeyCredentialRequestOptionsInput,
>(
  input: PrepareVaultPasskeyPrfAuthenticationOptionsInput<T>
): Promise<T> {
  const {
    userId,
    prfSaltPrefix,
    serverOptions,
    credentialId,
    userAgent,
    filterSingleCredential = true,
    scopeToCredential,
    scopeToDevice = false,
    transportPolicy = "preserve",
    credentialSelection,
    prepareJson,
  } = input;

  let options: PublicKeyCredentialRequestOptionsInput = prepareJson
    ? prepareJson(serverOptions)
    : { ...serverOptions };

  const salt = await buildPrfSaltBytes(prfSaltPrefix, userId);
  const usesLegacySelectionFields =
    input.credentialId !== undefined ||
    input.scopeToCredential !== undefined ||
    input.scopeToDevice !== undefined ||
    input.filterSingleCredential !== undefined;
  if (credentialSelection && usesLegacySelectionFields) {
    throw new PasskeyCredentialScopeError(
      "conflicting_credential_selection",
      "Explicit credential selection cannot be combined with legacy scoping fields"
    );
  }
  if (
    credentialSelection &&
    ((transportPolicy === "discoverable" && credentialSelection.mode !== "discoverable") ||
      (credentialSelection.mode === "discoverable" &&
        transportPolicy !== "preserve" &&
        transportPolicy !== "discoverable"))
  ) {
    throw new PasskeyCredentialScopeError(
      "conflicting_credential_selection",
      "Credential selection conflicts with the requested transport policy"
    );
  }

  const discoverable =
    transportPolicy === "discoverable" || credentialSelection?.mode === "discoverable";
  const effectiveCredentialId = discoverable
    ? undefined
    : credentialSelection?.mode === "exact"
      ? credentialSelection.credentialId
      : credentialId;
  options = mergePrfSaltExtensions(options, salt, effectiveCredentialId);

  if (credentialSelection) {
    options = selectAuthenticationCredentials(options, credentialSelection);
  }

  const shouldScope = scopeToCredential ?? scopeToDevice;
  if (shouldScope && !effectiveCredentialId) {
    throw new PasskeyCredentialScopeError(
      "invalid_credential_id",
      "Strict WebAuthn credential scoping requires a credential id"
    );
  }
  if (shouldScope && effectiveCredentialId) {
    options = scopeAuthenticationOptionsToCredential(options, {
      credentialId: effectiveCredentialId,
    });
  }

  const context: PrepareVaultUnlockAuthenticationOptionsContext = {
    credentialId: effectiveCredentialId,
    userAgent,
    ...(!credentialSelection
      ? {
          filterSingleCredential:
            discoverable || !effectiveCredentialId ? false : filterSingleCredential,
        }
      : {}),
    transportPolicy,
  };

  return prepareVaultUnlockAuthenticationOptions(options, context) as T;
}
