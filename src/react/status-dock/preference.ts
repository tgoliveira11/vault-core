export const DEFAULT_VAULT_STATUS_DOCK_COLLAPSED_KEY = "vault-core:vault-status-dock:collapsed";

/** Reads UI-only collapse preference. Never stores secrets or vault payloads. */
export function readVaultStatusDockCollapsedPreference(
  storageKey = DEFAULT_VAULT_STATUS_DOCK_COLLAPSED_KEY
): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== "function") return null;
    const value = storage.getItem(storageKey);
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  } catch {
    return null;
  }
}

export function writeVaultStatusDockCollapsedPreference(
  collapsed: boolean,
  storageKey = DEFAULT_VAULT_STATUS_DOCK_COLLAPSED_KEY
): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    if (!storage || typeof storage.setItem !== "function") return;
    storage.setItem(storageKey, collapsed ? "true" : "false");
  } catch {
    // Ignore storage failures; UI preference is non-critical.
  }
}
