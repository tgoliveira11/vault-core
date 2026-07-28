"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  VaultDockQuickUnlock,
  VaultStatusDock,
  buildVaultUnlockHref,
  type VaultStatusDockLinkProps,
} from "@tgoliveira/vault-core/react";
import {
  isDemoPasskeyUnlockAvailable,
  unlockDemoVault,
  unlockDemoVaultWithPasskey,
} from "@/lib/vault-demo-crypto";
import { getDemoServerStatusSnapshot } from "@/lib/vault-demo-emergency-store";
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

function VaultStatusDockClientInner({ emergencyModeEnabled }: { emergencyModeEnabled: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [configured, setConfigured] = useState(false);
  const [serverStatus, setServerStatus] = useState(
    getDemoServerStatusSnapshot(false, false, emergencyModeEnabled)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const duressSignaledRef = useRef(false);
  const passkeySupport = getDemoPasskeySupport();

  useEffect(() => {
    const vaultConfigured = isVaultConfigured();
    setConfigured(vaultConfigured);
    const record = loadVaultRecord();
    setServerStatus(
      getDemoServerStatusSnapshot(
        vaultConfigured,
        Boolean(record?.passkeyPrfEnvelope),
        emergencyModeEnabled
      )
    );
  }, [emergencyModeEnabled, pathname]);

  const handleUnlockPassword = useCallback(async (password: string) => {
    setError(null);
    setLoading(true);
    try {
      await unlockDemoVault(password, { emergencyModeEnabled });
    } catch {
      setError("Unlock failed. Check your vault password and try again.");
      throw new Error("unlock failed");
    } finally {
      setLoading(false);
      duressSignaledRef.current = false;
    }
  }, [emergencyModeEnabled]);

  const handleUnlockPasskey = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await unlockDemoVaultWithPasskey({
        duressSignaled: emergencyModeEnabled && duressSignaledRef.current,
        emergencyModeEnabled,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Passkey unlock failed.");
      throw caught;
    } finally {
      setLoading(false);
      duressSignaledRef.current = false;
    }
  }, [emergencyModeEnabled]);

  const handleNavigateToUnlock = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  return (
    <VaultStatusDock
      visible={configured}
      serverStatus={serverStatus}
      prfSupported={passkeySupport.prf}
      pathname={pathname}
      unlockPath={UNLOCK_PATH}
      buildUnlockHref={(returnPath) => buildVaultUnlockHref(UNLOCK_PATH, returnPath)}
      onNavigateToUnlock={handleNavigateToUnlock}
      emergencyModeEnabled={emergencyModeEnabled}
      onDuressSignalChange={
        emergencyModeEnabled
          ? (signaled) => {
              duressSignaledRef.current = signaled;
            }
          : undefined
      }
      loading={loading}
      unlockError={error}
      LinkComponent={DemoLink}
      renderQuickUnlock={({
        loading: quickLoading,
        error: quickError,
        onPasskeyUnlockFailed,
        onPasskeyUnlockCancelled,
        bindAutoStartPasskey,
        duressSignaled,
        resetDuressSignal,
      }) => (
        <VaultDockQuickUnlock
          loading={quickLoading}
          error={quickError}
          unlockRateLimiter={getDemoVaultUnlockRateLimiter()}
          rateLimitScopeKey="demo"
          serverStatus={serverStatus}
          onUnlockPassword={handleUnlockPassword}
          onUnlockPasskey={
            isDemoPasskeyUnlockAvailable() ? handleUnlockPasskey : undefined
          }
          passkeyReady={isDemoPasskeyUnlockAvailable()}
          passkeyOptionsReady={passkeySupport.prf}
          bindAutoStartPasskey={bindAutoStartPasskey}
          emergencyModeEnabled={emergencyModeEnabled}
          onPasskeyUnlockFailed={onPasskeyUnlockFailed}
          onPasskeyUnlockCancelled={onPasskeyUnlockCancelled}
          duressSignaled={duressSignaled}
          onDuressSignalChange={(signaled) => {
            duressSignaledRef.current = signaled;
          }}
          resetDuressSignal={resetDuressSignal}
        />
      )}
    />
  );
}

export function VaultStatusDockClient({
  emergencyModeEnabled,
}: {
  emergencyModeEnabled: boolean;
}) {
  return <VaultStatusDockClientInner emergencyModeEnabled={emergencyModeEnabled} />;
}
