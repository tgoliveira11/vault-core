export {
  assertVaultRotationAuthorized,
  type VaultPasswordAuthorization,
  type VaultPasskeyPrfAuthorization,
  type VaultRotationAuthorization,
} from "./authorization.js";

export {
  rotateVaultPassword,
  maybeUpgradePasswordEnvelopeAfterUnlock,
  type RotateVaultPasswordOptions,
  type RotateVaultPasswordResult,
  type MaybeUpgradePasswordEnvelopeOptions,
  type MaybeUpgradePasswordEnvelopeResult,
} from "./password.js";

export {
  rotateRecoveryPhrase,
  maybeUpgradeRecoveryEnvelopeAfterUnlock,
  type RotateRecoveryPhraseOptions,
  type RotateRecoveryPhraseResult,
  type MaybeUpgradeRecoveryEnvelopeOptions,
  type MaybeUpgradeRecoveryEnvelopeResult,
} from "./recovery.js";
