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
  minutes: number;
  setMinutes: (minutes: number) => void;
  resetToAdminDefault: () => void;
  adminMaxMinutes: number;
  minMinutes: number;
  usingUserPreference: boolean;
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
  adminResolvedMinutes: number
): UseVaultAutoLockPreferenceResult {
  const [userMinutes, setUserMinutes] = useState<number | null>(() =>
    readUserVaultAutoLockMinutes()
  );

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
    minutes,
    setMinutes,
    resetToAdminDefault,
    adminMaxMinutes: adminResolvedMinutes,
    minMinutes: VAULT_USER_AUTO_LOCK_MIN_MINUTES,
    usingUserPreference: userMinutes != null,
  };
}
