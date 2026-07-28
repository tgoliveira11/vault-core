"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import {
  clampVaultAutoLockMinutes,
  readUserVaultAutoLockMinutes,
  VAULT_USER_AUTO_LOCK_MIN_MINUTES,
} from "@tgoliveira/vault-core/browser";
import { VaultSessionProvider } from "@tgoliveira/vault-core/react";
import { hydrateDemoEmergencyFromServer } from "@/lib/vault-demo-crypto";

const DemoVaultFeatureContext = createContext({ emergencyModeEnabled: false });

export function useDemoVaultFeatures() {
  return useContext(DemoVaultFeatureContext);
}

export function Providers({
  children,
  autoLockMinutes,
  emergencyModeEnabled,
}: {
  children: ReactNode;
  autoLockMinutes: number;
  emergencyModeEnabled: boolean;
}) {
  useEffect(() => {
    hydrateDemoEmergencyFromServer(emergencyModeEnabled);
  }, [emergencyModeEnabled]);

  const sessionConfig = {
    autoLockMinutes,
    resolveAutoLockMinutes: () => {
      const user = readUserVaultAutoLockMinutes();
      if (user == null) return undefined;
      return clampVaultAutoLockMinutes(user, {
        min: VAULT_USER_AUTO_LOCK_MIN_MINUTES,
        max: autoLockMinutes,
      });
    },
  };

  return (
    <DemoVaultFeatureContext.Provider value={{ emergencyModeEnabled }}>
      <VaultSessionProvider sessionConfig={sessionConfig} registerUnloadGuard>
        {children}
      </VaultSessionProvider>
    </DemoVaultFeatureContext.Provider>
  );
}
