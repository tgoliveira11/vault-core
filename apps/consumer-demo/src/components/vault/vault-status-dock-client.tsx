"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  VaultDockQuickUnlock,
  VaultStatusDock,
  buildVaultUnlockHref,
  type VaultStatusDockLinkProps,
} from "@tgoliveira/vault-core/react";
import { isDemoPasskeyUnlockAvailable, unlockDemoVault, unlockDemoVaultWithPasskey } from "@/lib/vault-demo-crypto";
import { getDemoPasskeySupport } from "@/lib/vault-demo-passkey";
import { isVaultConfigured, loadVaultRecord } from "@/lib/vault-demo-store";
import { getDemoVaultUnlockRateLimiter } from "@/lib/vault-rate-limit";

function DemoLink({ href, className, children, onClick }: VaultStatusDockLinkProps) {
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

const UNLOCK_PATH = "/vault/unlock";

function VaultStatusDockClientInner() {
  const router = useRouter();
  const pathname = usePathname();
  const [configured, setConfigured] = useState(false);
  const [hasPasskeyEnvelope, setHasPasskeyEnvelope] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passkeySupport = getDemoPasskeySupport();

  useEffect(() => {
    setConfigured(isVaultConfigured());
    const record = loadVaultRecord();
    setHasPasskeyEnvelope(Boolean(record?.passkeyPrfEnvelope));
  }, [pathname]);

  const handleUnlockPassword = useCallback(async (password: string) => {
    setError(null);
    setLoading(true);
    try {
      await unlockDemoVault(password);
    } catch {
      setError("Unlock failed. Check your vault password and try again.");
      throw new Error("unlock failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUnlockPasskey = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await unlockDemoVaultWithPasskey();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Passkey unlock failed.");
      throw caught;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNavigateToUnlock = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  return (
    <VaultStatusDock
      visible={configured}
      serverStatus={{
        configured,
        hasPasskeyPrfEnvelope: hasPasskeyEnvelope,
      }}
      prfSupported={passkeySupport.prf}
      pathname={pathname}
      unlockPath={UNLOCK_PATH}
      buildUnlockHref={(returnPath) => buildVaultUnlockHref(UNLOCK_PATH, returnPath)}
      onNavigateToUnlock={handleNavigateToUnlock}
      loading={loading}
      unlockError={error}
      LinkComponent={DemoLink}
      renderQuickUnlock={({ loading: quickLoading, error: quickError, onPasskeyUnlockFailed }) => (
        <VaultDockQuickUnlock
          loading={quickLoading}
          error={quickError}
          unlockRateLimiter={getDemoVaultUnlockRateLimiter()}
          rateLimitScopeKey="demo"
          serverStatus={{
            configured,
            hasPasskeyPrfEnvelope: hasPasskeyEnvelope,
          }}
          onUnlockPassword={handleUnlockPassword}
          onUnlockPasskey={
            isDemoPasskeyUnlockAvailable() ? handleUnlockPasskey : undefined
          }
          passkeyReady={isDemoPasskeyUnlockAvailable()}
          onPasskeyUnlockFailed={onPasskeyUnlockFailed}
        />
      )}
    />
  );
}

export function VaultStatusDockClient() {
  return <VaultStatusDockClientInner />;
}
