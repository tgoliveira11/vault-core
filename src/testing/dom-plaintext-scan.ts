import { ALL_SENTINELS, containsSentinel } from "../validation/plaintext-reject.js";

/**
 * Scans visible text under `root` for vault testing sentinels (passwords, notes, UVK markers, etc.).
 * Use after lock in integration tests to assert sensitive UI was unmounted or cleared.
 */
export function scanDocumentForVaultPlaintextSentinels(
  root: ParentNode,
  sentinels: readonly string[] = ALL_SENTINELS
): string[] {
  const text = root.textContent ?? "";
  return sentinels.filter((sentinel) => containsSentinel(text, sentinels));
}

/** Throws when any vault plaintext sentinel appears in the document text under `root`. */
export function assertNoVaultPlaintextInDocument(root: ParentNode): void {
  const found = scanDocumentForVaultPlaintextSentinels(root);
  if (found.length > 0) {
    throw new Error(
      `Vault plaintext sentinel(s) found in document: ${found.join(", ")}. Unmount sensitive UI or clear app state on lock.`
    );
  }
}
