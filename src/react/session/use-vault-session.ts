import { useCallback, useEffect } from "react";
import {
  configureVaultSession,
  lockVaultSession,
  registerVaultUnloadGuard,
  touchVaultSession,
  type VaultSessionConfig,
} from "../../browser.js";
import { useVaultUnlocked } from "./use-vault-unlocked.js";

export type UseVaultSessionOptions = {
  sessionConfig?: VaultSessionConfig;
  registerUnloadGuard?: boolean;
};

export function useVaultSession(options: UseVaultSessionOptions = {}) {
  const { sessionConfig, registerUnloadGuard = true } = options;
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
