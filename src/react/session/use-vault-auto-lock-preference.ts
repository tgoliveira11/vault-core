"use client";

import { useCallback, useEffect, useState } from "react";
import {
  configureVaultSession,
  scheduleVaultAutoLock,
} from "../../session/auto-lock.js";
import {
  clampVaultAutoLockMinutes,
  clearUserVaultAutoLockMinutes,
  readUserVaultAutoLockMinutes,
  resolveVaultAutoLockMinutesPreference,
  writeUserVaultAutoLockMinutes,
  VAULT_USER_AUTO_LOCK_MIN_MINUTES,
} from "../../session/user-auto-lock-preference.js";

export type UseVaultAutoLockPreferenceResult = {
  hydrationStatus: "checking" | "ready";
  minutes: number;
  setMinutes: (minutes: number) => void;
  resetToAdminDefault: () => void;
  adminMaxMinutes: number;
  minMinutes: number;
  usingUserPreference: boolean;
};

export type UseVaultAutoLockPreferenceOptions = {
  /**
   * Server-resolved user preference used for the first server and client render.
   * Passing `null` explicitly means that the absence of a user override is already resolved.
   * When omitted, browser storage is read after hydration.
   */
  initialUserMinutes?: number | null;
};

function applySessionAutoLock(
  adminResolvedMinutes: number,
  userMinutes: number | null
): void {
  configureVaultSession({
    autoLockMinutes: adminResolvedMinutes,
    resolveAutoLockMinutes: () => {
      if (userMinutes == null) return undefined;
      return clampVaultAutoLockMinutes(userMinutes, {
        min: VAULT_USER_AUTO_LOCK_MIN_MINUTES,
        max: adminResolvedMinutes,
      });
    },
  });
  scheduleVaultAutoLock();
}

/** Manages per-user auto-lock minutes (user → admin → env → default) in the browser. */
export function useVaultAutoLockPreference(
  adminResolvedMinutes: number,
  options: UseVaultAutoLockPreferenceOptions = {}
): UseVaultAutoLockPreferenceResult {
  const hasInitialUserMinutes = Object.hasOwn(options, "initialUserMinutes");
  const initialUserMinutes = hasInitialUserMinutes
    ? options.initialUserMinutes ?? null
    : null;
  const [userMinutes, setUserMinutes] = useState<number | null>(initialUserMinutes);
  const [hydrationStatus, setHydrationStatus] = useState<"checking" | "ready">(
    hasInitialUserMinutes ? "ready" : "checking"
  );

  useEffect(() => {
    if (hasInitialUserMinutes) {
      setUserMinutes(initialUserMinutes);
      setHydrationStatus("ready");
      return;
    }

    setUserMinutes(readUserVaultAutoLockMinutes());
    setHydrationStatus("ready");
  }, [hasInitialUserMinutes, initialUserMinutes]);

  const minutes = resolveVaultAutoLockMinutesPreference({
    userMinutes,
    adminMinutes: adminResolvedMinutes,
  });

  useEffect(() => {
    applySessionAutoLock(adminResolvedMinutes, userMinutes);
  }, [adminResolvedMinutes, userMinutes]);

  const setMinutes = useCallback(
    (next: number) => {
      const clamped = clampVaultAutoLockMinutes(next, {
        min: VAULT_USER_AUTO_LOCK_MIN_MINUTES,
        max: adminResolvedMinutes,
      });
      writeUserVaultAutoLockMinutes(clamped);
      setUserMinutes(clamped);
    },
    [adminResolvedMinutes]
  );

  const resetToAdminDefault = useCallback(() => {
    clearUserVaultAutoLockMinutes();
    setUserMinutes(null);
  }, []);

  return {
    hydrationStatus,
    minutes,
    setMinutes,
    resetToAdminDefault,
    adminMaxMinutes: adminResolvedMinutes,
    minMinutes: VAULT_USER_AUTO_LOCK_MIN_MINUTES,
    usingUserPreference: userMinutes != null,
  };
}
