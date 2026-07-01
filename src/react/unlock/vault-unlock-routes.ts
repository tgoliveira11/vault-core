/** Default query parameter for the post-unlock return path on vault unlock routes. */
export const VAULT_UNLOCK_RETURN_QUERY_PARAM = "next";

export type VaultUnlockReturnPathOptions = {
  /** Used when the query value is missing or unsafe. Defaults to `/`. */
  defaultPath?: string;
  /** Query parameter name. Defaults to `next`. */
  paramName?: string;
};

const MAX_RETURN_PATH_DECODES = 3;

function containsControlCharacters(value: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function isUnsafeReturnPath(value: string): boolean {
  if (!value.startsWith("/")) return true;
  if (value.startsWith("//")) return true;
  if (value.includes("\\")) return true;
  if (containsControlCharacters(value)) return true;
  if (/^\/[^/]*:/i.test(value)) return true;
  return false;
}

function decodeReturnPathCandidate(raw: string): string | null {
  let candidate = raw.trim();
  if (!candidate) return null;

  for (let index = 0; index < MAX_RETURN_PATH_DECODES; index += 1) {
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded.trim();
    } catch {
      return null;
    }
  }

  if (isUnsafeReturnPath(candidate)) return null;
  return candidate;
}

/**
 * Validates a caller-supplied return path. Only same-origin relative paths are accepted
 * (`/dashboard`, `/vault`). Rejects empty values, protocol-relative paths, absolute URLs,
 * backslashes, control characters, and encoded bypasses such as `/%2F%2Fevil`.
 */
export function resolveVaultUnlockReturnPath(
  raw: string | null | undefined,
  options?: VaultUnlockReturnPathOptions
): string {
  const defaultPath = options?.defaultPath ?? "/";
  if (!raw) return defaultPath;

  const resolved = decodeReturnPathCandidate(raw);
  if (!resolved) return defaultPath;
  return resolved;
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
  const safeReturnPath = resolveVaultUnlockReturnPath(returnPath);
  const params = new URLSearchParams({ [paramName]: safeReturnPath });
  const separator = unlockPath.includes("?") ? "&" : "?";
  return `${unlockPath}${separator}${params.toString()}`;
}
