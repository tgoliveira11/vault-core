export type VaultClientStatus =
  | "not_setup"
  | "locked"
  | "unlocked"
  | "unsupported_prf"
  | "emergency_locked"
  | "emergency_unlocked"
  | "error";

/** Minimal server status fields needed to derive client lock UI state. */
export type VaultServerStatusSnapshot = {
  configured: boolean;
  hasPasskeyPrfEnvelope?: boolean;
  passkeyUnlockAvailableOnThisBrowser?: boolean;
  /** @deprecated Use passkeyUnlockAvailableOnThisBrowser. */
  passkeyUnlockAvailableOnThisDevice?: boolean;
  /**
   * Set false when passkey unlock does not run a local WebAuthn PRF ceremony (for example a
   * broker-based portable passkey). Defaults to true, where the browser PRF heuristic gates
   * quick-unlock availability. Envelope and bound-browser gates always apply.
   */
  passkeyUnlockRequiresBrowserPrf?: boolean;
  /** Explicit feature gate. Emergency state is ignored unless this is true. */
  emergencyModeEnabled?: boolean;
  emergencyModeActive?: boolean;
  decoyConfigured?: boolean;
};

export function resolveVaultClientStatus(
  status: VaultServerStatusSnapshot | null,
  unlocked: boolean,
  prfSupported: boolean
): VaultClientStatus {
  if (!status?.configured) {
    return "not_setup";
  }

  const emergencyActive =
    status.emergencyModeEnabled === true && status.emergencyModeActive === true;

  if (unlocked) {
    return emergencyActive ? "emergency_unlocked" : "unlocked";
  }

  if (emergencyActive) {
    return "emergency_locked";
  }

  if (!prfSupported && status.hasPasskeyPrfEnvelope) {
    return "unsupported_prf";
  }
  return "locked";
}
