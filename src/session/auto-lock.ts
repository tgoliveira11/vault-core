import { DEFAULT_VAULT_AUTO_LOCK_MINUTES } from "../constants.js";
import { isVaultUnlocked, lockVault, setSessionVaultKey } from "./memory-session.js";

export type VaultSessionConfig = {
  autoLockMinutes?: number;
  resolveAutoLockMinutes?: () => number | undefined;
};

let sessionConfig: VaultSessionConfig = {};
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let manuallyLocked = false;
let lastActivityAt = 0;
const listeners = new Set<() => void>();
const DEFAULT_ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "focus"] as const;

export function configureVaultSession(config: VaultSessionConfig): void {
  sessionConfig = config;
}

function getAutoLockTimeoutMs(): number {
  const resolved = sessionConfig.resolveAutoLockMinutes?.();
  const minutes =
    resolved ??
    sessionConfig.autoLockMinutes ??
    DEFAULT_VAULT_AUTO_LOCK_MINUTES;
  const safeMinutes =
    Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_VAULT_AUTO_LOCK_MINUTES;
  return safeMinutes * 60 * 1000;
}

function notifyVaultSessionChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeVaultSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isVaultManuallyLocked(): boolean {
  return manuallyLocked;
}

export function clearVaultAutoLockTimer(): void {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

export function scheduleVaultAutoLock(): void {
  if (!isVaultUnlocked() || manuallyLocked) return;
  clearVaultAutoLockTimer();
  lastActivityAt = Date.now();
  inactivityTimer = setTimeout(() => {
    lockVaultSession();
  }, getAutoLockTimeoutMs());
}

export function touchVaultSession(): void {
  if (isVaultUnlocked() && !manuallyLocked) {
    scheduleVaultAutoLock();
  }
}

export function unlockVaultSession(vaultKey: CryptoKey): void {
  manuallyLocked = false;
  setSessionVaultKey(vaultKey);
  scheduleVaultAutoLock();
  notifyVaultSessionChange();
}

export function lockVaultSession(): void {
  clearVaultAutoLockTimer();
  lastActivityAt = 0;
  lockVault();
  manuallyLocked = true;
  notifyVaultSessionChange();
}

export function lockVaultSessionManually(): void {
  lockVaultSession();
}

export function resetVaultSessionLockState(): void {
  manuallyLocked = false;
  clearVaultAutoLockTimer();
  lastActivityAt = 0;
  notifyVaultSessionChange();
}

export function registerVaultUnloadGuard(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = () => lockVaultSession();
  window.addEventListener("pagehide", handler);
  return () => window.removeEventListener("pagehide", handler);
}

export function registerVaultActivityGuard(
  events: readonly string[] = DEFAULT_ACTIVITY_EVENTS
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = () => touchVaultSession();
  for (const event of events) {
    window.addEventListener(event, handler, { passive: true });
  }
  return () => {
    for (const event of events) {
      window.removeEventListener(event, handler);
    }
  };
}

export function getVaultAutoLockRemainingMs(): number | null {
  if (!isVaultUnlocked() || manuallyLocked || lastActivityAt === 0) return null;
  return Math.max(0, getAutoLockTimeoutMs() - (Date.now() - lastActivityAt));
}

export {
  getSessionVaultKey,
  isVaultUnlocked,
} from "./memory-session.js";
