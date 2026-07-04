import {
  alignPrfExtensionsForCredential,
  prepareWebAuthnPrfExtensions,
  type PublicKeyCredentialRequestOptionsInput,
} from "./webauthn-prf-options.js";
import { preferPlatformTransportsForVaultUnlock } from "./vault-unlock-transports.js";

export type PrepareVaultUnlockAuthenticationOptionsContext = {
  credentialId?: string;
  userAgent?: string;
  /** When true, keep only the credential matching `credentialId` in allowCredentials. */
  filterSingleCredential?: boolean;
};

function filterAllowCredentials(
  options: PublicKeyCredentialRequestOptionsInput,
  credentialId?: string
): PublicKeyCredentialRequestOptionsInput {
  if (!credentialId || !options.allowCredentials || options.allowCredentials.length <= 1) {
    return options;
  }

  const filtered = options.allowCredentials.filter((descriptor) => descriptor.id === credentialId);
  if (filtered.length === 0) {
    return options;
  }

  return {
    ...options,
    allowCredentials: filtered,
  };
}

/**
 * Prepares WebAuthn authentication options for PRF-gated passkey ceremonies (vault unlock,
 * passkey enable/disable, envelope re-wrap, and other management flows): PRF salt coercion, iOS
 * PRF extension alignment, optional single-credential filtering, and Apple mobile transport pinning.
 */
export function prepareVaultUnlockAuthenticationOptions<
  T extends PublicKeyCredentialRequestOptionsInput,
>(options: T, context: PrepareVaultUnlockAuthenticationOptionsContext = {}): T {
  let prepared: PublicKeyCredentialRequestOptionsInput = { ...options };

  if (context.filterSingleCredential) {
    prepared = filterAllowCredentials(prepared, context.credentialId);
  }

  if (prepared.extensions) {
    prepared = {
      ...prepared,
      extensions: prepareWebAuthnPrfExtensions(prepared.extensions),
    };
  }

  prepared = alignPrfExtensionsForCredential(prepared, context.credentialId);
  prepared = preferPlatformTransportsForVaultUnlock(prepared, context.userAgent);

  return prepared as T;
}
