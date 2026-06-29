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

export type VaultCoreError =
  | VaultPlaintextRejectionError
  | VaultConflictError
  | VaultNotFoundError
  | PasskeyPrfRequiredError
  | PasskeyUnlockError
  | RecoveryPhraseConfirmationError
  | VaultAuthorizationError
  | VaultPasswordUnchangedError;
