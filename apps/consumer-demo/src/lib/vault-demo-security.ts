import {
  createPasskeyPrfEnvelope,
  isEnvelopeKdfUpgradeRecommended,
  maybeUpgradePasswordEnvelopeAfterUnlock,
  maybeUpgradeRecoveryEnvelopeAfterUnlock,
  passwordEnvelopeSchema,
  recoveryPhraseEnvelopeSchema,
  rotateRecoveryPhrase,
  rotateVaultPassword,
  withVaultUnlockRateLimit,
  type RecoveryPhraseEnvelope,
  type RecoveryPhraseWordCount,
} from "@tgoliveira/vault-core";
import {
  deleteVaultWithPasswordAuthorization,
  getSessionVaultKey,
} from "@tgoliveira/vault-core/browser";
import { DEMO_USER_ID, VAULT_PROFILE, vaultScope } from "@/lib/vault-profile";
import {
  clearPasskeyCredentialId,
  loadPasskeyCredentialId,
  registerDemoPasskey,
  savePasskeyCredentialId,
} from "@/lib/vault-demo-passkey";
import { clearVaultRecord, loadVaultRecord, saveVaultRecord } from "@/lib/vault-demo-store";
import { getDemoVaultUnlockRateLimiter } from "@/lib/vault-rate-limit";

const DEMO_SECURITY_RATE_LIMIT_SCOPE = "demo-security";

function runDemoSecurityAttempt<T>(attempt: () => Promise<T>): Promise<T> {
  return withVaultUnlockRateLimit(
    getDemoVaultUnlockRateLimiter(),
    DEMO_SECURITY_RATE_LIMIT_SCOPE,
    "password",
    attempt
  );
}

function requireVaultKey(): CryptoKey {
  const vaultKey = getSessionVaultKey();
  if (!vaultKey) {
    throw new Error("Vault is locked");
  }
  return vaultKey;
}

function requireRecord() {
  const record = loadVaultRecord();
  if (!record) {
    throw new Error("Vault is not configured");
  }
  return record;
}

export type VaultSecuritySnapshot = {
  hasPasskey: boolean;
  passkeyCredentialLinked: boolean;
  passwordKdfUpgradeRecommended: boolean;
  recoveryKdfUpgradeRecommended: boolean;
  passwordKdfVersion: string;
  recoveryKdfVersion: string;
};

export function getVaultSecuritySnapshot(): VaultSecuritySnapshot | null {
  const record = loadVaultRecord();
  if (!record) return null;

  const passwordEnvelope = passwordEnvelopeSchema.parse(record.passwordEnvelope);
  const recoveryEnvelope = recoveryPhraseEnvelopeSchema.parse(record.recoveryEnvelope);

  return {
    hasPasskey: record.passkeyPrfEnvelope != null,
    passkeyCredentialLinked: loadPasskeyCredentialId() != null,
    passwordKdfUpgradeRecommended: isEnvelopeKdfUpgradeRecommended(passwordEnvelope.kdfMetadata),
    recoveryKdfUpgradeRecommended: isEnvelopeKdfUpgradeRecommended(recoveryEnvelope.kdfMetadata),
    passwordKdfVersion: passwordEnvelope.kdfMetadata.version,
    recoveryKdfVersion: recoveryEnvelope.kdfMetadata.version,
  };
}

export async function changeDemoVaultPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  return runDemoSecurityAttempt(async () => {
    const record = requireRecord();
    const vaultKey = requireVaultKey();
    const scope = vaultScope(DEMO_USER_ID);
    const currentEnvelope = passwordEnvelopeSchema.parse(record.passwordEnvelope);

    const { envelope } = await rotateVaultPassword({
      vaultKey,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      currentEnvelope,
      scope,
      profile: VAULT_PROFILE,
    });

    saveVaultRecord({ ...record, passwordEnvelope: envelope });
  });
}

export async function generateDemoRecoveryRotation(input: {
  currentPassword: string;
  wordCount: RecoveryPhraseWordCount;
}) {
  return runDemoSecurityAttempt(async () => {
    const record = requireRecord();
    const vaultKey = requireVaultKey();
    const scope = vaultScope(DEMO_USER_ID);

    return rotateRecoveryPhrase({
      vaultKey,
      authorization: {
        kind: "password",
        currentPassword: input.currentPassword,
        passwordEnvelope: passwordEnvelopeSchema.parse(record.passwordEnvelope),
      },
      scope,
      profile: VAULT_PROFILE,
      wordCount: input.wordCount,
      recoveryKitProductName: "Vault Core Demo",
    });
  });
}

export async function commitDemoRecoveryRotation(envelope: RecoveryPhraseEnvelope) {
  const record = requireRecord();
  saveVaultRecord({ ...record, recoveryEnvelope: envelope });
}

export async function linkDemoPasskeyPrf(): Promise<void> {
  const record = requireRecord();
  const vaultKey = requireVaultKey();
  const scope = vaultScope(DEMO_USER_ID);

  const { prfOutput, credentialId } = await registerDemoPasskey();
  const passkeyPrfEnvelope = await createPasskeyPrfEnvelope(
    vaultKey,
    prfOutput,
    scope,
    VAULT_PROFILE,
    { linkedAt: new Date().toISOString() }
  );

  saveVaultRecord({ ...record, passkeyPrfEnvelope });
  savePasskeyCredentialId(credentialId);
}

export function unlinkDemoPasskeyPrf(): void {
  const record = requireRecord();
  saveVaultRecord({ ...record, passkeyPrfEnvelope: null });
  clearPasskeyCredentialId();
}

export async function upgradeDemoPasswordEnvelope(currentPassword: string): Promise<boolean> {
  return runDemoSecurityAttempt(async () => {
    const record = requireRecord();
    const vaultKey = requireVaultKey();
    const scope = vaultScope(DEMO_USER_ID);
    const envelope = passwordEnvelopeSchema.parse(record.passwordEnvelope);

    const { upgradedEnvelope } = await maybeUpgradePasswordEnvelopeAfterUnlock({
      vaultKey,
      vaultPassword: currentPassword,
      envelope,
      scope,
      profile: VAULT_PROFILE,
    });

    if (!upgradedEnvelope) return false;
    saveVaultRecord({ ...record, passwordEnvelope: upgradedEnvelope });
    return true;
  });
}

export async function upgradeDemoRecoveryEnvelope(input: {
  recoveryPhrase: string;
  wordCount: RecoveryPhraseWordCount;
}): Promise<boolean> {
  return withVaultUnlockRateLimit(
    getDemoVaultUnlockRateLimiter(),
    DEMO_SECURITY_RATE_LIMIT_SCOPE,
    "recovery_phrase",
    async () => {
      const record = requireRecord();
      const vaultKey = requireVaultKey();
      const scope = vaultScope(DEMO_USER_ID);
      const envelope = recoveryPhraseEnvelopeSchema.parse(record.recoveryEnvelope);

      const { upgradedEnvelope } = await maybeUpgradeRecoveryEnvelopeAfterUnlock({
        vaultKey,
        recoveryPhrase: input.recoveryPhrase,
        envelope,
        scope,
        profile: VAULT_PROFILE,
        expectedWordCount: input.wordCount,
      });

      if (!upgradedEnvelope) return false;
      saveVaultRecord({ ...record, recoveryEnvelope: upgradedEnvelope });
      return true;
    }
  );
}

export async function deleteDemoVault(currentPassword: string): Promise<void> {
  return runDemoSecurityAttempt(async () => {
    const record = requireRecord();
    const scope = vaultScope(DEMO_USER_ID);
    const envelope = passwordEnvelopeSchema.parse(record.passwordEnvelope);

    await deleteVaultWithPasswordAuthorization({
      currentPassword,
      passwordEnvelope: envelope,
      scope,
      profile: VAULT_PROFILE,
      purgePersistedVault: () => {
        clearVaultRecord();
        clearPasskeyCredentialId();
      },
    });
  });
}
