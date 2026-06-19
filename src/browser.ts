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

export function assertNoDecryptedVaultInLocalStorage(storagePrefix: string): boolean {
  if (typeof window === "undefined") return true;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(storagePrefix)) {
      return false;
    }
  }
  return true;
}

export async function assertNoDecryptedVaultInIndexedDB(storagePrefix: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return true;

  return new Promise((resolve) => {
    const request = indexedDB.databases?.();
    if (!request) {
      resolve(true);
      return;
    }
    void request
      .then((databases) => {
        const hasVaultDb = databases.some((db) => db.name?.startsWith(storagePrefix));
        resolve(!hasVaultDb);
      })
      .catch(() => resolve(true));
  });
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
  getVaultAutoLockRemainingMs,
  getSessionVaultKey,
  setSessionVaultKey,
  lockVault,
  isVaultUnlocked,
  clearVaultClientState,
  type VaultSessionConfig,
} from "./session/auto-lock.js";

export { createRecoveryKitText, buildRecoveryKitContent } from "./recovery/kit.js";
