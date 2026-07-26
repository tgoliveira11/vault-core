/** Opaque device binding identifier persisted by the consuming app (cookie, DB row, etc.). */
export type VaultDeviceBindingId = string;

export type VaultPasskeyBindingTarget = {
  credentialId: string;
  selectedEnvelopeVariantId?: string;
};

/** App-owned persistence contract for opaque browser bindings. */
export type VaultPasskeyBindingStore = {
  getBindingId(): Promise<VaultDeviceBindingId | null> | VaultDeviceBindingId | null;
  resolveBindingTarget(
    bindingId: VaultDeviceBindingId
  ): Promise<VaultPasskeyBindingTarget | null> | VaultPasskeyBindingTarget | null;
  saveBinding?(input: {
    bindingId: VaultDeviceBindingId;
    userId: string;
    target: VaultPasskeyBindingTarget;
  }): Promise<void> | void;
  clearBinding?(bindingId: VaultDeviceBindingId): Promise<void> | void;
};

/** @deprecated Use VaultPasskeyBindingStore for binding and envelope-variant metadata. */
export type VaultDeviceBindingStore = {
  getDeviceBindingId(): Promise<VaultDeviceBindingId | null> | VaultDeviceBindingId | null;
  resolveCredentialId(bindingId: VaultDeviceBindingId): Promise<string | null> | string | null;
  saveBinding?(input: {
    bindingId: VaultDeviceBindingId;
    credentialId: string;
    userId: string;
    selectedEnvelopeVariantId?: string;
  }): Promise<void> | void;
  clearBinding?(bindingId: VaultDeviceBindingId): Promise<void> | void;
};
