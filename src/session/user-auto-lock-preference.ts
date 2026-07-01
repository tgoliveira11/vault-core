import { DEFAULT_VAULT_AUTO_LOCK_MINUTES } from "../constants.js";

export const VAULT_USER_AUTO_LOCK_MIN_MINUTES = 1;

export const DEFAULT_USER_VAULT_AUTO_LOCK_STORAGE_KEY =
  "vault-core:user:auto-lock-minutes";

export type ResolveVaultAutoLockMinutesOptions = {
  /** User preference from localStorage or app store. */
  userMinutes?: number | null;
  /** Admin-resolved ceiling and fallback (admin → env → default). */
  adminMinutes?: number | null;
  /** Raw env minutes when admin layer is not pre-resolved. */
  envMinutes?: number | null;
  /** Package default when nothing else is set. */
  defaultMinutes?: number;
  minMinutes?: number;
};

export function clampVaultAutoLockMinutes(
  minutes: number,
  options: { min?: number; max: number }
): number {
  const min = options.min ?? VAULT_USER_AUTO_LOCK_MIN_MINUTES;
  const max = Math.max(min, options.max);
  if (!Number.isFinite(minutes)) return min;
  return Math.min(Math.max(Math.round(minutes), min), max);
}

/**
 * Resolves vault auto-lock minutes with priority:
 * user → admin → env → default.
 * User values are clamped to [min, adminMax].
 */
export function resolveVaultAutoLockMinutesPreference(
  options: ResolveVaultAutoLockMinutesOptions
): number {
  const min = options.minMinutes ?? VAULT_USER_AUTO_LOCK_MIN_MINUTES;
  const defaultMinutes = options.defaultMinutes ?? DEFAULT_VAULT_AUTO_LOCK_MINUTES;

  if (options.userMinutes != null) {
    const adminCeiling = options.adminMinutes ?? defaultMinutes;
    return clampVaultAutoLockMinutes(options.userMinutes, {
      min,
      max: Math.max(min, adminCeiling),
    });
  }
  if (options.adminMinutes != null) {
    return clampVaultAutoLockMinutes(options.adminMinutes, {
      min,
      max: options.adminMinutes,
    });
  }
  if (options.envMinutes != null) {
    return clampVaultAutoLockMinutes(options.envMinutes, {
      min,
      max: options.envMinutes,
    });
  }
  return clampVaultAutoLockMinutes(defaultMinutes, { min, max: defaultMinutes });
}

export function readUserVaultAutoLockMinutes(
  storageKey = DEFAULT_USER_VAULT_AUTO_LOCK_STORAGE_KEY
): number | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== "function") return null;
    const raw = storage.getItem(storageKey);
    if (raw == null || raw.trim() === "") return null;
    const minutes = Number.parseInt(raw, 10);
    if (!Number.isFinite(minutes)) return null;
    return minutes;
  } catch {
    return null;
  }
}

export function writeUserVaultAutoLockMinutes(
  minutes: number,
  storageKey = DEFAULT_USER_VAULT_AUTO_LOCK_STORAGE_KEY
): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    if (!storage || typeof storage.setItem !== "function") return;
    storage.setItem(storageKey, String(Math.round(minutes)));
  } catch {
    // UI preference is non-critical.
  }
}

export function clearUserVaultAutoLockMinutes(
  storageKey = DEFAULT_USER_VAULT_AUTO_LOCK_STORAGE_KEY
): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    if (!storage || typeof storage.removeItem !== "function") return;
    storage.removeItem(storageKey);
  } catch {
    // UI preference is non-critical.
  }
}
