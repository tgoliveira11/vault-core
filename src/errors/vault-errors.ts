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

export type VaultCoreError =
  | VaultPlaintextRejectionError
  | VaultConflictError
  | VaultNotFoundError
  | PasskeyPrfRequiredError
  | PasskeyUnlockError
  | RecoveryPhraseConfirmationError;
