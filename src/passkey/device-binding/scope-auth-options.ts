import {
  PasskeyCredentialScopeError,
  type PasskeyCredentialScopeFailureCode,
} from "../../errors/vault-errors.js";
import {
  MAX_PASSKEY_OPAQUE_ID_LENGTH,
  MAX_PASSKEY_TRANSPORTS,
  webAuthnTransportSchema,
} from "../model.js";

export type ScopeAuthenticationOptionsInput = {
  allowCredentials?: unknown;
  [key: string]: unknown;
};

export type ScopeAuthenticationOptionsToCredentialContext = {
  credentialId: string;
};

export type PasskeyCredentialSelection =
  | { mode: "exact"; credentialId: string }
  | { mode: "allow-list" }
  | { mode: "discoverable" };

/** @deprecated Use ScopeAuthenticationOptionsToCredentialContext. */
export type ScopeAuthenticationOptionsToDeviceContext = ScopeAuthenticationOptionsToCredentialContext;

type CredentialDescriptor = {
  id: string;
  type: "public-key";
  transports?: AuthenticatorTransport[];
};

function scopeError(
  code: PasskeyCredentialScopeFailureCode,
  message: string,
  descriptorIndex: number | null = null
): never {
  throw new PasskeyCredentialScopeError(code, message, descriptorIndex);
}

function parseDescriptor(value: unknown, index: number): CredentialDescriptor {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return scopeError(
      "invalid_credential_descriptor",
      "WebAuthn credential descriptor must be an object",
      index
    );
  }

  const descriptor = value as Record<string, unknown>;
  if (
    typeof descriptor.id !== "string" ||
    descriptor.id.length === 0 ||
    descriptor.id.length > MAX_PASSKEY_OPAQUE_ID_LENGTH ||
    descriptor.id.trim() !== descriptor.id ||
    descriptor.type !== "public-key"
  ) {
    return scopeError(
      "invalid_credential_descriptor",
      "WebAuthn credential descriptor has an invalid id or type",
      index
    );
  }

  if (descriptor.transports !== undefined) {
    if (
      !Array.isArray(descriptor.transports) ||
      descriptor.transports.length > MAX_PASSKEY_TRANSPORTS ||
      descriptor.transports.some((transport) => !webAuthnTransportSchema.safeParse(transport).success) ||
      new Set(descriptor.transports).size !== descriptor.transports.length
    ) {
      return scopeError(
        "invalid_credential_descriptor",
        "WebAuthn credential descriptor has invalid transports",
        index
      );
    }
  }

  return descriptor as CredentialDescriptor;
}

function parseAllowList(allowCredentials: unknown): CredentialDescriptor[] {
  if (!Array.isArray(allowCredentials)) {
    return scopeError(
      "invalid_credential_descriptor",
      "WebAuthn allowCredentials must be an array"
    );
  }
  if (allowCredentials.length === 0) {
    return scopeError(
      "discoverable_credentials_not_allowed",
      "A non-empty WebAuthn allow-list is required"
    );
  }

  const parsed = allowCredentials.map(parseDescriptor);
  const seen = new Set<string>();
  parsed.forEach((descriptor, index) => {
    if (seen.has(descriptor.id)) {
      scopeError(
        "duplicate_credential_descriptor",
        "WebAuthn allowCredentials contains a duplicate credential",
        index
      );
    }
    seen.add(descriptor.id);
  });
  return parsed;
}

/** Applies an explicit exact, allow-list, or discoverable credential selection policy. */
export function selectAuthenticationCredentials<T extends ScopeAuthenticationOptionsInput>(
  options: T,
  selection: PasskeyCredentialSelection
): T {
  if (selection.mode === "exact") {
    return scopeAuthenticationOptionsToCredential(options, {
      credentialId: selection.credentialId,
    });
  }
  if (selection.mode === "discoverable") {
    return { ...options, allowCredentials: [] };
  }
  return { ...options, allowCredentials: parseAllowList(options.allowCredentials) };
}

/**
 * Strictly scopes WebAuthn request options to one credential.
 * Throws PasskeyCredentialScopeError instead of returning an unscoped list.
 */
export function scopeAuthenticationOptionsToCredential<T extends ScopeAuthenticationOptionsInput>(
  options: T,
  context: ScopeAuthenticationOptionsToCredentialContext
): T {
  if (
    typeof context.credentialId !== "string" ||
    context.credentialId.length === 0 ||
    context.credentialId.length > MAX_PASSKEY_OPAQUE_ID_LENGTH ||
    context.credentialId.trim() !== context.credentialId
  ) {
    return scopeError("invalid_credential_id", "Requested WebAuthn credential id is invalid");
  }

  const allowCredentials = options.allowCredentials;
  if (allowCredentials === undefined || (Array.isArray(allowCredentials) && allowCredentials.length === 0)) {
    return scopeError(
      "discoverable_credentials_not_allowed",
      "Exact credential selection cannot use a discoverable credential flow"
    );
  }

  const parsed = parseAllowList(allowCredentials);

  const matched = parsed.find((descriptor) => descriptor.id === context.credentialId);
  if (!matched) {
    return scopeError(
      "credential_not_found",
      "Requested WebAuthn credential is not present in allowCredentials"
    );
  }

  return { ...options, allowCredentials: [matched] };
}

/** @deprecated Use scopeAuthenticationOptionsToCredential. This alias is now fail-closed. */
export function scopeAuthenticationOptionsToDevice<T extends ScopeAuthenticationOptionsInput>(
  options: T,
  context: ScopeAuthenticationOptionsToDeviceContext
): T {
  return scopeAuthenticationOptionsToCredential(options, context);
}
