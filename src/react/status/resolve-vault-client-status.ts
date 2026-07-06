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
  passkeyUnlockAvailableOnThisDevice?: boolean;
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

  const emergencyActive = status.emergencyModeActive === true;

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
