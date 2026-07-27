import { useCallback, useEffect } from "react";
import {
  configureVaultSession,
  lockVaultSession,
  registerVaultUnloadGuard,
  registerVaultActivityGuard,
  touchVaultSession,
  type VaultSessionConfig,
  type VaultSessionLease,
} from "../../browser.js";
import { useVaultUnlocked } from "./use-vault-unlocked.js";

export type UseVaultSessionOptions = {
  sessionConfig?: VaultSessionConfig;
  registerUnloadGuard?: boolean;
  registerActivityGuard?: boolean;
  /** Required for touch/activity renewal after owner-scoped session mode is enabled. */
  lease?: VaultSessionLease;
};

export function useVaultSession(options: UseVaultSessionOptions = {}) {
  const {
    sessionConfig,
    registerUnloadGuard = true,
    registerActivityGuard = false,
    lease,
  } = options;
  const unlocked = useVaultUnlocked();

  useEffect(() => {
    if (sessionConfig) {
      configureVaultSession(sessionConfig);
    }
  }, [sessionConfig]);

  useEffect(() => {
    if (!registerUnloadGuard) return;
    return registerVaultUnloadGuard();
  }, [registerUnloadGuard]);

  useEffect(() => {
    if (!registerActivityGuard) return;
    return registerVaultActivityGuard(undefined, lease);
  }, [lease, registerActivityGuard]);

  const lock = useCallback(() => {
    lockVaultSession();
  }, []);

  const touch = useCallback(() => {
    touchVaultSession(lease);
  }, [lease]);

  return {
    unlocked,
    lock,
    touch,
  };
}
