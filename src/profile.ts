export type VaultCryptoVersion = "vault-v1";

export type VaultCryptoProfile = {
  cryptoVersion: VaultCryptoVersion;
  aadContextVault: string;
  aadContextEnvelope: string;
};

export type VaultAadField = "vault_key" | "vault_payload" | "vault_index";

export type VaultAadScope = {
  userId: string;
  resourceId: string;
  field: VaultAadField;
  context?: string;
};

export type RecoveryPhraseWordCount = 12 | 24;

export type VaultLockState = "locked" | "unlocked";

export type VaultUnlockResult<TPayload> = {
  vaultKey: CryptoKey;
  payload: TPayload;
};

export function resolveAadContext(
  scope: Pick<VaultAadScope, "field" | "context">,
  profile: VaultCryptoProfile
): string {
  if (scope.context !== undefined) {
    return scope.context;
  }
  return scope.field === "vault_key"
    ? profile.aadContextEnvelope
    : profile.aadContextVault;
}
