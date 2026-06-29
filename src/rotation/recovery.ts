import type { RecoveryPhraseEnvelope } from "../validation/schemas.js";
import type { RecoveryPhraseWordCount, VaultCryptoProfile, VaultAadScope } from "../profile.js";
import {
  assertRecoveryPhraseConfirmation,
  createRecoveryEnvelope,
  createRecoveryPhrase,
  getRecoveryPhraseWordCount,
  normalizeRecoveryPhrase,
  validateRecoveryPhraseFormat,
} from "../envelopes/recovery.js";
import { isEnvelopeKdfUpgradeRecommended } from "../crypto/policy.js";
import { VaultAuthorizationError } from "../errors/vault-errors.js";
import {
  assertVaultRotationAuthorized,
  type VaultRotationAuthorization,
} from "./authorization.js";
import { unlockWithRecoveryEnvelope } from "../envelopes/recovery.js";
import { userVaultKeysEqual } from "../keys/user-vault-key.js";
import { createRecoveryKitText } from "../recovery/kit.js";

type RotationScope = Pick<VaultAadScope, "userId" | "resourceId">;

export type RotateRecoveryPhraseOptions = {
  vaultKey: CryptoKey;
  authorization: VaultRotationAuthorization;
  scope: RotationScope;
  profile: VaultCryptoProfile;
  /** Provide a new phrase or omit to generate one with `wordCount`. */
  newRecoveryPhrase?: string;
  wordCount?: RecoveryPhraseWordCount;
  /** When provided, must match `newRecoveryPhrase` after normalization. */
  confirmNewRecoveryPhrase?: string;
  /** App/product name for recovery kit text generation. */
  recoveryKitProductName?: string;
};

export type RotateRecoveryPhraseResult = {
  envelope: RecoveryPhraseEnvelope;
  recoveryPhrase: string;
  recoveryKitText: string | null;
  replacedKdfVersion: string | null;
};

/**
 * Re-wraps the same UVK with a new BIP39 recovery phrase.
 * Requires proof via current vault password or passkey PRF unlock while the vault is already unlocked.
 */
export async function rotateRecoveryPhrase(
  options: RotateRecoveryPhraseOptions
): Promise<RotateRecoveryPhraseResult> {
  const {
    vaultKey,
    authorization,
    scope,
    profile,
    confirmNewRecoveryPhrase,
    recoveryKitProductName,
  } = options;

  await assertVaultRotationAuthorized(vaultKey, authorization, scope, profile);

  const wordCount = options.wordCount ?? 24;
  const recoveryPhrase =
    options.newRecoveryPhrase ?? createRecoveryPhrase({ wordCount });

  const normalized = normalizeRecoveryPhrase(recoveryPhrase);
  if (!validateRecoveryPhraseFormat(normalized)) {
    throw new VaultAuthorizationError("New recovery phrase is not valid");
  }

  const actualCount = getRecoveryPhraseWordCount(normalized);
  if (actualCount !== wordCount) {
    throw new VaultAuthorizationError(
      `Expected a ${wordCount}-word recovery phrase, received ${actualCount ?? "invalid input"}`
    );
  }

  if (confirmNewRecoveryPhrase !== undefined) {
    assertRecoveryPhraseConfirmation(normalized, confirmNewRecoveryPhrase);
  }

  const { envelope } = await createRecoveryEnvelope(
    vaultKey,
    normalized,
    scope,
    profile,
    { phraseLength: wordCount }
  );

  const recoveryKitText =
    recoveryKitProductName != null
      ? createRecoveryKitText({
          productName: recoveryKitProductName,
          recoveryPhrase: normalized,
          wordCount,
        })
      : null;

  return {
    envelope,
    recoveryPhrase: normalized,
    recoveryKitText,
    replacedKdfVersion: null,
  };
}

export type MaybeUpgradeRecoveryEnvelopeOptions = {
  vaultKey: CryptoKey;
  recoveryPhrase: string;
  envelope: RecoveryPhraseEnvelope;
  scope: RotationScope;
  profile: VaultCryptoProfile;
  expectedWordCount?: RecoveryPhraseWordCount | null;
};

export type MaybeUpgradeRecoveryEnvelopeResult = {
  upgradedEnvelope: RecoveryPhraseEnvelope | null;
  upgradeRecommended: boolean;
};

/** Re-wrap the UVK with the recommended KDF after recovery unlock when the stored envelope is legacy. */
export async function maybeUpgradeRecoveryEnvelopeAfterUnlock(
  options: MaybeUpgradeRecoveryEnvelopeOptions
): Promise<MaybeUpgradeRecoveryEnvelopeResult> {
  const { vaultKey, recoveryPhrase, envelope, scope, profile, expectedWordCount } = options;

  if (!isEnvelopeKdfUpgradeRecommended(envelope.kdfMetadata)) {
    return { upgradedEnvelope: null, upgradeRecommended: false };
  }

  const unlockedKey = await unlockWithRecoveryEnvelope(
    recoveryPhrase,
    envelope,
    scope,
    profile,
    { expectedWordCount }
  );

  if (!(await userVaultKeysEqual(vaultKey, unlockedKey))) {
    throw new VaultAuthorizationError("Vault key mismatch during recovery envelope upgrade");
  }

  const phraseLength =
    expectedWordCount ??
    envelope.publicMetadata?.phraseLength ??
    getRecoveryPhraseWordCount(recoveryPhrase) ??
    24;

  const { envelope: upgradedEnvelope } = await createRecoveryEnvelope(
    vaultKey,
    recoveryPhrase,
    scope,
    profile,
    { phraseLength: phraseLength as RecoveryPhraseWordCount }
  );

  return { upgradedEnvelope, upgradeRecommended: true };
}
