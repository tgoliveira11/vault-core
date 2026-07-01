/** Client-safe session config (NEXT_PUBLIC_* only). */
export function getVaultAutoLockMinutes(): number {
  const raw = process.env.NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES;
  if (raw == null || raw === "") return 15;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 1) return 15;
  return minutes;
}
