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

let deleteVaultAfterAuthorizationWarned = false;

/** @internal Resets the one-time browser warning between tests. */
export function resetDeleteVaultAfterAuthorizationWarningForTests(): void {
  deleteVaultAfterAuthorizationWarned = false;
}

/**
 * Completes vault deletion after the caller has verified authorization.
 * Clears in-memory session state so the client returns to an unconfigured vault state.
 *
 * **Security:** The caller MUST verify authorization (vault password, recovery phrase, passkey,
 * or equivalent) before invoking this helper. It performs no credential checks. Prefer
 * {@link deleteVaultWithPasswordAuthorization} when the user supplies the current vault password.
 */
export async function deleteVaultAfterAuthorization(
  options: DeleteVaultAfterAuthorizationOptions
): Promise<void> {
  if (typeof window !== "undefined" && !deleteVaultAfterAuthorizationWarned) {
    deleteVaultAfterAuthorizationWarned = true;
    console.warn(
      "[vault-core] deleteVaultAfterAuthorization() does not verify credentials. " +
        "Confirm authorization in application code or use deleteVaultWithPasswordAuthorization()."
    );
  }

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
