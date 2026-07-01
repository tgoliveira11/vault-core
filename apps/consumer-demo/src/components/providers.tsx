"use client";

import { useMemo, type ReactNode } from "react";
import {
  clampVaultAutoLockMinutes,
  readUserVaultAutoLockMinutes,
  VAULT_USER_AUTO_LOCK_MIN_MINUTES,
} from "@tgoliveira/vault-core/browser";
import { VaultSessionProvider } from "@tgoliveira/vault-core/react";

export function Providers({
  children,
  autoLockMinutes,
}: {
  children: ReactNode;
  autoLockMinutes: number;
}) {
  const sessionConfig = useMemo(
    () => ({
      autoLockMinutes,
      resolveAutoLockMinutes: () => {
        const user = readUserVaultAutoLockMinutes();
        if (user == null) return undefined;
        return clampVaultAutoLockMinutes(user, {
          min: VAULT_USER_AUTO_LOCK_MIN_MINUTES,
          max: autoLockMinutes,
        });
      },
    }),
    [autoLockMinutes]
  );

  return (
    <VaultSessionProvider sessionConfig={sessionConfig} registerUnloadGuard>
      {children}
    </VaultSessionProvider>
  );
}
