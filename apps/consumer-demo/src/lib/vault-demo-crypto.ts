import {
  createPasswordEnvelope,
  createRecoveryEnvelope,
  createRecoveryPhrase,
  createUserVaultKey,
  decryptVaultPayload,
  encryptVaultPayload,
  passkeyPrfEnvelopeSchema,
  passwordEnvelopeSchema,
  recoveryPhraseEnvelopeSchema,
  unlockWithPasswordEnvelope,
  unlockWithPasskeyPrfEnvelope,
  unlockWithRecoveryEnvelope,
  vaultSetupEnvelopeFieldsSchema,
  withVaultUnlockRateLimit,
  type EncryptedVaultPayload,
} from "@tgoliveira/vault-core";
import { unlockVaultSession, getSessionVaultKey } from "@tgoliveira/vault-core/browser";
import { DEMO_USER_ID, VAULT_PROFILE, vaultScope } from "@/lib/vault-profile";
import { authenticateDemoPasskey, loadPasskeyCredentialId } from "@/lib/vault-demo-passkey";
import { getDemoVaultUnlockRateLimiter } from "@/lib/vault-rate-limit";
import { loadVaultRecord, saveVaultRecord, type StoredVaultRecord } from "@/lib/vault-demo-store";

const DEMO_UNLOCK_SCOPE = "demo";

function runDemoUnlockAttempt<T>(
  action: "password" | "recovery_phrase" | "passkey_prf",
  attempt: () => Promise<T>
): Promise<T> {
  return withVaultUnlockRateLimit(
    getDemoVaultUnlockRateLimiter(),
    DEMO_UNLOCK_SCOPE,
    action,
    attempt
  );
}

export type DemoVaultPayload = {
  version: 1;
  notes: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
  }>;
};

const EMPTY_PAYLOAD: DemoVaultPayload = {
  version: 1,
  notes: [],
};

export async function createDemoVault(input: {
  vaultPassword: string;
  recoveryWordCount: 12 | 24;
}): Promise<{ recoveryPhrase: string; record: StoredVaultRecord }> {
  const scope = vaultScope(DEMO_USER_ID);
  const vaultKey = await createUserVaultKey();
  const recoveryPhrase = createRecoveryPhrase({ wordCount: input.recoveryWordCount });

  const { envelope: passwordEnvelope } = await createPasswordEnvelope(
    vaultKey,
    input.vaultPassword,
    scope,
    VAULT_PROFILE
  );

  const { envelope: recoveryEnvelope } = await createRecoveryEnvelope(
    vaultKey,
    recoveryPhrase,
    scope,
    VAULT_PROFILE,
    { phraseLength: input.recoveryWordCount }
  );

  const encryptedBlob = await encryptVaultPayload(
    EMPTY_PAYLOAD,
    vaultKey,
    scope,
    VAULT_PROFILE
  );

  const record = vaultSetupEnvelopeFieldsSchema.parse({
    cryptoVersion: "vault-v1",
    encryptedBlob,
    passwordEnvelope,
    recoveryEnvelope,
    passkeyPrfEnvelope: null,
  });

  saveVaultRecord(record);
  unlockVaultSession(vaultKey);

  return { recoveryPhrase, record };
}

export async function unlockDemoVault(vaultPassword: string): Promise<DemoVaultPayload> {
  return runDemoUnlockAttempt("password", async () => {
    const record = loadVaultRecord();
    if (!record) {
      throw new Error("Vault is not configured");
    }

    const scope = vaultScope(DEMO_USER_ID);
    const envelope = passwordEnvelopeSchema.parse(record.passwordEnvelope);
    const vaultKey = await unlockWithPasswordEnvelope(
      vaultPassword,
      envelope,
      scope,
      VAULT_PROFILE
    );

    const payload = await decryptVaultPayload<DemoVaultPayload>(
      record.encryptedBlob,
      vaultKey,
      scope,
      VAULT_PROFILE
    );

    unlockVaultSession(vaultKey);
    return payload;
  });
}

export async function unlockDemoVaultWithRecoveryPhrase(
  recoveryPhrase: string
): Promise<DemoVaultPayload> {
  return runDemoUnlockAttempt("recovery_phrase", async () => {
    const record = loadVaultRecord();
    if (!record) {
      throw new Error("Vault is not configured");
    }

    const scope = vaultScope(DEMO_USER_ID);
    const envelope = recoveryPhraseEnvelopeSchema.parse(record.recoveryEnvelope);
    const vaultKey = await unlockWithRecoveryEnvelope(
      recoveryPhrase,
      envelope,
      scope,
      VAULT_PROFILE
    );

    const payload = await decryptVaultPayload<DemoVaultPayload>(
      record.encryptedBlob,
      vaultKey,
      scope,
      VAULT_PROFILE
    );

    unlockVaultSession(vaultKey);
    return payload;
  });
}

export async function unlockDemoVaultWithPasskey(): Promise<DemoVaultPayload> {
  return runDemoUnlockAttempt("passkey_prf", async () => {
    const record = loadVaultRecord();
    if (!record?.passkeyPrfEnvelope) {
      throw new Error("Passkey unlock is not configured");
    }

    const credentialId = loadPasskeyCredentialId();
    if (!credentialId) {
      throw new Error("No passkey credential is linked on this device");
    }

    const prfOutput = await authenticateDemoPasskey(credentialId);
    const scope = vaultScope(DEMO_USER_ID);
    const envelope = passkeyPrfEnvelopeSchema.parse(record.passkeyPrfEnvelope);
    const vaultKey = await unlockWithPasskeyPrfEnvelope(
      envelope,
      prfOutput,
      scope,
      VAULT_PROFILE
    );

    const payload = await decryptVaultPayload<DemoVaultPayload>(
      record.encryptedBlob,
      vaultKey,
      scope,
      VAULT_PROFILE
    );

    unlockVaultSession(vaultKey);
    return payload;
  });
}

export function isDemoPasskeyUnlockAvailable(): boolean {
  const record = loadVaultRecord();
  if (!record?.passkeyPrfEnvelope) return false;
  return loadPasskeyCredentialId() != null;
}

export async function loadDecryptedDemoPayload(): Promise<DemoVaultPayload | null> {
  const record = loadVaultRecord();
  if (!record) return null;

  const vaultKey = getSessionVaultKey();
  if (!vaultKey) return null;

  const scope = vaultScope(DEMO_USER_ID);
  return decryptVaultPayload<DemoVaultPayload>(
    record.encryptedBlob,
    vaultKey,
    scope,
    VAULT_PROFILE
  );
}

export async function saveDemoPayload(
  payload: DemoVaultPayload
): Promise<EncryptedVaultPayload> {
  const record = loadVaultRecord();
  if (!record) {
    throw new Error("Vault is not configured");
  }

  const vaultKey = getSessionVaultKey();
  if (!vaultKey) {
    throw new Error("Vault is locked");
  }

  const scope = vaultScope(DEMO_USER_ID);
  const encryptedBlob = await encryptVaultPayload(
    payload,
    vaultKey,
    scope,
    VAULT_PROFILE
  );

  saveVaultRecord({
    ...record,
    encryptedBlob,
  });

  return encryptedBlob;
}
