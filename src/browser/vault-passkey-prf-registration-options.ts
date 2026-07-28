import { buildPrfSaltBytes } from "./prf-salt-bytes.js";
import {
  prepareWebAuthnPrfExtensions,
  type PublicKeyCredentialCreationOptionsInput,
} from "./webauthn-prf-options.js";

export type PrepareVaultPasskeyPrfRegistrationOptionsInput<
  T extends PublicKeyCredentialCreationOptionsInput = PublicKeyCredentialCreationOptionsInput,
> = {
  userId: string;
  prfSaltPrefix: string;
  serverOptions: T;
  /**
   * Optional JSON preparer that converts the server challenge and user id to browser input before
   * vault-core adds the local-only PRF salt.
   */
  prepareJson?: (options: T) => PublicKeyCredentialCreationOptionsInput;
};

/**
 * Prepares a passkey registration ceremony to evaluate the vault PRF immediately. A successful
 * authenticator can therefore create the first PRF envelope without a second WebAuthn prompt.
 */
export async function prepareVaultPasskeyPrfRegistrationOptions<
  T extends PublicKeyCredentialCreationOptionsInput,
>(input: PrepareVaultPasskeyPrfRegistrationOptionsInput<T>): Promise<T> {
  const options: PublicKeyCredentialCreationOptionsInput = input.prepareJson
    ? input.prepareJson(input.serverOptions)
    : { ...input.serverOptions };
  const salt = await buildPrfSaltBytes(input.prfSaltPrefix, input.userId);
  const existingPrf = options.extensions?.prf;
  const { evalByCredential: _removed, ...registrationPrf } = existingPrf ?? {};

  return {
    ...options,
    extensions: prepareWebAuthnPrfExtensions({
      ...options.extensions,
      prf: {
        ...registrationPrf,
        eval: { ...registrationPrf.eval, first: salt },
      },
    }),
  } as T;
}
