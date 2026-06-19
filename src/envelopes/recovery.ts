import { generateMnemonic, mnemonicToEntropy, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type {
  Argon2idKdfMetadata,
  EncryptedVaultPayload,
  KdfMetadata,
  RecoveryPhraseEnvelope,
} from "../validation/schemas.js";
import type { RecoveryPhraseWordCount } from "../profile.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import { stringToBytes, bytesToBase64Url, base64UrlToBytes } from "../crypto/encoding.js";
import {
  deriveArgon2idAesKey,
  deriveArgon2idAesKeyFromMetadata,
  serializeArgon2idMetadata,
} from "../kdf/argon2id.js";
import { DEFAULT_ARGON2ID_PARAMS } from "../kdf/params.js";
import { RecoveryPhraseConfirmationError } from "../errors/vault-errors.js";
import { encryptField, decryptField, exportAesKey, importAesKey } from "../crypto/aes-gcm.js";

export const RECOVERY_PHRASE_WORDLIST_SOURCE = "BIP39 English (BIP-0039)" as const;
export const DEFAULT_RECOVERY_PHRASE_WORD_COUNT: RecoveryPhraseWordCount = 24;

const STRENGTH_BITS: Record<RecoveryPhraseWordCount, 128 | 256> = {
  12: 128,
  24: 256,
};

type WrapScope = Pick<VaultAadScope, "userId" | "resourceId">;

export function createRecoveryPhrase(options: {
  wordCount: RecoveryPhraseWordCount;
}): string {
  const { wordCount } = options;
  if (wordCount !== 12 && wordCount !== 24) {
    throw new Error("Recovery phrase word count must be 12 or 24");
  }
  return generateMnemonic(wordlist, STRENGTH_BITS[wordCount]);
}

/** @deprecated Use createRecoveryPhrase */
export const generateRecoveryPhrase = createRecoveryPhrase;

export function getRecoveryPhraseWordCount(phrase: string): RecoveryPhraseWordCount | null {
  const normalized = normalizeRecoveryPhrase(phrase);
  const count = normalized.split(" ").filter(Boolean).length;
  if (count === 12 || count === 24) return count;
  return null;
}

export function getRecoveryConfirmationPromptCount(
  wordCount: RecoveryPhraseWordCount
): number {
  return wordCount === 12 ? 3 : 4;
}

export function parseRecoveryPhraseWordCount(
  publicMetadata?: Record<string, unknown> | null
): RecoveryPhraseWordCount | null {
  const raw = publicMetadata?.phraseLength ?? publicMetadata?.wordCount;
  if (raw === 12 || raw === 24) return raw;
  return null;
}

export function assertRecoveryPhraseUnlockInput(
  phrase: string,
  expectedWordCount?: RecoveryPhraseWordCount | null
): void {
  const normalized = normalizeRecoveryPhrase(phrase);
  if (!validateRecoveryPhraseFormat(normalized)) {
    throw new Error("Enter a valid 12- or 24-word BIP39 recovery phrase.");
  }

  const actualCount = getRecoveryPhraseWordCount(normalized);
  if (expectedWordCount != null && actualCount !== expectedWordCount) {
    throw new Error(
      `This vault uses a ${expectedWordCount}-word recovery phrase. You entered ${actualCount ?? "an invalid number of"} words.`
    );
  }
}

export function normalizeRecoveryPhrase(phrase: string): string {
  return phrase
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

export function validateRecoveryPhraseFormat(phrase: string): boolean {
  const normalized = normalizeRecoveryPhrase(phrase);
  if (!normalized) return false;
  const words = normalized.split(" ");
  if (words.length !== 12 && words.length !== 24) return false;
  return validateMnemonic(normalized, wordlist);
}

export function assertRecoveryPhraseConfirmation(
  originalPhrase: string,
  confirmationPhrase: string
): void {
  const a = normalizeRecoveryPhrase(originalPhrase);
  const b = normalizeRecoveryPhrase(confirmationPhrase);
  if (a !== b) {
    throw new RecoveryPhraseConfirmationError("Recovery phrase confirmation does not match");
  }
  if (!validateRecoveryPhraseFormat(a)) {
    throw new RecoveryPhraseConfirmationError("Recovery phrase is not valid");
  }
}

export function pickRecoveryConfirmationIndices(
  wordCount: number,
  count = 3
): number[] {
  if (wordCount < count) {
    throw new Error("Not enough words for confirmation");
  }
  const indices: number[] = [];
  let seed = wordCount * 7919 + count * 104729;
  while (indices.length < count) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const candidate = (seed % wordCount) + 1;
    if (!indices.includes(candidate)) {
      indices.push(candidate);
    }
  }
  return indices.sort((a, b) => a - b);
}

export function assertRecoveryPhraseWordConfirmation(
  originalPhrase: string,
  answers: Record<number, string>
): void {
  const words = normalizeRecoveryPhrase(originalPhrase).split(" ");
  if (!validateRecoveryPhraseFormat(originalPhrase)) {
    throw new RecoveryPhraseConfirmationError("Recovery phrase is not valid");
  }

  for (const [indexRaw, answer] of Object.entries(answers)) {
    const index = Number.parseInt(indexRaw, 10);
    const expected = words[index - 1];
    const given = normalizeRecoveryPhrase(answer);
    if (!expected || given !== expected) {
      throw new RecoveryPhraseConfirmationError(
        `Word #${index} does not match your recovery phrase`
      );
    }
  }
}

export async function deriveRecoveryPhraseKey(
  phrase: string,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; metadata: Argon2idKdfMetadata }> {
  const normalized = normalizeRecoveryPhrase(phrase);
  if (!validateRecoveryPhraseFormat(normalized)) {
    throw new Error("Invalid recovery phrase");
  }
  mnemonicToEntropy(normalized, wordlist);

  const saltBytes =
    salt ?? crypto.getRandomValues(new Uint8Array(DEFAULT_ARGON2ID_PARAMS.saltLength));
  const passwordBytes = stringToBytes(normalized);
  const key = await deriveArgon2idAesKey(passwordBytes, saltBytes);
  return {
    key,
    metadata: serializeArgon2idMetadata(saltBytes),
  };
}

export async function deriveRecoveryPhraseKeyFromMetadata(
  phrase: string,
  metadata: Argon2idKdfMetadata
): Promise<CryptoKey> {
  const normalized = normalizeRecoveryPhrase(phrase);
  if (!validateRecoveryPhraseFormat(normalized)) {
    throw new Error("Invalid recovery phrase");
  }
  return deriveArgon2idAesKeyFromMetadata(stringToBytes(normalized), metadata);
}

async function wrapVaultKeyWithDerivedKey(
  vaultKey: CryptoKey,
  derivedKey: CryptoKey,
  scope: WrapScope,
  profile: VaultCryptoProfile
): Promise<EncryptedVaultPayload> {
  return encryptField(bytesToBase64Url(await exportAesKey(vaultKey)), derivedKey, {
    userId: scope.userId,
    resourceId: scope.resourceId,
    field: "vault_key",
  }, profile);
}

async function unwrapVaultKeyWithDerivedKey(
  encryptedVaultKey: EncryptedVaultPayload,
  derivedKey: CryptoKey
): Promise<CryptoKey> {
  const keyBytes = base64UrlToBytes(await decryptField(encryptedVaultKey, derivedKey));
  return importAesKey(keyBytes);
}

export async function createRecoveryEnvelope(
  vaultKey: CryptoKey,
  recoveryPhrase: string,
  scope: WrapScope,
  profile: VaultCryptoProfile,
  publicMetadata?: { phraseLength: RecoveryPhraseWordCount },
  salt?: Uint8Array
): Promise<{ envelope: RecoveryPhraseEnvelope; kdfMetadata: Argon2idKdfMetadata }> {
  const { key: derivedKey, metadata } = await deriveRecoveryPhraseKey(recoveryPhrase, salt);
  const encryptedVaultKey = await wrapVaultKeyWithDerivedKey(vaultKey, derivedKey, scope, profile);
  return {
    envelope: {
      method: "recovery_phrase",
      encryptedVaultKey,
      kdfMetadata: metadata,
      publicMetadata,
    },
    kdfMetadata: metadata,
  };
}

export async function unlockWithRecoveryEnvelope(
  recoveryPhrase: string,
  envelope: RecoveryPhraseEnvelope | { encryptedVaultKey: EncryptedVaultPayload; kdfMetadata: KdfMetadata },
  options?: { expectedWordCount?: RecoveryPhraseWordCount | null }
): Promise<CryptoKey> {
  if (options?.expectedWordCount != null) {
    assertRecoveryPhraseUnlockInput(recoveryPhrase, options.expectedWordCount);
  }
  if (envelope.kdfMetadata?.kdf !== "argon2id") {
    throw new Error("Recovery phrase envelope requires Argon2id metadata");
  }
  const derivedKey = await deriveRecoveryPhraseKeyFromMetadata(recoveryPhrase, envelope.kdfMetadata);
  return unwrapVaultKeyWithDerivedKey(envelope.encryptedVaultKey, derivedKey);
}

/** @deprecated Use createRecoveryEnvelope */
export async function wrapVaultKeyForRecoveryPhrase(
  vaultKey: CryptoKey,
  recoveryPhrase: string,
  scope: WrapScope,
  profile: VaultCryptoProfile,
  salt?: Uint8Array
): Promise<{ encryptedVaultKey: EncryptedVaultPayload; kdfMetadata: Argon2idKdfMetadata }> {
  const { envelope, kdfMetadata } = await createRecoveryEnvelope(
    vaultKey,
    recoveryPhrase,
    scope,
    profile,
    undefined,
    salt
  );
  return { encryptedVaultKey: envelope.encryptedVaultKey, kdfMetadata };
}

/** @deprecated Use unlockWithRecoveryEnvelope */
export const unwrapVaultKeyFromRecoveryPhrase = unlockWithRecoveryEnvelope;
