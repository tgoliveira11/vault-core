import { type ReactNode, useEffect } from "react";
import {
  configureVaultSession,
  registerVaultUnloadGuard,
  registerVaultActivityGuard,
  type VaultSessionConfig,
} from "../../browser.js";

export type VaultSessionProviderProps = {
  children: ReactNode;
  sessionConfig?: VaultSessionConfig;
  registerUnloadGuard?: boolean;
  registerActivityGuard?: boolean;
};

export function VaultSessionProvider({
  children,
  sessionConfig,
  registerUnloadGuard = true,
  registerActivityGuard = true,
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
    return registerVaultActivityGuard();
  }, [registerActivityGuard]);

  return children;
}
