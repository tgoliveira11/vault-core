import { DEFAULT_VAULT_AUTO_LOCK_MINUTES, MAX_VAULT_AUTO_LOCK_MINUTES } from "../constants.js";
import { assertUserVaultKeyNonExtractable } from "../keys/user-vault-key.js";
import {
  clampVaultAutoLockMinutes,
  VAULT_USER_AUTO_LOCK_MIN_MINUTES,
} from "./user-auto-lock-preference.js";
import {
  isVaultUnlocked,
  lockVault,
  setSessionVaultKey,
  setSessionKeyRole,
  getVaultSessionMode,
  isVaultEmergencyMode,
  enterVaultEmergencyMode as enterVaultEmergencyModeInternal,
  clearEmergencyModePin as clearEmergencyModePinInternal,
  isEmergencyModePinned,
  getSessionKeyRole,
  type VaultSessionMode,
  type VaultSessionKeyRole,
} from "./memory-session.js";
import {
  clearVaultInnerKeyMaterialCacheForSessionLock,
  hasCachedVaultInnerKeyMaterial,
} from "./inner-key-material-cache.js";
import { runVaultLockCleanupHandlers } from "./vault-lock-cleanup.js";
import {
  assertVaultSessionMutationAllowed,
  assertVaultSessionLeaseMutationAllowed,
  assertVaultSessionOperationOwnerId,
  clearVaultSessionOperationOwner,
  commitVaultSessionLease,
  getVaultSessionOperationOwner,
  invalidateVaultSessionOperation,
  invalidateVaultSessionLease,
  issueVaultSessionOperation,
  type VaultSessionMutationOptions,
  type VaultSessionLease,
  type VaultSessionOperation,
} from "./vault-session-operation.js";

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

function scheduleVaultAutoLockInternal(): void {
  if (!isVaultUnlocked() || manuallyLocked) return;
  clearVaultAutoLockTimer();
  lastActivityAt = Date.now();
  inactivityTimer = setTimeout(() => {
    lockVaultSession();
  }, getAutoLockTimeoutMs());
}

export function scheduleVaultAutoLock(lease?: VaultSessionLease): void {
  if (!isVaultUnlocked() || manuallyLocked) return;
  assertVaultSessionLeaseMutationAllowed(lease);
  scheduleVaultAutoLockInternal();
}

export function touchVaultSession(lease?: VaultSessionLease): void {
  if (isVaultUnlocked() && !manuallyLocked) {
    assertVaultSessionLeaseMutationAllowed(lease);
    scheduleVaultAutoLockInternal();
  }
}

export async function unlockVaultSession(
  vaultKey: CryptoKey,
  options?: { role?: VaultSessionKeyRole; operation?: VaultSessionOperation }
): Promise<VaultSessionLease | null> {
  assertVaultSessionMutationAllowed(options?.operation);
  await assertUserVaultKeyNonExtractable(vaultKey);
  assertVaultSessionMutationAllowed(options?.operation);
  manuallyLocked = false;
  const role = options?.role ?? "primary";
  setSessionKeyRole(role);
  setSessionVaultKey(vaultKey);
  const lease = commitVaultSessionLease(options?.operation, vaultKey, role);
  scheduleVaultAutoLockInternal();
  notifyVaultSessionChange();
  return lease;
}

export function lockVaultSession(): void {
  invalidateVaultSessionOperation();
  invalidateVaultSessionLease();
  clearVaultAutoLockTimer();
  lastActivityAt = 0;
  clearVaultInnerKeyMaterialCacheForSessionLock();
  lockVault();
  manuallyLocked = true;
  runVaultLockCleanupHandlers();
  notifyVaultSessionChange();
}

/**
 * Starts a last-operation-wins epoch for one opaque account/session owner.
 * An A → B transition synchronously purges A's session, cache, cleanup state, and emergency pin.
 */
export function beginVaultSessionUnlock(ownerId: string): VaultSessionOperation {
  assertVaultSessionOperationOwnerId(ownerId);
  const currentOwnerId = getVaultSessionOperationOwner();
  const ownerChanged = currentOwnerId !== null && currentOwnerId !== ownerId;
  const hasUnownedSensitiveState =
    currentOwnerId === null &&
    (isVaultUnlocked() || hasCachedVaultInnerKeyMaterial() || isVaultEmergencyMode());

  if (ownerChanged || hasUnownedSensitiveState) {
    lockVaultSession();
    clearEmergencyModePinInternal();
  }

  return issueVaultSessionOperation(ownerId);
}

/** Compatibility name for generalized setup/finalize and passkey-management flows. */
export const beginVaultSessionOperation = beginVaultSessionUnlock;

/** Logout/account-removal boundary: cancel work and clear all owner-scoped browser vault state. */
export function clearVaultSessionOwner(): void {
  lockVaultSession();
  clearEmergencyModePinInternal();
  clearVaultSessionOperationOwner();
}

/** Guarded emergency pin mutation for owner-scoped consumers. */
export function enterVaultEmergencyMode(options?: VaultSessionMutationOptions): void {
  assertVaultSessionMutationAllowed(options?.operation);
  enterVaultEmergencyModeInternal();
}

/** Guarded emergency pin clear for owner-scoped consumers. */
export function clearEmergencyModePin(options?: VaultSessionMutationOptions): void {
  assertVaultSessionMutationAllowed(options?.operation);
  clearEmergencyModePinInternal();
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
  events: readonly string[] = DEFAULT_ACTIVITY_EVENTS,
  lease?: VaultSessionLease
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = (event: Event) => {
    if (shouldIgnoreVaultActivityEvent(event)) return;
    touchVaultSession(lease);
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
  getVaultSessionMode,
  isVaultEmergencyMode,
  isEmergencyModePinned,
  getSessionKeyRole,
  type VaultSessionMode,
  type VaultSessionKeyRole,
} from "./memory-session.js";
