"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useVaultUnlocked } from "@tgoliveira/vault-core/react";
import { isVaultConfigured } from "@/lib/vault-demo-store";

export function VaultUnlockedGate({
  children,
  redirectTo = "/vault/unlock?next=/vault",
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const unlocked = useVaultUnlocked();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    const exists = isVaultConfigured();
    setConfigured(exists);
    setReady(true);
    if (!exists) {
      router.replace("/vault/setup");
      return;
    }
    if (!unlocked) {
      router.replace(redirectTo);
    }
  }, [unlocked, router, redirectTo]);

  if (!ready || !configured || !unlocked) {
    return (
      <p className="text-sm text-[var(--muted)]">Checking vault session…</p>
    );
  }

  return children;
}
