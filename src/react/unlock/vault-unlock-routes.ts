/** Default query parameter for the post-unlock return path on vault unlock routes. */
export const VAULT_UNLOCK_RETURN_QUERY_PARAM = "next";

export type VaultUnlockReturnPathOptions = {
  /** Used when the query value is missing or unsafe. Defaults to `/`. */
  defaultPath?: string;
  /** Query parameter name. Defaults to `next`. */
  paramName?: string;
};

/**
 * Validates a caller-supplied return path. Only same-origin relative paths are accepted
 * (`/dashboard`, `/vault`). Rejects empty values, `//evil`, and absolute URLs.
 */
export function resolveVaultUnlockReturnPath(
  raw: string | null | undefined,
  options?: VaultUnlockReturnPathOptions
): string {
  const defaultPath = options?.defaultPath ?? "/";
  if (!raw) return defaultPath;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return defaultPath;
  }
  return trimmed;
}

/** Reads the return path from URL search params (Next.js `useSearchParams`, `URLSearchParams`, etc.). */
export function readVaultUnlockReturnPath(
  searchParams: { get(name: string): string | null } | null | undefined,
  options?: VaultUnlockReturnPathOptions
): string {
  const paramName = options?.paramName ?? VAULT_UNLOCK_RETURN_QUERY_PARAM;
  return resolveVaultUnlockReturnPath(searchParams?.get(paramName), options);
}

/** Builds a vault unlock route href that preserves the caller's return path. */
export function buildVaultUnlockHref(
  unlockPath: string,
  returnPath: string,
  options?: { paramName?: string }
): string {
  const paramName = options?.paramName ?? VAULT_UNLOCK_RETURN_QUERY_PARAM;
  const params = new URLSearchParams({ [paramName]: returnPath });
  const separator = unlockPath.includes("?") ? "&" : "?";
  return `${unlockPath}${separator}${params.toString()}`;
}
