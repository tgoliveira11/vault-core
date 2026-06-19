let sessionVaultKey: CryptoKey | null = null;

export function getSessionVaultKey(): CryptoKey | null {
  return sessionVaultKey;
}

export function setSessionVaultKey(key: CryptoKey | null): void {
  sessionVaultKey = key;
}

export function lockVault(): void {
  sessionVaultKey = null;
}

export function isVaultUnlocked(): boolean {
  return sessionVaultKey !== null;
}

export function clearVaultClientState(): void {
  setSessionVaultKey(null);
}

export type VaultLockState = ReturnType<typeof isVaultUnlocked> extends true ? "unlocked" : "locked";

export function getVaultLockState(): "locked" | "unlocked" {
  return isVaultUnlocked() ? "unlocked" : "locked";
}
