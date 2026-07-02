const STORAGE_PREFIX = "vault-core:passkey-auto-start:";
const DEFAULT_TTL_MS = 10_000;

/** Consumes a one-shot passkey auto-start slot (ref + short sessionStorage TTL). */
export function tryConsumePasskeyAutoStart(
  scopeKey: string,
  ttlMs = DEFAULT_TTL_MS
): boolean {
  if (typeof window === "undefined") return true;
  const storageKey = `${STORAGE_PREFIX}${scopeKey}`;
  try {
    const storage = window.sessionStorage;
    if (!storage || typeof storage.getItem !== "function") return true;
    const now = Date.now();
    const raw = storage.getItem(storageKey);
    if (raw) {
      const previous = Number.parseInt(raw, 10);
      if (!Number.isNaN(previous) && now - previous < ttlMs) {
        return false;
      }
    }
    storage.setItem(storageKey, String(now));
    return true;
  } catch {
    return true;
  }
}

/** Clears passkey auto-start dedupe state (tests). */
export function resetPasskeyAutoStartDedupe(scopeKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage?.removeItem(`${STORAGE_PREFIX}${scopeKey}`);
  } catch {
    // Ignore storage failures.
  }
}
