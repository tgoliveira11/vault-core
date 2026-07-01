"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useVaultUnlocked } from "@tgoliveira/vault-core/react";
import { AppShell } from "@/components/app-shell";
import { isDemoPasskeyUnlockAvailable, unlockDemoVault, unlockDemoVaultWithPasskey } from "@/lib/vault-demo-crypto";
import { getDemoPasskeySupport } from "@/lib/vault-demo-passkey";
import { isVaultConfigured } from "@/lib/vault-demo-store";

function VaultUnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unlocked = useVaultUnlocked();
  const nextPath = searchParams.get("next") ?? "/vault";
  const [vaultPassword, setVaultPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const passkeySupport = getDemoPasskeySupport();

  useEffect(() => {
    setPasskeyAvailable(isDemoPasskeyUnlockAvailable());
  }, []);

  useEffect(() => {
    if (!isVaultConfigured()) {
      router.replace("/vault/setup");
      return;
    }
    if (unlocked) {
      router.replace(nextPath);
    }
  }, [unlocked, router, nextPath]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await unlockDemoVault(vaultPassword);
      router.push(nextPath);
    } catch {
      setError("Unlock failed. Check your vault password and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasskeyUnlock() {
    setError("");
    setBusy(true);
    try {
      await unlockDemoVaultWithPasskey();
      router.push(nextPath);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Passkey unlock failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Unlock vault"
      description="Enter your vault password or use a linked passkey. The UVK stays in memory only — reloading the page locks the vault again."
    >
      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="vc-admin-card max-w-lg space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Vault password</span>
          <input
            type="password"
            className="vc-admin-input w-full"
            value={vaultPassword}
            onChange={(event) => setVaultPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Unlocking…" : "Unlock with password"}
        </button>
      </form>

      {passkeyAvailable && passkeySupport.passkey && passkeySupport.prf ? (
        <div className="mt-4 max-w-lg">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePasskeyUnlock()}
            className="w-full rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--card-muted)] disabled:opacity-60"
          >
            Unlock with passkey
          </button>
        </div>
      ) : null}
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
