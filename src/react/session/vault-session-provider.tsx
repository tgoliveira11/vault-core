import { type ReactNode, useEffect } from "react";
import {
  configureVaultSession,
  registerVaultUnloadGuard,
  type VaultSessionConfig,
} from "../../browser.js";

export type VaultSessionProviderProps = {
  children: ReactNode;
  sessionConfig?: VaultSessionConfig;
  registerUnloadGuard?: boolean;
};

export function VaultSessionProvider({
  children,
  sessionConfig,
  registerUnloadGuard = true,
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

  return children;
}
