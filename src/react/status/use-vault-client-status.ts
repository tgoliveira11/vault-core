import { useMemo } from "react";
import {
  resolveVaultClientStatus,
  type VaultClientStatus,
  type VaultServerStatusSnapshot,
} from "./resolve-vault-client-status.js";
import { useVaultUnlocked } from "../session/use-vault-unlocked.js";

export function useVaultClientStatus(
  serverStatus: VaultServerStatusSnapshot | null,
  prfSupported: boolean
): VaultClientStatus {
  const unlocked = useVaultUnlocked();
  return useMemo(
    () => resolveVaultClientStatus(serverStatus, unlocked, prfSupported),
    [serverStatus, unlocked, prfSupported]
  );
}
