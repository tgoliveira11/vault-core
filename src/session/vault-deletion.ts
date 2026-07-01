import type { PasswordEnvelope } from "../validation/schemas.js";
import type { VaultAadScope, VaultCryptoProfile } from "../profile.js";
import { unlockWithPasswordEnvelope } from "../envelopes/password.js";
import { lockVaultSession, resetVaultSessionLockState } from "./auto-lock.js";

type DeletionScope = Pick<VaultAadScope, "userId" | "resourceId">;

export type DeleteVaultAfterAuthorizationOptions = {
  /**
   * App-owned persistence purge (encrypted envelopes, payload, passkey credential id, etc.).
   * vault-core does not persist vault records; the app must delete all persisted vault artifacts.
   */
  purgePersistedVault: () => void | Promise<void>;
};

/**
 * Completes vault deletion after the caller has verified authorization.
 * Clears in-memory session state so the client returns to an unconfigured vault state.
 */
export async function deleteVaultAfterAuthorization(
  options: DeleteVaultAfterAuthorizationOptions
): Promise<void> {
  await options.purgePersistedVault();
  lockVaultSession();
  resetVaultSessionLockState();
}

export type DeleteVaultWithPasswordAuthorizationOptions = DeleteVaultAfterAuthorizationOptions & {
  currentPassword: string;
  passwordEnvelope: PasswordEnvelope;
  scope: DeletionScope;
  profile: VaultCryptoProfile;
};

/**
 * Verifies the current vault password, purges app-owned persisted vault data, and clears session state.
 */
export async function deleteVaultWithPasswordAuthorization(
  options: DeleteVaultWithPasswordAuthorizationOptions
): Promise<void> {
  const { currentPassword, passwordEnvelope, scope, profile, purgePersistedVault } = options;

  await unlockWithPasswordEnvelope(currentPassword, passwordEnvelope, scope, profile);
  await deleteVaultAfterAuthorization({ purgePersistedVault });
}
