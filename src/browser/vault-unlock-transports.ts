import type { PublicKeyCredentialRequestOptionsInput } from "./webauthn-prf-options.js";

const APPLE_MOBILE_USER_AGENT_PATTERN = /iPhone|iPod|iPad/i;

export function isAppleMobileUserAgent(userAgent: string): boolean {
  return APPLE_MOBILE_USER_AGENT_PATTERN.test(userAgent);
}

export function resolveVaultUnlockUserAgent(userAgent?: string): string {
  if (userAgent) {
    return userAgent;
  }

  if (typeof navigator !== "undefined" && typeof navigator.userAgent === "string") {
    return navigator.userAgent;
  }

  return "";
}

export type VaultUnlockTransportPolicy =
  | "preserve"
  | "platform-only"
  | "discoverable"
  | "apple-mobile-internal-workaround";

function restrictToPlatformTransport<T extends PublicKeyCredentialRequestOptionsInput>(
  options: T
): T {
  if (!options.allowCredentials?.length) {
    return options;
  }

  return {
    ...options,
    allowCredentials: options.allowCredentials.map((descriptor) => ({
      ...descriptor,
      transports: ["internal"] as AuthenticatorTransport[],
    })),
  } as T;
}

/** Applies an explicit transport policy. Stored transports are preserved by default. */
export function applyVaultUnlockTransportPolicy<
  T extends PublicKeyCredentialRequestOptionsInput,
>(options: T, policy: VaultUnlockTransportPolicy = "preserve", userAgent?: string): T {
  if (policy === "preserve") {
    return options;
  }

  if (policy === "discoverable") {
    return { ...options, allowCredentials: [] } as T;
  }

  if (policy === "platform-only") {
    return restrictToPlatformTransport(options);
  }

  const resolvedUserAgent = resolveVaultUnlockUserAgent(userAgent);
  return isAppleMobileUserAgent(resolvedUserAgent)
    ? restrictToPlatformTransport(options)
    : options;
}

/**
 * Pins `internal` transport on Apple mobile devices for PRF-gated authentication ceremonies so
 * hybrid QR flows do not complete WebAuthn without returning local PRF output.
 * @deprecated Use applyVaultUnlockTransportPolicy with apple-mobile-internal-workaround explicitly.
 */
export function preferPlatformTransportsForVaultUnlock<T extends PublicKeyCredentialRequestOptionsInput>(
  options: T,
  userAgent?: string
): T {
  return applyVaultUnlockTransportPolicy(
    options,
    "apple-mobile-internal-workaround",
    userAgent
  );
}
