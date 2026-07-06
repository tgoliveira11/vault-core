import { getVaultSessionMode, type VaultSessionMode } from "../session/memory-session.js";

export function assertVaultSessionMode(expected: VaultSessionMode): void {
  const actual = getVaultSessionMode();
  if (actual !== expected) {
    throw new Error(`Expected vault session mode "${expected}" but got "${actual}".`);
  }
}
