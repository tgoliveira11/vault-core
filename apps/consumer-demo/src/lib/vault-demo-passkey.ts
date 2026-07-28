import { base64UrlToBytes, bytesToBase64Url, toBufferSource } from "@tgoliveira/vault-core";
import {
  buildPrfSaltBytes,
  extractPasskeyPrfOutput,
  isPasskeySupported,
  isPrfExtensionSupported,
  prepareVaultPasskeyPrfRegistrationOptions,
  resolvePasskeyPrfEnrollmentAfterRegistration,
} from "@tgoliveira/vault-core/browser";
import { DEMO_USER_ID, PRF_SALT_PREFIX } from "@/lib/vault-profile";

const PASSKEY_CREDENTIAL_KEY = "vault-core-demo:passkey-credential-id";

export function getDemoPasskeySupport(): { passkey: boolean; prf: boolean } {
  return {
    passkey: isPasskeySupported(),
    prf: isPrfExtensionSupported(),
  };
}

export function loadPasskeyCredentialId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PASSKEY_CREDENTIAL_KEY);
}

export function savePasskeyCredentialId(credentialId: string): void {
  localStorage.setItem(PASSKEY_CREDENTIAL_KEY, credentialId);
}

export function clearPasskeyCredentialId(): void {
  localStorage.removeItem(PASSKEY_CREDENTIAL_KEY);
}

function getRpId(): string {
  if (typeof window === "undefined") return "localhost";
  return window.location.hostname || "localhost";
}

async function buildPrfSalt(): Promise<ArrayBuffer> {
  return buildPrfSaltBytes(PRF_SALT_PREFIX, DEMO_USER_ID);
}

export async function registerDemoPasskey(): Promise<{
  prfOutput: Uint8Array;
  credentialId: string;
}> {
  if (!isPasskeySupported() || !isPrfExtensionSupported()) {
    throw new Error("Passkey PRF is not supported in this browser.");
  }

  const publicKey = await prepareVaultPasskeyPrfRegistrationOptions({
    userId: DEMO_USER_ID,
    prfSaltPrefix: PRF_SALT_PREFIX,
    serverOptions: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Vault Core Demo", id: getRpId() },
      user: {
        id: new TextEncoder().encode(DEMO_USER_ID),
        name: "vault-demo-user",
        displayName: "Vault demo user",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" as const },
        { alg: -257, type: "public-key" as const },
      ],
      authenticatorSelection: {
        residentKey: "preferred" as const,
        userVerification: "required" as const,
      },
    },
  });
  const credential = await navigator.credentials.create({
    publicKey: publicKey as PublicKeyCredentialCreationOptions,
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey registration did not return a credential.");
  }

  const credentialId = bytesToBase64Url(new Uint8Array(credential.rawId));
  // The demo has no backend. Production must pass the credential id returned by server verification.
  const enrollment = resolvePasskeyPrfEnrollmentAfterRegistration({
    registrationCredentialId: credentialId,
    verifiedCredentialId: credentialId,
    clientExtensionResults: credential.getClientExtensionResults() as Record<string, unknown>,
  });
  if (enrollment.status === "authentication_required") {
    return {
      prfOutput: await authenticateDemoPasskey(enrollment.credentialId),
      credentialId: enrollment.credentialId,
    };
  }
  if (enrollment.status !== "ready") {
    throw new Error("This authenticator did not enable PRF registration.");
  }

  return {
    prfOutput: enrollment.prfOutput,
    credentialId: enrollment.credentialId,
  };
}

export async function authenticateDemoPasskey(credentialId: string): Promise<Uint8Array> {
  if (!isPasskeySupported() || !isPrfExtensionSupported()) {
    throw new Error("Passkey PRF is not supported in this browser.");
  }

  const salt = await buildPrfSalt();
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: getRpId(),
      allowCredentials: [
        {
          id: toBufferSource(base64UrlToBytes(credentialId)),
          type: "public-key",
        },
      ],
      userVerification: "required",
      extensions: {
        prf: { eval: { first: salt } },
      },
    },
  });

  if (!(assertion instanceof PublicKeyCredential)) {
    throw new Error("Passkey authentication failed.");
  }

  const prfOutput = extractPasskeyPrfOutput(
    assertion.getClientExtensionResults() as Record<string, unknown>
  );
  if (!prfOutput) {
    throw new Error("Passkey PRF output was not returned.");
  }

  return prfOutput;
}
