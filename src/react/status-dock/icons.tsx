import type { SVGProps } from "react";
import type { VaultClientStatus } from "../status/resolve-vault-client-status.js";

type IconProps = SVGProps<SVGSVGElement>;

function VaultStatusIconBase({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function VaultStatusIconNotSetup(props: IconProps) {
  return (
    <VaultStatusIconBase {...props}>
      <path d="M12 3 4 7v6c0 4.5 3.4 8.7 8 10 4.6-1.3 8-5.5 8-10V7l-8-4Z" />
      <path d="M12 11v4" />
      <path d="M12 8h.01" />
    </VaultStatusIconBase>
  );
}

export function VaultStatusIconError(props: IconProps) {
  return (
    <VaultStatusIconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </VaultStatusIconBase>
  );
}

export function VaultStatusIconLocked(props: IconProps) {
  return (
    <VaultStatusIconBase {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </VaultStatusIconBase>
  );
}

export function VaultStatusIconUnlocked(props: IconProps) {
  return (
    <VaultStatusIconBase {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </VaultStatusIconBase>
  );
}

export function VaultStatusIcon({ status }: { status: VaultClientStatus }) {
  switch (status) {
    case "not_setup":
      return <VaultStatusIconNotSetup />;
    case "error":
      return <VaultStatusIconError />;
    case "locked":
    case "unsupported_prf":
      return <VaultStatusIconLocked />;
    case "unlocked":
      return <VaultStatusIconUnlocked />;
  }
}

export function VaultStatusDockChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={expanded ? "vc-status-dock__chevron--expanded" : undefined}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function VaultStatusDockLockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2.2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
