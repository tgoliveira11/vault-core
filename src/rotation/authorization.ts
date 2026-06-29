import type { PasswordEnvelope, PasskeyPrfEnvelope } from "../validation/schemas.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import { VaultAuthorizationError } from "../errors/vault-errors.js";
import { userVaultKeysEqual } from "../keys/user-vault-key.js";
import { unlockWithPasswordEnvelope } from "../envelopes/password.js";
import { unlockWithPasskeyPrfEnvelope } from "../envelopes/passkey-prf.js";

export type VaultPasswordAuthorization = {
  kind: "password";
  currentPassword: string;
  passwordEnvelope: PasswordEnvelope;
};

export type VaultPasskeyPrfAuthorization = {
  kind: "passkey_prf";
  prfOutput: Uint8Array;
  passkeyEnvelope: PasskeyPrfEnvelope;
};

export type VaultRotationAuthorization =
  | VaultPasswordAuthorization
  | VaultPasskeyPrfAuthorization;

type AuthorizationScope = Pick<VaultAadScope, "userId" | "resourceId">;

/**
 * Proves the caller can authorize a sensitive vault change while the UVK is already in memory.
 * Password authorization re-unlocks the password envelope; passkey authorization re-unlocks the PRF envelope.
 */
export async function assertVaultRotationAuthorized(
  vaultKey: CryptoKey,
  authorization: VaultRotationAuthorization,
  scope: AuthorizationScope,
  profile: VaultCryptoProfile
): Promise<void> {
  let authorizedKey: CryptoKey;

  if (authorization.kind === "password") {
    authorizedKey = await unlockWithPasswordEnvelope(
      authorization.currentPassword,
      authorization.passwordEnvelope,
      scope,
      profile
    );
  } else {
    if (authorization.prfOutput.byteLength < 32) {
      throw new VaultAuthorizationError("PRF output must be at least 32 bytes");
    }
    authorizedKey = await unlockWithPasskeyPrfEnvelope(
      authorization.passkeyEnvelope,
      authorization.prfOutput,
      scope,
      profile
    );
  }

  if (!(await userVaultKeysEqual(vaultKey, authorizedKey))) {
    throw new VaultAuthorizationError("Vault authorization failed");
  }
}
