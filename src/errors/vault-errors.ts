export class VaultPlaintextRejectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultPlaintextRejectionError";
  }
}

export class VaultConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultConflictError";
  }
}

export class VaultNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultNotFoundError";
  }
}

export class PasskeyPrfRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasskeyPrfRequiredError";
  }
}

export class PasskeyUnlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasskeyUnlockError";
  }
}

export type PasskeyCredentialScopeFailureCode =
  | "invalid_credential_id"
  | "conflicting_credential_selection"
  | "discoverable_credentials_not_allowed"
  | "invalid_credential_descriptor"
  | "duplicate_credential_descriptor"
  | "credential_not_found";

/** Fail-closed WebAuthn credential scoping failure. */
export class PasskeyCredentialScopeError extends Error {
  readonly code: PasskeyCredentialScopeFailureCode;
  readonly descriptorIndex: number | null;

  constructor(
    code: PasskeyCredentialScopeFailureCode,
    message: string,
    descriptorIndex: number | null = null
  ) {
    super(message);
    this.name = "PasskeyCredentialScopeError";
    this.code = code;
    this.descriptorIndex = descriptorIndex;
  }
}

export class RecoveryPhraseConfirmationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryPhraseConfirmationError";
  }
}

export class VaultAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultAuthorizationError";
  }
}

export class VaultPasswordUnchangedError extends Error {
  constructor(message = "New vault password must differ from the current password") {
    super(message);
    this.name = "VaultPasswordUnchangedError";
  }
}

export class VaultRateLimitError extends Error {
  readonly retryAfterMs: number;
  readonly resetAtMs: number;

  constructor(message: string, retryAfterMs: number, resetAtMs: number) {
    super(message);
    this.name = "VaultRateLimitError";
    this.retryAfterMs = retryAfterMs;
    this.resetAtMs = resetAtMs;
  }
}

export class VaultKeyNotExtractableError extends Error {
  constructor(message = "User vault key is non-extractable") {
    super(message);
    this.name = "VaultKeyNotExtractableError";
  }
}

export class VaultPayloadSizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultPayloadSizeError";
  }
}

export class VaultPayloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultPayloadValidationError";
  }
}

export class VaultEmergencyDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultEmergencyDecryptError";
  }
}

export type VaultCoreError =
  | VaultPlaintextRejectionError
  | VaultConflictError
  | VaultNotFoundError
  | PasskeyPrfRequiredError
  | PasskeyUnlockError
  | PasskeyCredentialScopeError
  | RecoveryPhraseConfirmationError
  | VaultAuthorizationError
  | VaultPasswordUnchangedError
  | VaultRateLimitError
  | VaultKeyNotExtractableError
  | VaultPayloadSizeError
  | VaultPayloadValidationError
  | VaultEmergencyDecryptError;
