import { type ReactNode, useEffect } from "react";
import {
  configureVaultSession,
  registerVaultUnloadGuard,
  registerVaultActivityGuard,
  type VaultSessionConfig,
  type VaultSessionLease,
} from "../../browser.js";

export type VaultSessionProviderProps = {
  children: ReactNode;
  sessionConfig?: VaultSessionConfig;
  registerUnloadGuard?: boolean;
  registerActivityGuard?: boolean;
  /** Required for activity renewal after owner-scoped session mode is enabled. */
  lease?: VaultSessionLease;
};

export function VaultSessionProvider({
  children,
  sessionConfig,
  registerUnloadGuard = true,
  registerActivityGuard = false,
  lease,
}: VaultSessionProviderProps) {
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

  return children;
}
