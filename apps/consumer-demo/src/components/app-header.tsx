"use client";

import Link from "next/link";
import { VaultStatusDockClient } from "@/components/vault/vault-status-dock-client";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vault/setup", label: "Vault setup" },
  { href: "/vault", label: "My vault" },
  { href: "/vault/settings", label: "Vault security" },
  { href: "/admin/vault", label: "Vault admin" },
] as const;

export function AppHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            @tgoliveira/vault-core · consumer demo
          </p>
          <p className="text-sm font-medium">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap gap-2 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--card-muted)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="vc-status-dock-host">
            <VaultStatusDockClient />
          </div>
        </div>
      </div>
    </header>
  );
}
