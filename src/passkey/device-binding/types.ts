/** Opaque device binding identifier persisted by the consuming app (cookie, DB row, etc.). */
export type VaultDeviceBindingId = string;

/** App-owned persistence contract for passkey device binding. */
export type VaultDeviceBindingStore = {
  getDeviceBindingId(): Promise<VaultDeviceBindingId | null> | VaultDeviceBindingId | null;
  resolveCredentialId(bindingId: VaultDeviceBindingId): Promise<string | null> | string | null;
  saveBinding?(input: { bindingId: VaultDeviceBindingId; credentialId: string; userId: string }): Promise<void> | void;
  clearBinding?(bindingId: VaultDeviceBindingId): Promise<void> | void;
};
