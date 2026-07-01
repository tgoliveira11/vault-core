"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { VaultProtectedGate } from "@tgoliveira/vault-core/react";
import { isVaultConfigured } from "@/lib/vault-demo-store";

export function VaultUnlockedGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    setConfigured(isVaultConfigured());
  }, []);

  return (
    <VaultProtectedGate
      configured={configured}
      redirectToSetup="/vault/setup"
      onRedirectToSetup={(path) => router.replace(path)}
      overlayBackground="color-mix(in srgb, var(--background) 92%, transparent)"
    >
      {children}
    </VaultProtectedGate>
  );
}
