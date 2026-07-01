import type { VaultClientStatus } from "../status/resolve-vault-client-status.js";

export type VaultStatusDockExpandedCopy = {
  title: string;
  body: string;
  countdownInline: string | null;
};

export type VaultStatusDockLabels = {
  handleOpen: string;
  handleLocked: string;
  stayUnlocked: (minutes: number) => string;
  lockNow: string;
  expandAriaLabel: string;
  collapseAriaLabel: string;
  fullUnlockLink: string;
  moreUnlockOptions: string;
  autoLocksIn: (countdown: string) => string;
};

export const DEFAULT_VAULT_STATUS_DOCK_LABELS: VaultStatusDockLabels = {
  handleOpen: "Vault open",
  handleLocked: "Vault locked",
  stayUnlocked: (minutes) => `Stay unlocked ${minutes} min`,
  lockNow: "Lock now",
  expandAriaLabel: "Expand vault status",
  collapseAriaLabel: "Collapse vault status",
  fullUnlockLink: "Open full unlock page",
  moreUnlockOptions: "More unlock options",
  autoLocksIn: (countdown) => `Auto-locks in ${countdown}`,
};

/** Expanded by default for locked/unlocked only when preference unset; setup states hide the dock. */
export function getDefaultVaultStatusDockExpanded(_clientStatus: VaultClientStatus): boolean {
  return false;
}

/** Whether outside-click / Escape auto-collapse applies when expanded. */
export function vaultStatusDockAutoCollapseWhenExpanded(clientStatus: VaultClientStatus): boolean {
  return clientStatus === "locked" || clientStatus === "unlocked";
}

export function resolveVaultStatusDockExpanded(
  clientStatus: VaultClientStatus,
  preference: boolean | null,
  onFullUnlockPage: boolean
): boolean {
  if (onFullUnlockPage && (clientStatus === "locked" || clientStatus === "unsupported_prf")) {
    return false;
  }
  if (preference !== null) {
    return !preference;
  }
  return false;
}

export function buildVaultStatusDockReturnPath(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}

/** Compact label for the header-attached collapsed handle only. */
export function getVaultStatusDockHandleLabel(
  clientStatus: VaultClientStatus,
  countdown: string | null
): string {
  switch (clientStatus) {
    case "unlocked":
      return countdown ?? "Open";
    case "locked":
    case "unsupported_prf":
    case "not_setup":
    case "error":
      return "Vault";
  }
}

export function getVaultStatusDockExpandedCopy(
  clientStatus: VaultClientStatus,
  countdown: string | null,
  labels: VaultStatusDockLabels = DEFAULT_VAULT_STATUS_DOCK_LABELS
): VaultStatusDockExpandedCopy {
  switch (clientStatus) {
    case "unlocked":
      return {
        title: labels.handleOpen,
        body: "",
        countdownInline: countdown ? labels.autoLocksIn(countdown) : null,
      };
    case "locked":
    case "unsupported_prf":
      return {
        title: labels.handleLocked,
        body: "",
        countdownInline: null,
      };
    case "not_setup":
      return {
        title: "Vault not set up",
        body: "Create your private encrypted vault before using protected content.",
        countdownInline: null,
      };
    case "error":
      return {
        title: "Vault status unavailable",
        body: "Refresh the page or open vault settings.",
        countdownInline: null,
      };
  }
}
