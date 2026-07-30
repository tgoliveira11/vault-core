import { isPrfExtensionHeuristicallyAvailable } from "../../browser.js";
import { resolvePasskeyUnlockAvailable } from "../../passkey/device-binding/resolve-availability.js";
import type { VaultServerStatusSnapshot } from "../status/resolve-vault-client-status.js";

export type VaultDockPasskeyAvailability = {
  hasEnvelope: boolean;
  showPasskey: boolean;
  prfExplicitlyUnsupported: boolean;
};

/**
 * Whether passkey quick unlock may appear in the vault status dock.
 * Set `serverStatus.passkeyUnlockRequiresBrowserPrf` to false for unlock flows without a local
 * WebAuthn PRF ceremony; the browser PRF heuristic is then skipped.
 */
export function resolveVaultDockPasskeyAvailability(
  serverStatus: VaultServerStatusSnapshot | null
): VaultDockPasskeyAvailability {
  const hasEnvelope = Boolean(serverStatus?.hasPasskeyPrfEnvelope);

  if (!hasEnvelope) {
    return { hasEnvelope: false, showPasskey: false, prfExplicitlyUnsupported: false };
  }

  if (!resolvePasskeyUnlockAvailable({
    hasPasskeyPrfEnvelope: true,
    passkeyUnlockAvailableOnThisBrowser: serverStatus?.passkeyUnlockAvailableOnThisBrowser,
    passkeyUnlockAvailableOnThisDevice: serverStatus?.passkeyUnlockAvailableOnThisDevice,
  })) {
    return { hasEnvelope: true, showPasskey: false, prfExplicitlyUnsupported: false };
  }

  // Broker-based portable passkey unlock runs no local WebAuthn PRF ceremony, so the browser PRF
  // heuristic must not hide it. Only this gate is skipped; envelope and binding gates still apply.
  if (serverStatus?.passkeyUnlockRequiresBrowserPrf === false) {
    return { hasEnvelope: true, showPasskey: true, prfExplicitlyUnsupported: false };
  }

  if (!isPrfExtensionHeuristicallyAvailable()) {
    return { hasEnvelope: true, showPasskey: false, prfExplicitlyUnsupported: true };
  }

  return { hasEnvelope: true, showPasskey: true, prfExplicitlyUnsupported: false };
}
