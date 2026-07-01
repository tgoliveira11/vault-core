"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { readVaultUnlockReturnPath } from "@tgoliveira/vault-core/react";

type AdminLoginFormProps = {
  emailHint: string | null;
};

export function AdminLoginForm({ emailHint }: AdminLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = readVaultUnlockReturnPath(searchParams, {
    defaultPath: "/admin/vault",
    paramName: "next",
  });
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/demo/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(
          payload.error ??
            (emailHint
              ? `Login failed. Use the configured demo admin email (${emailHint}).`
              : "Login failed")
        );
        return;
      }
      router.replace(returnPath);
    } catch {
      setError("Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Demo admin sign-in"
      description="Mock gate for vault admin screens. Set DEMO_ADMIN_EMAIL in .env.local — not for production."
    >
      <form className="vc-admin-card max-w-md space-y-4" onSubmit={handleSubmit}>
        {emailHint ? (
          <p className="text-sm text-[var(--muted)]">
            Demo admin email: <span className="font-mono text-[var(--foreground)]">{emailHint}</span>
          </p>
        ) : (
          <p className="text-sm text-[var(--danger)]" role="alert">
            DEMO_ADMIN_EMAIL is not configured in .env.local.
          </p>
        )}
        <label className="block text-sm font-medium" htmlFor="demo-admin-email">
          Admin email
        </label>
        <input
          id="demo-admin-email"
          type="email"
          autoComplete="email"
          placeholder={emailHint ?? "admin@example.com"}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        {error ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy || !email || !emailHint}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AppShell>
  );
}
