"use client";

import Link from "next/link";
import { useVaultLockState, useVaultSession } from "@tgoliveira/vault-core/react";
import { AppShell } from "@/components/app-shell";
import { DatabaseStatus } from "@/components/database-status";
import { DEMO_USER_ID, VAULT_PROFILE } from "@/lib/vault-profile";

export default function DashboardPage() {
  const lockState = useVaultLockState();
  const { touch } = useVaultSession({
    registerActivityGuard: false,
    registerUnloadGuard: false,
  });

  return (
    <AppShell
      title="Dashboard"
      description="Public demo hub. Vault admin pages are thin re-exports of @tgoliveira/vault-core/react."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="vc-admin-card">
          <h2 className="vc-admin-card-title">Vault session</h2>
          <p className="vc-admin-card-desc mt-2">
            In-memory lock state (UVK is not persisted — reload requires unlock again):
          </p>
          <p className="mt-3 text-lg font-semibold">
            {lockState === "unlocked" ? (
              <span style={{ color: "var(--success)" }}>Unlocked</span>
            ) : (
              <span style={{ color: "var(--warning)" }}>Locked</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => touch()}
            className="mt-4 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--card-muted)]"
          >
            Touch session (reset auto-lock timer)
          </button>
        </section>

        <section className="vc-admin-card">
          <h2 className="vc-admin-card-title">PostgreSQL</h2>
          <DatabaseStatus />
        </section>

        <section className="vc-admin-card">
          <h2 className="vc-admin-card-title">Demo profile</h2>
          <ul className="vc-admin-list mt-2">
            <li>
              Demo user: <code>{DEMO_USER_ID}</code>
            </li>
            <li>
              Vault AAD: <code>{VAULT_PROFILE.aadContextVault}</code>
            </li>
            <li>
              Envelope AAD: <code>{VAULT_PROFILE.aadContextEnvelope}</code>
            </li>
          </ul>
        </section>

        <section className="vc-admin-card sm:col-span-2">
          <h2 className="vc-admin-card-title">Vault admin UI (from package)</h2>
          <p className="vc-admin-card-desc mt-2">
            Eight read-only admin screens exported by{" "}
            <code>@tgoliveira/vault-core/react</code> — config, env template, crypto policy,
            profile, session, password policy, and security boundaries.
          </p>
          <Link
            href="/admin/vault"
            className="mt-4 inline-block rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Open vault admin →
          </Link>
        </section>

        <section className="vc-admin-card vc-admin-card--muted sm:col-span-2">
          <h2 className="vc-admin-card-title">About this app</h2>
          <p className="vc-admin-card-desc mt-2">
            Lives in <code>apps/consumer-demo/</code> — not published to npm. Admin routes are thin
            wrappers around package pages; see <code>src/app/admin/vault/</code> and{" "}
            <code>docs/VAULT_ADMIN.md</code>.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
