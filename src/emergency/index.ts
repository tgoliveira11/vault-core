export {
  MAX_DURESS_PASSWORD_LENGTH,
  DEFAULT_DURESS_LONG_PRESS_MS,
} from "./constants.js";

export { containsDuressSequence } from "./contains-duress-sequence.js";

export {
  createDecoyVaultSetup,
  DuressPasswordMissingSequenceError,
  type CreateDecoyVaultSetupInput,
  type CreateDecoyVaultSetupResult,
} from "./create-decoy-vault-setup.js";

export {
  resolveVaultUnlockTarget,
  resolveSessionEncryptedBlob,
  assertSessionPayloadDecryptAllowed,
  type VaultUnlockTarget,
  type ResolveVaultUnlockTargetInput,
} from "./unlock-routing.js";

export { decryptVaultPayloadForSession } from "./decrypt-for-session.js";
