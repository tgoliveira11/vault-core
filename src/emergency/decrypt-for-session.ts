import type { z } from "zod";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import type { EncryptedVaultPayload, VaultSetupWithDecoy } from "../validation/schemas.js";
import { decryptVaultPayloadWithSchema } from "../payload/encrypted-payload.js";
import { getVaultSessionMode } from "../session/memory-session.js";
import {
  assertSessionPayloadDecryptAllowed,
  resolveSessionEncryptedBlob,
} from "./unlock-routing.js";

export type DecryptVaultPayloadForSessionInput<T extends z.ZodType> = {
  record: VaultSetupWithDecoy;
  vaultKey: CryptoKey;
  scope: Pick<VaultAadScope, "userId" | "resourceId">;
  profile: VaultCryptoProfile;
  schema: T;
  /** Override session mode (defaults to {@link getVaultSessionMode}). */
  mode?: "normal" | "emergency";
};

/**
 * Decrypts the correct encrypted blob for the active session mode.
 * Refuses primary blob decrypt when emergency mode is active.
 */
export async function decryptVaultPayloadForSession<T extends z.ZodType>(
  input: DecryptVaultPayloadForSessionInput<T>
): Promise<z.infer<T>> {
  const mode = input.mode ?? getVaultSessionMode();
  const targetBlob = resolveSessionEncryptedBlob({
    mode,
    primaryBlob: input.record.encryptedBlob,
    decoyBlob: input.record.decoy?.encryptedBlob,
  });

  assertSessionPayloadDecryptAllowed({
    mode,
    targetBlob,
    primaryBlob: input.record.encryptedBlob,
  });

  return decryptVaultPayloadWithSchema(
    targetBlob,
    input.vaultKey,
    input.scope,
    input.profile,
    input.schema
  );
}
