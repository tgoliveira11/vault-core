export { formatAutoLockCountdown } from "./format-auto-lock-countdown.js";
export {
  DEFAULT_VAULT_STATUS_DOCK_LABELS,
  getDefaultVaultStatusDockExpanded,
  getVaultStatusDockExpandedCopy,
  getVaultStatusDockHandleLabel,
  resolveVaultStatusDockExpanded,
  buildVaultStatusDockReturnPath,
  vaultStatusDockAutoCollapseWhenExpanded,
  type VaultStatusDockExpandedCopy,
  type VaultStatusDockLabels,
} from "./copy.js";
export {
  DEFAULT_VAULT_STATUS_DOCK_COLLAPSED_KEY,
  readVaultStatusDockCollapsedPreference,
  writeVaultStatusDockCollapsedPreference,
} from "./preference.js";
export {
  DEFAULT_VAULT_DOCK_EXPAND_EVENT,
  requestVaultDockExpand,
  subscribeVaultDockExpand,
} from "./events.js";
export {
  VaultStatusIcon,
  VaultStatusIconError,
  VaultStatusIconLocked,
  VaultStatusIconNotSetup,
  VaultStatusIconUnlocked,
  VaultStatusDockChevron,
  VaultStatusDockLockIcon,
} from "./icons.js";
export {
  useVaultAutoLockCountdown,
  useVaultAutoLockFraction,
  useVaultAutoLockMinutes,
  resolveVaultAutoLockMinutes,
} from "./use-vault-auto-lock-countdown.js";
export { navigateToVaultFullUnlock } from "./navigate-to-full-unlock.js";
export { useVaultDockDismiss, type VaultDockDismissOptions } from "./use-vault-dock-dismiss.js";
export {
  resolveVaultDockPasskeyAvailability,
  type VaultDockPasskeyAvailability,
} from "./resolve-passkey-dock-availability.js";
export {
  VaultDockQuickUnlock,
  DEFAULT_VAULT_DOCK_QUICK_UNLOCK_LABELS,
  type VaultDockQuickUnlockLabels,
  type VaultDockQuickUnlockProps,
} from "./vault-dock-quick-unlock.js";
export {
  VaultStatusDock,
  createVaultFullUnlockPageMatcher,
  type VaultStatusDockLinkProps,
  type VaultStatusDockProps,
} from "./vault-status-dock.js";
