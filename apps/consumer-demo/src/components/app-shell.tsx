"use client";

import { AppHeader } from "@/components/app-header";
import { VaultUnlockedGate } from "@/components/vault/vault-unlocked-gate";
import { VaultLockOverlayExclude } from "@tgoliveira/vault-core/react";

export function AppShell({
  title,
  description,
  children,
  vaultProtected = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** When true, wraps page content with the vault lock overlay instead of redirecting on lock. */
  vaultProtected?: boolean;
}) {
  const main = (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {description ? (
        <p className="mb-6 text-sm text-[var(--muted)] leading-relaxed">{description}</p>
      ) : null}
      {children}
    </main>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <VaultLockOverlayExclude>
        <AppHeader title={title} />
      </VaultLockOverlayExclude>

      {vaultProtected ? <VaultUnlockedGate>{main}</VaultUnlockedGate> : main}
    </div>
  );
}
