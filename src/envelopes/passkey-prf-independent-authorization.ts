import { extractInnerVaultKeyBlob } from "../crypto/vault-key-envelope.js";
import {
  importAesKwKey,
  importUserVaultAesKey,
  isLegacyRawVaultKeyMaterial,
  unwrapAesKey,
} from "../crypto/user-vault-key-crypto.js";
import { VaultAuthorizationError } from "../errors/vault-errors.js";
import { deriveVaultPasswordKeyPairFromMetadata } from "../kdf/argon2id.js";
import { vaultPasskeyOpaqueIdSchema } from "../passkey/model.js";
import type {
  RecoveryPhraseWordCount,
  VaultAadScope,
  VaultCryptoProfile,
} from "../profile.js";
import type {
  PasskeyPrfEnvelope,
  PasswordEnvelope,
  RecoveryPhraseEnvelope,
} from "../validation/schemas.js";
import {
  passwordEnvelopeSchema,
  recoveryPhraseEnvelopeSchema,
} from "../validation/schemas.js";
import { rewrapInnerVaultKeyMaterialForWrappingKeys } from "../crypto/vault-key-envelope.js";
import {
  assertRecoveryPhraseUnlockInput,
  deriveRecoveryPhraseKeyFromMetadata,
} from "./recovery.js";
import { unlockVaultKeyEnvelopeWithAadRouting } from "./legacy-vault-key-unlock.js";
import { createPasskeyPrfEnvelope } from "./passkey-prf.js";

type AuthorizationScope = Pick<VaultAadScope, "userId" | "resourceId">;

export type PasskeyVariantIndependentAuthorization =
  | {
      kind: "password";
      password: string;
      envelope: PasswordEnvelope;
    }
  | {
      kind: "recovery_phrase";
      recoveryPhrase: string;
      envelope: RecoveryPhraseEnvelope;
      expectedWordCount?: RecoveryPhraseWordCount | null;
    };

export type CreatePasskeyPrfEnvelopeAfterIndependentAuthorizationInput = {
  authorization: PasskeyVariantIndependentAuthorization;
  verifiedCredentialId: string;
  prfOutput: Uint8Array;
  expectedScope: AuthorizationScope;
  profile: VaultCryptoProfile;
  publicMetadata?: Record<string, unknown>;
};

export type CreatePasskeyPrfEnvelopeAfterIndependentAuthorizationResult = {
  vaultKey: CryptoKey;
  envelope: PasskeyPrfEnvelope;
};

type DerivedAuthorization = {
  encryptionKey: CryptoKey;
  wrappingKey: CryptoKey;
  envelope: PasswordEnvelope | RecoveryPhraseEnvelope;
};

async function deriveAuthorization(
  authorization: PasskeyVariantIndependentAuthorization
): Promise<DerivedAuthorization> {
  if (authorization.kind === "password") {
    const envelope = passwordEnvelopeSchema.parse(authorization.envelope);
    const keys = await deriveVaultPasswordKeyPairFromMetadata(
      authorization.password,
      envelope.kdfMetadata
    );
    return { ...keys, envelope };
  }

  if (authorization.kind !== "recovery_phrase") {
    throw new TypeError("Independent authorization must use password or recovery phrase");
  }
  const envelope = recoveryPhraseEnvelopeSchema.parse(authorization.envelope);
  if (authorization.expectedWordCount != null) {
    assertRecoveryPhraseUnlockInput(
      authorization.recoveryPhrase,
      authorization.expectedWordCount
    );
  }
  const keys = await deriveRecoveryPhraseKeyFromMetadata(
    authorization.recoveryPhrase,
    envelope.kdfMetadata
  );
  return { ...keys, envelope };
}

/**
 * Creates an additional PRF envelope only after password or recovery-phrase authorization.
 * The operation is local and stateless: it neither persists nor revokes variants or bindings.
 */
export async function createPasskeyPrfEnvelopeAfterIndependentAuthorization(
  input: CreatePasskeyPrfEnvelopeAfterIndependentAuthorizationInput
): Promise<CreatePasskeyPrfEnvelopeAfterIndependentAuthorizationResult> {
  const credentialId = vaultPasskeyOpaqueIdSchema.safeParse(input.verifiedCredentialId);
  if (!credentialId.success) {
    throw new TypeError("Verified passkey credential ID is invalid");
  }
  if (!(input.prfOutput instanceof Uint8Array) || input.prfOutput.byteLength < 32) {
    throw new VaultAuthorizationError("PRF output must be at least 32 bytes");
  }

  const prfSnapshot = input.prfOutput.slice();
  const sensitiveBuffers: Uint8Array[] = [prfSnapshot];
  // A successful routing result necessarily invokes the callback and replaces this sentinel.
  let sourceInner: Uint8Array = new Uint8Array(0);

  try {
    const derived = await deriveAuthorization(input.authorization);
    const vaultKey = await unlockVaultKeyEnvelopeWithAadRouting(
      derived.envelope.encryptedVaultKey,
      input.expectedScope,
      input.profile,
      async (candidate) => {
        const candidateInner = await extractInnerVaultKeyBlob(
          candidate,
          derived.encryptionKey
        );
        sensitiveBuffers.push(candidateInner);
        const candidateVaultKey = isLegacyRawVaultKeyMaterial(candidateInner)
          ? await importUserVaultAesKey(candidateInner)
          : await unwrapAesKey(candidateInner, derived.wrappingKey);
        sourceInner = candidateInner;
        return candidateVaultKey;
      }
    );

    const prfWrappingKey = await importAesKwKey(prfSnapshot.subarray(0, 32));
    const rewrappedInner = await rewrapInnerVaultKeyMaterialForWrappingKeys(
      sourceInner,
      derived.wrappingKey,
      prfWrappingKey,
      vaultKey
    );
    sensitiveBuffers.push(rewrappedInner);

    const envelope = await createPasskeyPrfEnvelope(
      vaultKey,
      prfSnapshot,
      input.expectedScope,
      input.profile,
      {
        ...input.publicMetadata,
        credentialId: credentialId.data,
        prfRequired: true,
      },
      { innerVaultKeyBlob: rewrappedInner }
    );

    return { vaultKey, envelope };
  } finally {
    for (const buffer of sensitiveBuffers) buffer.fill(0);
  }
}
