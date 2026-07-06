import { z } from "zod";
import {
  createDecoyVaultSetup,
  createPasswordEnvelope,
  createRecoveryEnvelope,
  createRecoveryPhrase,
  createUserVaultKey,
  encryptVaultPayload,
  vaultSetupWithDecoySchema,
  type VaultSetupWithDecoy,
} from "../index.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";

/** Sentinel string for honey/decoy vault integration tests. */
export const HONEY_VAULT_SENTINEL_NOTE = "HONEY_VAULT_DEMO_NOTE" as const;

/** Sentinel string that must not appear in emergency sessions. */
export const PRIMARY_VAULT_SENTINEL_NOTE = "PRIMARY_VAULT_DEMO_NOTE" as const;

const testPayloadSchema = z.object({
  version: z.literal(1),
  sentinel: z.string(),
});

export type TestVaultFixtureScope = Pick<VaultAadScope, "userId" | "resourceId">;

export type PrimaryDecoyVaultFixture = {
  record: VaultSetupWithDecoy;
  primaryPassword: string;
  duressPassword: string;
  duressSequence: string;
  primaryRecoveryPhrase: string;
  decoyRecoveryPhrase: string;
};

/**
 * Creates a primary + decoy vault record pair for deterministic emergency-mode tests.
 */
export async function createPrimaryDecoyVaultFixture(input: {
  scope: TestVaultFixtureScope;
  profile: VaultCryptoProfile;
  primaryPassword?: string;
  duressSequence?: string;
  duressPassword?: string;
}): Promise<PrimaryDecoyVaultFixture> {
  const primaryPassword = input.primaryPassword ?? "PrimaryVaultPass1!";
  const duressSequence = input.duressSequence ?? "911";
  const duressPassword = input.duressPassword ?? `Decoy${duressSequence}Pass!`;

  const primaryVaultKey = await createUserVaultKey();
  const primaryRecoveryPhrase = createRecoveryPhrase({ wordCount: 12 });

  const { envelope: passwordEnvelope } = await createPasswordEnvelope(
    primaryVaultKey,
    primaryPassword,
    input.scope,
    input.profile
  );

  const { envelope: recoveryEnvelope } = await createRecoveryEnvelope(
    primaryVaultKey,
    primaryRecoveryPhrase,
    input.scope,
    input.profile,
    { phraseLength: 12 }
  );

  const encryptedBlob = await encryptVaultPayload(
    { version: 1 as const, sentinel: PRIMARY_VAULT_SENTINEL_NOTE },
    primaryVaultKey,
    input.scope,
    input.profile
  );

  const { decoy, decoyRecoveryPhrase } = await createDecoyVaultSetup({
    duressPassword,
    duressSequence,
    honeyPayload: { version: 1 as const, sentinel: HONEY_VAULT_SENTINEL_NOTE },
    scope: input.scope,
    profile: input.profile,
    recoveryWordCount: 12,
  });

  const record = vaultSetupWithDecoySchema.parse({
    cryptoVersion: "vault-v1",
    encryptedBlob,
    passwordEnvelope,
    recoveryEnvelope,
    passkeyPrfEnvelope: null,
    decoy,
  });

  return {
    record,
    primaryPassword,
    duressPassword,
    duressSequence,
    primaryRecoveryPhrase,
    decoyRecoveryPhrase,
  };
}
