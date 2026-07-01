import type { ReactNode } from "react";
import type { VaultAdminConfig, VaultAdminPaths } from "../../admin/types.js";
import { resolveVaultAdminPaths } from "../../admin/paths.js";

export type VaultAdminLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export type VaultAdminPageProps = {
  config: VaultAdminConfig;
  paths?: VaultAdminPaths;
  /** Optional link component (e.g. Next.js Link). Defaults to `<a>`. */
  LinkComponent?: React.ComponentType<VaultAdminLinkProps>;
  /** Raw env record used to compute source badges on the config page. */
  env?: Record<string, string | undefined>;
  /** Active admin overrides for source badges (when not using configApiBase). */
  adminOverrides?: Record<string, unknown>;
  /** API base for runtime config overrides (GET/POST/DELETE `{apiBase}/admin/config`). */
  configApiBase?: string;
};

export function AdminLink({
  href,
  className,
  children,
  LinkComponent,
}: VaultAdminLinkProps & { LinkComponent?: React.ComponentType<VaultAdminLinkProps> }) {
  const Component = LinkComponent ?? "a";
  return (
    <Component href={href} className={className}>
      {children}
    </Component>
  );
}

export function useVaultAdminPaths(
  config: VaultAdminConfig,
  paths?: VaultAdminPaths
): VaultAdminPaths {
  return paths ?? resolveVaultAdminPaths(config.basePath);
}

export function AdminShell({
  children,
  narrow,
}: {
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className={`vc-admin vc-admin-shell${narrow ? " vc-admin-shell--narrow" : ""}`}>
      {children}
    </div>
  );
}

export function AdminHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="vc-admin-header">
      <h1 className="vc-admin-title">{title}</h1>
      {description ? <p className="vc-admin-subtitle">{description}</p> : null}
    </header>
  );
}

export function AdminBackLink({
  href,
  label = "Back to vault admin",
  LinkComponent,
}: {
  href: string;
  label?: string;
  LinkComponent?: React.ComponentType<VaultAdminLinkProps>;
}) {
  return (
    <AdminLink href={href} className="vc-admin-back" LinkComponent={LinkComponent}>
      ← {label}
    </AdminLink>
  );
}

export function SourceBadge({ source }: { source: "admin" | "env" | "default" | "profile" }) {
  const className =
    source === "admin"
      ? "vc-admin-badge vc-admin-badge--admin"
      : source === "env"
        ? "vc-admin-badge vc-admin-badge--env"
        : source === "profile"
          ? "vc-admin-badge vc-admin-badge--profile"
          : "vc-admin-badge vc-admin-badge--default";
  return <span className={className}>{source}</span>;
}

export function formatConfigValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}
