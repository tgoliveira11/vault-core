import { stringToBytes, toBufferSource } from "./crypto/encoding.js";
import {
  extractPasskeyPrfOutput,
  isPasskeySupported,
  isPrfExtensionSupported,
} from "./envelopes/passkey-prf.js";

export async function buildPrfSaltBytes(prefix: string, userId: string): Promise<ArrayBuffer> {
  const input = toBufferSource(stringToBytes(`${prefix}${userId}`));
  return crypto.subtle.digest("SHA-256", input);
}

export function createRecoveryKitDownload(
  content: string,
  filename: string
): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function printRecoveryKitContent(content: string): void {
  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=640,height=720");
  if (!printWindow) return;
  printWindow.document.write(
    `<pre style="font-family:monospace;white-space:pre-wrap;padding:24px;">${escapeHtml(content)}</pre>`
  );
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type VaultStorageInspectionResult = "clear" | "found" | "unavailable";

export function inspectLocalStoragePrefix(
  storagePrefix: string
): VaultStorageInspectionResult {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return "unavailable";
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(storagePrefix)) {
        return "found";
      }
    }
    return "clear";
  } catch {
    return "unavailable";
  }
}

export async function inspectIndexedDBPrefix(
  storagePrefix: string
): Promise<VaultStorageInspectionResult> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return "unavailable";
  }

  return new Promise((resolve) => {
    let request: Promise<IDBDatabaseInfo[]> | undefined;
    try {
      request = indexedDB.databases?.();
    } catch {
      resolve("unavailable");
      return;
    }
    if (!request) {
      resolve("unavailable");
      return;
    }
    void request
      .then((databases) => {
        const hasVaultDb = databases.some((db) => db.name?.startsWith(storagePrefix));
        resolve(hasVaultDb ? "found" : "clear");
      })
      .catch(() => resolve("unavailable"));
  });
}

/**
 * @deprecated This is a namespace-level, fail-closed check. Use inspectLocalStoragePrefix
 * and handle all three result states explicitly.
 */
export function assertNoDecryptedVaultInLocalStorage(storagePrefix: string): boolean {
  return inspectLocalStoragePrefix(storagePrefix) === "clear";
}

/**
 * @deprecated This checks database names, not record contents. Use inspectIndexedDBPrefix
 * and handle all three result states explicitly.
 */
export async function assertNoDecryptedVaultInIndexedDB(storagePrefix: string): Promise<boolean> {
  return (await inspectIndexedDBPrefix(storagePrefix)) === "clear";
}

export function persistVaultRecordLocally(): never {
  throw new Error("Decrypted vault state must not be persisted to localStorage or IndexedDB");
}

export {
  extractPasskeyPrfOutput,
  isPasskeySupported,
  isPrfExtensionSupported,
};

export {
  deleteVaultAfterAuthorization,
  deleteVaultWithPasswordAuthorization,
  type DeleteVaultAfterAuthorizationOptions,
  type DeleteVaultWithPasswordAuthorizationOptions,
} from "./session/vault-deletion.js";

export {
  configureVaultSession,
  subscribeVaultSession,
  isVaultManuallyLocked,
  clearVaultAutoLockTimer,
  scheduleVaultAutoLock,
  touchVaultSession,
  unlockVaultSession,
  lockVaultSession,
  lockVaultSessionManually,
  resetVaultSessionLockState,
  registerVaultUnloadGuard,
  registerVaultActivityGuard,
  suppressVaultActivity,
  getVaultAutoLockRemainingMs,
  getVaultAutoLockMinutes,
  getSessionVaultKey,
  isVaultUnlocked,
  type VaultSessionConfig,
} from "./session/auto-lock.js";

export { createRecoveryKitText, buildRecoveryKitContent } from "./recovery/kit.js";
