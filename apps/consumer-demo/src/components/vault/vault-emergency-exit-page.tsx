"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  exitDemoEmergencyMode,
  isDemoEmergencyMode,
  verifyDemoEmergencyExitOtp,
} from "@/lib/vault-demo-crypto";
import { loadDemoEmergencyMetadata } from "@/lib/vault-demo-emergency-store";

export function VaultEmergencyExitPage() {
  const router = useRouter();
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const emergency = loadDemoEmergencyMetadata();

  if (!isDemoEmergencyMode() && !emergency.emergencyModeActive) {
    return (
      <AppShell title="Exit emergency mode" description="You are not in emergency mode.">
        <Link href="/vault" className="text-sm text-[var(--primary)] hover:underline">
          ← Back to vault
        </Link>
      </AppShell>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (emergency.emergencyExitEmailRequired) {
        if (!verifyDemoEmergencyExitOtp(emailOtp)) {
          throw new Error("Invalid email verification code. Demo OTP is 123456.");
        }
      }
      await exitDemoEmergencyMode({
        recoveryPhrase,
        emailOtp: emergency.emergencyExitEmailRequired ? emailOtp : undefined,
      });
      router.replace("/vault/unlock?next=/vault");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Exit failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Exit emergency mode"
      description="Enter your primary recovery phrase to return to normal vault operation. Your normal vault password does not exit emergency mode."
    >
      <form onSubmit={handleSubmit} className="vc-admin-card max-w-lg space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Primary recovery phrase</span>
          <textarea
            className="vc-admin-input min-h-24 w-full"
            value={recoveryPhrase}
            onChange={(event) => setRecoveryPhrase(event.target.value)}
            autoComplete="off"
            required
          />
        </label>

        {emergency.emergencyExitEmailRequired ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Email verification code</span>
            <input
              className="vc-admin-input w-full"
              value={emailOtp}
              onChange={(event) => setEmailOtp(event.target.value)}
              autoComplete="one-time-code"
              required
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Demo mock OTP: <code>123456</code>
            </p>
          </label>
        ) : null}

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !recoveryPhrase.trim()}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Verifying…" : "Exit emergency mode"}
        </button>
      </form>
    </AppShell>
  );
}
