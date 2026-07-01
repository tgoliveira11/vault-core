"use client";

import type { ReactNode } from "react";
import { VaultSessionProvider } from "@tgoliveira/vault-core/react";

export function Providers({
  children,
  autoLockMinutes,
}: {
  children: ReactNode;
  autoLockMinutes: number;
}) {
  return (
    <VaultSessionProvider sessionConfig={{ autoLockMinutes }} registerUnloadGuard>
      {children}
    </VaultSessionProvider>
  );
}
