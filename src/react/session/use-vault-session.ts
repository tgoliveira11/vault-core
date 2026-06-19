import { useCallback, useEffect } from "react";
import {
  configureVaultSession,
  lockVaultSession,
  registerVaultUnloadGuard,
  registerVaultActivityGuard,
  touchVaultSession,
  type VaultSessionConfig,
} from "../../browser.js";
import { useVaultUnlocked } from "./use-vault-unlocked.js";

export type UseVaultSessionOptions = {
  sessionConfig?: VaultSessionConfig;
  registerUnloadGuard?: boolean;
  registerActivityGuard?: boolean;
};

export function useVaultSession(options: UseVaultSessionOptions = {}) {
  const {
    sessionConfig,
    registerUnloadGuard = true,
    registerActivityGuard = true,
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
    return registerVaultActivityGuard();
  }, [registerActivityGuard]);

  const lock = useCallback(() => {
    lockVaultSession();
  }, []);

  const touch = useCallback(() => {
    touchVaultSession();
  }, []);

  return {
    unlocked,
    lock,
    touch,
  };
}
