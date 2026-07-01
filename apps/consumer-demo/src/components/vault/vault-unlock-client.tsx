"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  VaultUnlockPanel,
  readVaultUnlockReturnPath,
  useVaultUnlockPageNavigation,
} from "@tgoliveira/vault-core/react";
import { AppShell } from "@/components/app-shell";
import {
  isDemoPasskeyUnlockAvailable,
  unlockDemoVault,
  unlockDemoVaultWithPasskey,
  unlockDemoVaultWithRecoveryPhrase,
} from "@/lib/vault-demo-crypto";
import { getDemoPasskeySupport } from "@/lib/vault-demo-passkey";
import { isVaultConfigured, loadVaultRecord } from "@/lib/vault-demo-store";
import { getDemoVaultUnlockRateLimiter } from "@/lib/vault-rate-limit";

function VaultUnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = readVaultUnlockReturnPath(searchParams, { defaultPath: "/vault" });
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [hasPasskeyEnvelope, setHasPasskeyEnvelope] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passkeySupport = getDemoPasskeySupport();
  const passkeyReady = isDemoPasskeyUnlockAvailable();

  useEffect(() => {
    setConfigured(isVaultConfigured());
    const record = loadVaultRecord();
    setHasPasskeyEnvelope(Boolean(record?.passkeyPrfEnvelope));
  }, []);

  useVaultUnlockPageNavigation({
    configured,
    returnPath,
    setupPath: "/vault/setup",
    onNavigate: (path) => router.replace(path),
  });

  const runUnlock = useCallback(
    async (unlock: () => Promise<unknown>) => {
      setError(null);
      setBusy(true);
      try {
        await unlock();
        router.push(returnPath);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unlock failed. Check your credentials and try again."
        );
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [returnPath, router]
  );

  const handleUnlockPassword = useCallback(
    (password: string) => runUnlock(() => unlockDemoVault(password)),
    [runUnlock]
  );

  const handleUnlockRecoveryPhrase = useCallback(
    (phrase: string) => runUnlock(() => unlockDemoVaultWithRecoveryPhrase(phrase)),
    [runUnlock]
  );

  const handleUnlockPasskey = useCallback(
    () => runUnlock(() => unlockDemoVaultWithPasskey()),
    [runUnlock]
  );

  if (configured === null) {
    return (
      <AppShell title="Unlock vault" description="Loading vault status…">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Unlock vault"
      description="Your account may be signed in, but the vault stays locked until you unlock it. The UVK stays in memory only — reloading the page locks the vault again."
    >
      <div className="vc-admin-card max-w-lg">
        <VaultUnlockPanel
          loading={busy}
          error={error}
          unlockRateLimiter={getDemoVaultUnlockRateLimiter()}
          rateLimitScopeKey="demo"
          serverStatus={{
            configured,
            hasPasskeyPrfEnvelope: hasPasskeyEnvelope,
          }}
          prfSupported={passkeySupport.prf}
          passkeyReady={passkeyReady}
          onUnlockPassword={handleUnlockPassword}
          onUnlockRecoveryPhrase={handleUnlockRecoveryPhrase}
          onUnlockPasskey={passkeyReady ? handleUnlockPasskey : undefined}
        />
      </div>
    </AppShell>
  );
}

export function VaultUnlockClient() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-[var(--muted)]">Loading…</p>}>
      <VaultUnlockForm />
    </Suspense>
  );
}
