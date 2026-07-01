export const DEFAULT_VAULT_DOCK_EXPAND_EVENT = "vault-core:vault-dock-expand";

/** Ask the global vault status dock to expand (e.g. from a locked-content gate). */
export function requestVaultDockExpand(
  eventName = DEFAULT_VAULT_DOCK_EXPAND_EVENT
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName));
}

export function subscribeVaultDockExpand(
  listener: () => void,
  eventName = DEFAULT_VAULT_DOCK_EXPAND_EVENT
): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}
