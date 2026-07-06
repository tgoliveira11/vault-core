export type VaultSessionMode = "normal" | "emergency";

export type VaultSessionKeyRole = "primary" | "decoy";

let sessionVaultKey: CryptoKey | null = null;
let sessionMode: VaultSessionMode = "normal";
let sessionKeyRole: VaultSessionKeyRole | null = null;
/** Persists across lock when server emergency flag or decoy unlock pins routing. */
let emergencyModePinned = false;

export function getSessionVaultKey(): CryptoKey | null {
  return sessionVaultKey;
}

export function setSessionVaultKey(key: CryptoKey | null): void {
  sessionVaultKey = key;
  if (key === null) {
    sessionKeyRole = null;
  }
}

export function getVaultSessionMode(): VaultSessionMode {
  if (sessionVaultKey !== null && sessionKeyRole === "decoy") {
    return "emergency";
  }
  if (emergencyModePinned) {
    return "emergency";
  }
  return sessionMode;
}

export function isVaultEmergencyMode(): boolean {
  return getVaultSessionMode() === "emergency";
}

export function isEmergencyModePinned(): boolean {
  return emergencyModePinned;
}

export function getSessionKeyRole(): VaultSessionKeyRole | null {
  return sessionKeyRole;
}

export function enterVaultEmergencyMode(): void {
  emergencyModePinned = true;
  sessionMode = "emergency";
}

export function clearEmergencyModePin(): void {
  emergencyModePinned = false;
  sessionMode = "normal";
}

export function setSessionKeyRole(role: VaultSessionKeyRole): void {
  sessionKeyRole = role;
  if (role === "decoy") {
    enterVaultEmergencyMode();
  }
}

export function lockVault(): void {
  sessionVaultKey = null;
  sessionKeyRole = null;
}

export function isVaultUnlocked(): boolean {
  return sessionVaultKey !== null;
}

export function clearVaultClientState(): void {
  setSessionVaultKey(null);
  clearEmergencyModePin();
}

export type VaultLockState = ReturnType<typeof isVaultUnlocked> extends true ? "unlocked" : "locked";

export function getVaultLockState(): "locked" | "unlocked" {
  return isVaultUnlocked() ? "unlocked" : "locked";
}
