export {
  resolveVaultClientStatus,
  type VaultClientStatus,
  type VaultServerStatusSnapshot,
} from "./status/resolve-vault-client-status.js";

export { useVaultClientStatus } from "./status/use-vault-client-status.js";

export {
  useVaultUnlocked,
  useVaultLockState,
} from "./session/use-vault-unlocked.js";

export { useVaultSession, type UseVaultSessionOptions } from "./session/use-vault-session.js";

export {
  VaultSessionProvider,
  type VaultSessionProviderProps,
} from "./session/vault-session-provider.js";

export * from "./admin/index.js";
export * from "./password/index.js";
export * from "./protected-gate/index.js";
export * from "./status-dock/index.js";
export * from "./unlock/index.js";
