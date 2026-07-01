import { DEFAULT_VAULT_AUTO_LOCK_MINUTES, MAX_VAULT_AUTO_LOCK_MINUTES } from "../constants.js";
import { assertUserVaultKeyNonExtractable } from "../keys/user-vault-key.js";
import {
  clampVaultAutoLockMinutes,
  VAULT_USER_AUTO_LOCK_MIN_MINUTES,
} from "./user-auto-lock-preference.js";
import { isVaultUnlocked, lockVault, setSessionVaultKey } from "./memory-session.js";

export type VaultSessionConfig = {
  autoLockMinutes?: number;
  resolveAutoLockMinutes?: () => number | undefined;
};

let sessionConfig: VaultSessionConfig = {};
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let manuallyLocked = false;
let lastActivityAt = 0;
let activitySuppressedUntil = 0;
const listeners = new Set<() => void>();
const DEFAULT_ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "focus"] as const;
const VAULT_DOCK_IGNORE_ACTIVITY_SELECTOR = "[data-vault-dock-ignore-activity]";

export function configureVaultSession(config: VaultSessionConfig): void {
  sessionConfig = config;
}

function getAutoLockTimeoutMs(): number {
  return getVaultAutoLockMinutes() * 60 * 1000;
}

/** Resolved vault auto-lock duration in minutes (session config, then package default). */
export function getVaultAutoLockMinutes(): number {
  const resolved =
    sessionConfig.resolveAutoLockMinutes?.() ??
    sessionConfig.autoLockMinutes ??
    DEFAULT_VAULT_AUTO_LOCK_MINUTES;
  const rawAdminMinutes =
    sessionConfig.autoLockMinutes ?? DEFAULT_VAULT_AUTO_LOCK_MINUTES;
  const adminCeiling = clampVaultAutoLockMinutes(
    Number.isFinite(rawAdminMinutes) && rawAdminMinutes > 0
      ? rawAdminMinutes
      : DEFAULT_VAULT_AUTO_LOCK_MINUTES,
    { min: VAULT_USER_AUTO_LOCK_MIN_MINUTES, max: MAX_VAULT_AUTO_LOCK_MINUTES }
  );
  const minutes =
    Number.isFinite(resolved) && resolved > 0 ? resolved : DEFAULT_VAULT_AUTO_LOCK_MINUTES;
  return clampVaultAutoLockMinutes(minutes, {
    min: VAULT_USER_AUTO_LOCK_MIN_MINUTES,
    max: adminCeiling,
  });
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

export async function unlockVaultSession(vaultKey: CryptoKey): Promise<void> {
  await assertUserVaultKeyNonExtractable(vaultKey);
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

/**
 * Briefly suppress `registerVaultActivityGuard` listeners (not explicit `touchVaultSession`).
 * Used around vault status dock open/close when activity-based renewal is enabled.
 */
export function suppressVaultActivity(ms = 500): void {
  activitySuppressedUntil = Date.now() + ms;
}

function shouldIgnoreVaultActivityEvent(event: Event): boolean {
  if (Date.now() < activitySuppressedUntil) return true;
  const target = event.target;
  if (
    target instanceof Element &&
    target.closest(VAULT_DOCK_IGNORE_ACTIVITY_SELECTOR)
  ) {
    return true;
  }
  if (
    event.type === "focus" &&
    (target === document.body || target === document.documentElement)
  ) {
    return true;
  }
  return false;
}

/**
 * Opt-in: renew the auto-lock countdown on pointer, keyboard, touch, and focus events.
 * Default session integration does not register this guard; only explicit `touchVaultSession()`
 * (for example the vault status dock "Stay unlocked" action) resets the timer.
 */
export function registerVaultActivityGuard(
  events: readonly string[] = DEFAULT_ACTIVITY_EVENTS
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = (event: Event) => {
    if (shouldIgnoreVaultActivityEvent(event)) return;
    touchVaultSession();
  };
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
