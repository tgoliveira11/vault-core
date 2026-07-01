import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin/vault", label: "Vault admin" },
] as const;

export function AppShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              @tgoliveira/vault-core · consumer demo
            </p>
            <p className="text-sm font-medium">{title}</p>
          </div>
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
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {description ? (
          <p className="mb-6 text-sm text-[var(--muted)] leading-relaxed">{description}</p>
        ) : null}
        {children}
      </main>
    </div>
  );
}
