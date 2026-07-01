export {
  VaultProtectedGate,
  type VaultProtectedGateProps,
} from "./vault-protected-gate.js";
export {
  VaultLockOverlayExclude,
  type VaultLockOverlayExcludeProps,
} from "./vault-lock-overlay-exclude.js";
export {
  VAULT_LOCK_OVERLAY_EXCLUDE_ATTR,
  VAULT_LOCK_OVERLAY_EXCLUDE_SELECTOR,
  collectVaultLockOverlayExclusionRects,
} from "./overlay-exclude.js";
export {
  computeVaultLockOverlayPanels,
  measureVaultLockOverlayPanels,
  type VaultLockOverlayPanel,
  type VaultLockOverlayRect,
} from "./overlay-panels.js";
export { useVaultLockOverlayPanels } from "./use-vault-lock-overlay-panels.js";
export { shouldVaultLockOverlayExpandDock } from "./should-vault-lock-overlay-expand-dock.js";
