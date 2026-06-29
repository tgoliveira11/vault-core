import type { PasswordEnvelope } from "../validation/schemas.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import {
  VaultAuthorizationError,
  VaultPasswordUnchangedError,
} from "../errors/vault-errors.js";
import { createPasswordEnvelope, unlockWithPasswordEnvelope } from "../envelopes/password.js";
import { userVaultKeysEqual } from "../keys/user-vault-key.js";
import { isEnvelopeKdfUpgradeRecommended } from "../crypto/policy.js";

type RotationScope = Pick<VaultAadScope, "userId" | "resourceId">;

export type RotateVaultPasswordOptions = {
  /** User Vault Key currently held in memory after an explicit vault unlock. */
  vaultKey: CryptoKey;
  currentPassword: string;
  newPassword: string;
  currentEnvelope: PasswordEnvelope;
  scope: RotationScope;
  profile: VaultCryptoProfile;
};

export type RotateVaultPasswordResult = {
  envelope: PasswordEnvelope;
  replacedKdfVersion: string;
};

/**
 * Re-wraps the same UVK with a new vault password.
 * The app must persist the returned envelope atomically; encrypted payloads stay unchanged.
 */
export async function rotateVaultPassword(
  options: RotateVaultPasswordOptions
): Promise<RotateVaultPasswordResult> {
  const {
    vaultKey,
    currentPassword,
    newPassword,
    currentEnvelope,
    scope,
    profile,
  } = options;

  if (currentPassword === newPassword) {
    throw new VaultPasswordUnchangedError();
  }

  const unlockedKey = await unlockWithPasswordEnvelope(
    currentPassword,
    currentEnvelope,
    scope,
    profile
  );

  if (!(await userVaultKeysEqual(vaultKey, unlockedKey))) {
    throw new VaultAuthorizationError("Current vault password is incorrect");
  }

  const { envelope } = await createPasswordEnvelope(
    vaultKey,
    newPassword,
    scope,
    profile
  );

  return {
    envelope,
    replacedKdfVersion: currentEnvelope.kdfMetadata.version,
  };
}

export type MaybeUpgradePasswordEnvelopeOptions = {
  vaultKey: CryptoKey;
  vaultPassword: string;
  envelope: PasswordEnvelope;
  scope: RotationScope;
  profile: VaultCryptoProfile;
};

export type MaybeUpgradePasswordEnvelopeResult = {
  /** Non-null when the app should persist a stronger envelope around the same password. */
  upgradedEnvelope: PasswordEnvelope | null;
  upgradeRecommended: boolean;
};

/**
 * After a successful password unlock, re-wrap the UVK with the recommended KDF if the stored envelope is legacy.
 * Returns null when no server write is needed.
 */
export async function maybeUpgradePasswordEnvelopeAfterUnlock(
  options: MaybeUpgradePasswordEnvelopeOptions
): Promise<MaybeUpgradePasswordEnvelopeResult> {
  const { vaultKey, vaultPassword, envelope, scope, profile } = options;

  if (!isEnvelopeKdfUpgradeRecommended(envelope.kdfMetadata)) {
    return { upgradedEnvelope: null, upgradeRecommended: false };
  }

  const unlockedKey = await unlockWithPasswordEnvelope(
    vaultPassword,
    envelope,
    scope,
    profile
  );

  if (!(await userVaultKeysEqual(vaultKey, unlockedKey))) {
    throw new VaultAuthorizationError("Vault key mismatch during envelope upgrade");
  }

  const { envelope: upgradedEnvelope } = await createPasswordEnvelope(
    vaultKey,
    vaultPassword,
    scope,
    profile
  );

  return { upgradedEnvelope, upgradeRecommended: true };
}
