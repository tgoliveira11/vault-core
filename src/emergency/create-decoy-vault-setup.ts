import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import type {
  EncryptedVaultPayload,
  VaultDecoyRecord,
} from "../validation/schemas.js";
import { createUserVaultKey } from "../keys/user-vault-key.js";
import { createPasswordEnvelope } from "../envelopes/password.js";
import { createRecoveryEnvelope, createRecoveryPhrase } from "../envelopes/recovery.js";
import { encryptVaultPayload } from "../payload/encrypted-payload.js";
import { containsDuressSequence } from "./contains-duress-sequence.js";
import { vaultDecoyRecordSchema } from "../validation/schemas.js";
import type { CreatePasswordEnvelopeOptions } from "../envelopes/password.js";
import type { RecoveryPhraseWordCount } from "../profile.js";

export class DuressPasswordMissingSequenceError extends Error {
  constructor() {
    super("Duress password must contain the configured duress sequence.");
    this.name = "DuressPasswordMissingSequenceError";
  }
}

export type CreateDecoyVaultSetupInput<T> = {
  duressPassword: string;
  duressSequence: string;
  honeyPayload: T;
  scope: Pick<VaultAadScope, "userId" | "resourceId">;
  profile: VaultCryptoProfile;
  recoveryWordCount?: RecoveryPhraseWordCount;
  passwordEnvelopeOptions?: CreatePasswordEnvelopeOptions;
};

export type CreateDecoyVaultSetupResult = {
  decoy: VaultDecoyRecord;
  decoyRecoveryPhrase: string;
};

/**
 * Creates an independent decoy vault record (fresh UVK, duress password envelope, recovery envelope).
 * Rejects duress passwords that do not contain the configured sequence.
 */
export async function createDecoyVaultSetup<T>(
  input: CreateDecoyVaultSetupInput<T>
): Promise<CreateDecoyVaultSetupResult> {
  const {
    duressPassword,
    duressSequence,
    honeyPayload,
    scope,
    profile,
    recoveryWordCount = 12,
    passwordEnvelopeOptions,
  } = input;

  if (!containsDuressSequence(duressPassword, duressSequence)) {
    throw new DuressPasswordMissingSequenceError();
  }

  const decoyVaultKey = await createUserVaultKey();
  const decoyRecoveryPhrase = createRecoveryPhrase({ wordCount: recoveryWordCount });

  const { envelope: passwordEnvelope } = await createPasswordEnvelope(
    decoyVaultKey,
    duressPassword,
    scope,
    profile,
    undefined,
    passwordEnvelopeOptions
  );

  const { envelope: recoveryEnvelope } = await createRecoveryEnvelope(
    decoyVaultKey,
    decoyRecoveryPhrase,
    scope,
    profile,
    { phraseLength: recoveryWordCount }
  );

  const encryptedBlob: EncryptedVaultPayload = await encryptVaultPayload(
    honeyPayload,
    decoyVaultKey,
    scope,
    profile
  );

  const decoy = vaultDecoyRecordSchema.parse({
    cryptoVersion: "vault-v1",
    encryptedBlob,
    passwordEnvelope,
    recoveryEnvelope,
    passkeyPrfEnvelope: null,
  });

  return { decoy, decoyRecoveryPhrase };
}
