"use client";

import { useEffect, type ReactNode } from "react";
import {
  clampVaultAutoLockMinutes,
  readUserVaultAutoLockMinutes,
  VAULT_USER_AUTO_LOCK_MIN_MINUTES,
} from "@tgoliveira/vault-core/browser";
import { VaultSessionProvider } from "@tgoliveira/vault-core/react";
import { hydrateDemoEmergencyFromServer } from "@/lib/vault-demo-crypto";

export function Providers({
  children,
  autoLockMinutes,
}: {
  children: ReactNode;
  autoLockMinutes: number;
}) {
  useEffect(() => {
    hydrateDemoEmergencyFromServer();
  }, []);

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
    <VaultSessionProvider sessionConfig={sessionConfig} registerUnloadGuard>
      {children}
    </VaultSessionProvider>
  );
}
