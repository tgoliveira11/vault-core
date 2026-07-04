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

/**
 * Pins `internal` transport on Apple mobile devices for PRF-gated authentication ceremonies so
 * hybrid QR flows do not complete WebAuthn without returning local PRF output.
 */
export function preferPlatformTransportsForVaultUnlock<T extends PublicKeyCredentialRequestOptionsInput>(
  options: T,
  userAgent?: string
): T {
  const resolvedUserAgent = resolveVaultUnlockUserAgent(userAgent);
  if (!isAppleMobileUserAgent(resolvedUserAgent) || !options.allowCredentials?.length) {
    return options;
  }

  return {
    ...options,
    allowCredentials: options.allowCredentials.map((descriptor) => ({
      ...descriptor,
      transports: ["internal"] as AuthenticatorTransport[],
    })),
  };
}
