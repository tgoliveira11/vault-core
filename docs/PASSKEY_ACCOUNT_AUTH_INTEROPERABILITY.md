# Passkey account-auth and vault interoperability

This guide defines how one WebAuthn credential may be used for both account authentication and
vault PRF unlock without merging their authorization domains. The capability is optional: consumers
must continue to support separate account and vault credentials.

## Security and privacy decision

- The same credential is possible only under the same effective RP ID. Origins remain explicitly
  allowlisted by the authentication server.
- Account login proves account access through a server-verified signature. Vault unlock derives a
  local PRF result and unwraps a vault envelope in the browser. Neither result authorizes the other.
- Sharing a credential increases the impact of that credential/provider being compromised compared
  with two independent credentials. Use explicit user consent; never enable the second capability
  silently.
- Reusing the credential ID links the account credential to encrypted vault envelopes already owned
  by that account. It must not add wallet addresses, private keys, emergency state, or decrypted
  payload data to authentication records, logs, analytics, friendly names, or AAD.
- PRF output never leaves the browser. Both the account-auth package and the consumer server must
  reject any request whose `clientExtensionResults` has its own `prf` property.

## Decoupled package contract

The authentication package and vault-core must not import one another. The consuming application
composes optional browser callbacks:

1. The authentication package obtains server options and verifies the WebAuthn response.
2. A consumer callback may compose those browser options with a vault-core PRF preparation helper.
3. Extension results remain in browser memory while the response sent to the server is sanitized.
4. A vault callback runs only after the server returns the exact verified credential ID and, for
   login, after the fully authenticated account session exists.

Use the existing preparation helpers in both cases. With native `navigator.credentials.create/get`,
provide `prepareJson` when encoded challenge/user/credential fields need conversion. Libraries such
as `@simplewebauthn/browser` convert those fields themselves but pass extensions through, so omit
`prepareJson`; the server JSON fields remain encoded and the PRF salt is a native `ArrayBuffer`:

```ts
import {
  prepareVaultPasskeyPrfAuthenticationOptions,
  prepareVaultPasskeyPrfRegistrationOptions,
  resolvePasskeyPrfEnrollmentAfterRegistration,
  sanitizeWebAuthnResponseForServer,
} from "@tgoliveira/vault-core/browser";
```

Composition with SimpleWebAuthn-style registration is direct:

```ts
import {
  prepareVaultPasskeyPrfRegistrationOptions,
  type PublicKeyCredentialCreationOptionsInput,
} from "@tgoliveira/vault-core/browser";

declare const userId: string;
declare const prfSaltPrefix: string;
declare const accountRegistrationOptions: PublicKeyCredentialCreationOptionsInput;
declare function startRegistration(input: {
  optionsJSON: PublicKeyCredentialCreationOptionsInput;
}): Promise<unknown>;

const optionsJSON = await prepareVaultPasskeyPrfRegistrationOptions({
  userId,
  prfSaltPrefix,
  serverOptions: accountRegistrationOptions,
});
const registration = await startRegistration({ optionsJSON });
```

`challenge` and `user.id` stay encoded for the library; `extensions.prf.eval.first` is already the
native `ArrayBuffer` it passes through to `navigator.credentials.create()`.

`sanitizeWebAuthnResponseForServer()` is safe defense in depth for app-owned routes. An
authentication package that offers composable hooks must also sanitize internally and its server
must fail closed if PRF is present.

## Account-first: creation plus vault PRF confirmation

1. Start normal account passkey registration with account-auth server options.
2. In its optional preparation hook, call
   `prepareVaultPasskeyPrfRegistrationOptions({ userId, prfSaltPrefix, serverOptions })`.
3. Run the WebAuthn creation ceremony. Retain `clientExtensionResults` only in memory and send the
   sanitized registration response to the authentication server.
4. After verification, require the browser registration credential ID to equal the server-verified
   ID and call `resolvePasskeyPrfEnrollmentAfterRegistration()`.
5. Run the resolver's exact-credential authentication, verify and sanitize that assertion, and use
   only its authentication PRF to create the first durable vault envelope. The primary vault must be
   unlocked or independently authorized by local password/recovery. Persist append-only and enable
   the vault capability atomically; never repeat registration.

Failure to add the vault capability must leave a valid account-login credential. Retrying vault
enrollment is an independent operation.

## Vault-first: enable sign-in without re-registration

A WebAuthn credential cannot be promoted safely by updating a database flag directly. The
authentication package must own an authenticated capability-enable flow with:

- a separate challenge audience (for example `sign_in_capability_enable`), bound to the current
  user and exact credential, short-lived and single-use;
- a fully authenticated account session, including completed 2FA;
- `userVerification: "required"`, signature verification against the authoritative credential row,
  and atomic monotonic counter advancement; counterless authenticators (`0 → 0`) also require a
  separate monotonic credential revision in the same compare-and-swap; and
- an auditable, atomic `signInEnabled=true` transition.

No PRF is required merely to enable sign-in. If the app also performs vault work during that
ceremony, PRF is still browser-only and the response sent to the server is sanitized.

Legacy vault-only credentials created with a random user handle or non-discoverable policy may not
support discoverable username-less login. Keep email/allow-list login available or require explicit
credential recreation instead of weakening verification.

## Login and optional vault unlock

An account login ceremony may request the vault PRF using
`prepareVaultPasskeyPrfAuthenticationOptions()`. The server verifies only the sanitized
assertion. The browser may attempt vault candidate unwrap only when all of the following are true:

- account authentication and session creation have completed;
- any required 2FA has completed;
- the browser credential ID exactly equals the server-verified credential ID;
- candidates are scoped to that credential and authenticated user; and
- unwrap succeeds locally against the expected scope/profile.

If PRF is absent, unsupported, cancelled, or does not match any candidate, account login remains
successful and the vault remains locked. With 2FA, discard pre-2FA PRF and perform a new exact vault
assertion after TOTP. Any future memory-only handoff that avoids the second prompt requires a
separate security review and must never use localStorage, sessionStorage, IndexedDB, URL parameters,
cookies, or server persistence.

## Server ownership and lifecycle

- Keep one authoritative public key and counter for the credential. Each assertion has one server
  verifier and one atomic compare-and-swap update. Include both the signature counter and a
  monotonic credential revision so concurrent assertions from counterless authenticators cannot
  both commit. Never verify the same assertion in two packages or copy either value into separate
  account/vault rows.
- Use distinct challenge audiences for account registration, account login, sign-in capability
  enable, vault enrollment/management, and vault unlock. Reject cross-audience and replayed
  responses.
- Store independent capabilities such as `{ signIn, vaultUnlock }`. Disabling one preserves the
  other. Revoking a dual-capability credential requires explicit confirmation and coordinated
  cleanup of envelopes, bindings, sessions, and the authoritative credential row.
- Browser bindings remain optional routing/quick-start hints. They are not proof of account or vault
  authorization.

## Minimum acceptance tests

- Account-first and vault-first opt-in, including exact credential ID mismatch.
- PRF stripping in registration/login and server rejection for every PRF shape.
- Same-RP success; wrong RP/origin failure.
- Cross-audience, expired, and replayed challenge failure.
- No vault callback/unwrap before 2FA or before positive final-session confirmation; missing or
  incomplete session results fail closed. PRF absence leaves login successful and vault locked.
- Counter monotonicity, revision conflicts for concurrent compare-and-swap, and counterless
  `0 → 0` credentials.
- Disabling one capability preserves the other; dual revocation is coordinated and atomic.
- Logs, analytics, guest endpoints, AAD, and authentication records contain no PRF, wallet, vault
  plaintext, or emergency/decoy target.

`TODO_SECURITY_REVIEW_REQUIRED`: before a consumer ships this feature, its owner must approve which
server path owns the authoritative credential counter/challenge and confirm the deliberate second
assertion policy for accounts protected by 2FA.
