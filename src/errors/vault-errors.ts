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

export type VaultCoreError =
  | VaultPlaintextRejectionError
  | VaultConflictError
  | VaultNotFoundError
  | PasskeyPrfRequiredError
  | PasskeyUnlockError
  | RecoveryPhraseConfirmationError
  | VaultAuthorizationError
  | VaultPasswordUnchangedError
  | VaultRateLimitError
  | VaultKeyNotExtractableError
  | VaultPayloadSizeError
  | VaultPayloadValidationError;
