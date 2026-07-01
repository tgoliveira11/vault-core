import { VaultPlaintextRejectionError } from "../errors/vault-errors.js";

export const PLAINTEXT_FORBIDDEN_VAULT_FIELDS = [
  "vaultPassword",
  "confirmVaultPassword",
  "password",
  "recoveryPhrase",
  "recoveryWords",
  "mnemonic",
  "seed",
  "seedPhrase",
  "passphrase",
  "privateKey",
  "secret",
  "userVaultKey",
  "prfOutput",
  "decryptedPayload",
  "displayName",
  "walletLabel",
  "strategyNote",
  "subscriptionToken",
  "title",
  "body",
  "content",
  "message",
] as const;

export type PlaintextForbiddenField = (typeof PLAINTEXT_FORBIDDEN_VAULT_FIELDS)[number];

const FORBIDDEN_FIELD_NAMES_LOWER = new Set(
  PLAINTEXT_FORBIDDEN_VAULT_FIELDS.map((field) => field.toLowerCase())
);

export function isVaultPlaintextForbiddenField(field: string): boolean {
  return FORBIDDEN_FIELD_NAMES_LOWER.has(field.toLowerCase());
}

export function rejectVaultPlaintextFields(body: Record<string, unknown>): string | null {
  const visited = new WeakSet<object>();

  function visit(value: unknown, path: string): string | null {
    if (value === null || typeof value !== "object") return null;
    if (visited.has(value)) return null;
    visited.add(value);

    for (const [field, nestedValue] of Object.entries(value)) {
      const fieldPath = path ? `${path}.${field}` : field;
      if (isVaultPlaintextForbiddenField(field) && nestedValue !== undefined) {
        return `Plaintext field '${field}' is not allowed at '${fieldPath}'`;
      }

      const nestedError = visit(nestedValue, fieldPath);
      if (nestedError) return nestedError;
    }

    return null;
  }

  return visit(body, "");
}

export function assertNoVaultPlaintextFields(body: Record<string, unknown>): void {
  const error = rejectVaultPlaintextFields(body);
  if (error) {
    throw new VaultPlaintextRejectionError(error);
  }
}

export function validateNoPlaintextLeak(data: unknown): { ok: boolean; found: string[] } {
  const found = scanForSentinels(data);
  return { ok: found.length === 0, found };
}

export function scanForSentinels(data: unknown, sentinels: readonly string[] = ALL_SENTINELS): string[] {
  const found: string[] = [];
  const json = JSON.stringify(data);

  for (const sentinel of sentinels) {
    if (json.includes(sentinel)) {
      found.push(sentinel);
    }
  }

  return found;
}

export function containsSentinel(value: string, sentinels: readonly string[] = ALL_SENTINELS): boolean {
  return sentinels.some((sentinel) => value.includes(sentinel));
}

export const SENTINEL_VAULT_PASSWORD = "SENTINEL_VAULT_PASSWORD_DO_NOT_STORE";
export const SENTINEL_RECOVERY_PHRASE = "SENTINEL_RECOVERY_PHRASE_DO_NOT_STORE";
export const SENTINEL_12_WORD_RECOVERY_PHRASE =
  "SENTINEL_12_WORD_RECOVERY_PHRASE_DO_NOT_STORE";
export const SENTINEL_24_WORD_RECOVERY_PHRASE =
  "SENTINEL_24_WORD_RECOVERY_PHRASE_DO_NOT_STORE";
export const SENTINEL_PRIVATE_LABEL = "SENTINEL_PRIVATE_LABEL_DO_NOT_STORE";
export const SENTINEL_STRATEGY_NOTE = "SENTINEL_STRATEGY_NOTE_DO_NOT_STORE";
export const SENTINEL_SUBSCRIPTION_TOKEN = "SENTINEL_SUBSCRIPTION_TOKEN_DO_NOT_STORE";
export const SENTINEL_MANAGEMENT_TOKEN = "SENTINEL_MANAGEMENT_TOKEN_DO_NOT_STORE";
export const SENTINEL_PRIVATE_NOTE = "SENTINEL_PRIVATE_NOTE_DO_NOT_STORE";
export const SENTINEL_USER_VAULT_KEY = "SENTINEL_USER_VAULT_KEY_DO_NOT_STORE";
export const SENTINEL_PRF_OUTPUT = "SENTINEL_PRF_OUTPUT_DO_NOT_STORE";

export const ALL_SENTINELS = [
  SENTINEL_VAULT_PASSWORD,
  SENTINEL_RECOVERY_PHRASE,
  SENTINEL_12_WORD_RECOVERY_PHRASE,
  SENTINEL_24_WORD_RECOVERY_PHRASE,
  SENTINEL_PRIVATE_LABEL,
  SENTINEL_STRATEGY_NOTE,
  SENTINEL_SUBSCRIPTION_TOKEN,
  SENTINEL_MANAGEMENT_TOKEN,
  SENTINEL_PRIVATE_NOTE,
  SENTINEL_USER_VAULT_KEY,
  SENTINEL_PRF_OUTPUT,
] as const;
