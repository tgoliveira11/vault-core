import { isPrfExtensionSupported } from "../../browser.js";
import type { VaultServerStatusSnapshot } from "../status/resolve-vault-client-status.js";

export type VaultDockPasskeyAvailability = {
  hasEnvelope: boolean;
  showPasskey: boolean;
  prfExplicitlyUnsupported: boolean;
};

/** Whether passkey PRF quick unlock may appear in the vault status dock. */
export function resolveVaultDockPasskeyAvailability(
  serverStatus: VaultServerStatusSnapshot | null
): VaultDockPasskeyAvailability {
  const hasEnvelope = Boolean(serverStatus?.hasPasskeyPrfEnvelope);

  if (!hasEnvelope) {
    return { hasEnvelope: false, showPasskey: false, prfExplicitlyUnsupported: false };
  }

  if (!isPrfExtensionSupported()) {
    return { hasEnvelope: true, showPasskey: false, prfExplicitlyUnsupported: true };
  }

  return { hasEnvelope: true, showPasskey: true, prfExplicitlyUnsupported: false };
}
