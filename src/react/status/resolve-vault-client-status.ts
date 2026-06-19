export type VaultClientStatus =
  | "not_setup"
  | "locked"
  | "unlocked"
  | "unsupported_prf"
  | "error";

/** Minimal server status fields needed to derive client lock UI state. */
export type VaultServerStatusSnapshot = {
  configured: boolean;
  hasPasskeyPrfEnvelope?: boolean;
};

export function resolveVaultClientStatus(
  status: VaultServerStatusSnapshot | null,
  unlocked: boolean,
  prfSupported: boolean
): VaultClientStatus {
  if (!status?.configured) {
    return "not_setup";
  }
  if (unlocked) {
    return "unlocked";
  }
  if (!prfSupported && status.hasPasskeyPrfEnvelope) {
    return "unsupported_prf";
  }
  return "locked";
}
