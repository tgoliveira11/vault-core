import { scopeAuthenticationOptionsToDevice } from "../passkey/device-binding/scope-auth-options.js";
import { buildPrfSaltBytes } from "./prf-salt-bytes.js";
import {
  prepareVaultUnlockAuthenticationOptions,
  type PrepareVaultUnlockAuthenticationOptionsContext,
} from "./vault-unlock-auth-options.js";
import type { PublicKeyCredentialRequestOptionsInput } from "./webauthn-prf-options.js";

export type PrepareVaultPasskeyPrfAuthenticationOptionsInput<
  T extends PublicKeyCredentialRequestOptionsInput = PublicKeyCredentialRequestOptionsInput,
> = {
  userId: string;
  prfSaltPrefix: string;
  serverOptions: T;
  credentialId?: string;
  userAgent?: string;
  filterSingleCredential?: boolean;
  /** When true and `credentialId` is set, scopes `allowCredentials` before ceremony prep. */
  scopeToDevice?: boolean;
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
 * Pipeline: optional JSON preparer → merge PRF salt from `buildPrfSaltBytes` → optional device
 * scoping → `prepareVaultUnlockAuthenticationOptions` (salt coercion, iOS `eval` parity, Apple
 * mobile transport pinning).
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
    scopeToDevice = false,
    prepareJson,
  } = input;

  let options: PublicKeyCredentialRequestOptionsInput = prepareJson
    ? prepareJson(serverOptions)
    : { ...serverOptions };

  const salt = await buildPrfSaltBytes(prfSaltPrefix, userId);
  options = mergePrfSaltExtensions(options, salt, credentialId);

  if (scopeToDevice && credentialId) {
    options = scopeAuthenticationOptionsToDevice(options, { credentialId });
  }

  const context: PrepareVaultUnlockAuthenticationOptionsContext = {
    credentialId,
    userAgent,
    filterSingleCredential,
  };

  return prepareVaultUnlockAuthenticationOptions(options, context) as T;
}
