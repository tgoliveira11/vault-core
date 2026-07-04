import { base64UrlToBytes } from "../crypto/encoding.js";

export type WebAuthnPrfSaltInput = unknown;

export type WebAuthnPrfEvalInput = {
  first?: WebAuthnPrfSaltInput;
  second?: WebAuthnPrfSaltInput;
};

export type WebAuthnPrfExtensionInput = {
  eval?: WebAuthnPrfEvalInput;
  evalByCredential?: Record<string, WebAuthnPrfEvalInput>;
};

export type WebAuthnExtensionsInput = {
  prf?: WebAuthnPrfExtensionInput;
  [key: string]: unknown;
};

export type PublicKeyCredentialRequestOptionsInput = {
  allowCredentials?: Array<{
    id: string;
    type: "public-key";
    transports?: AuthenticatorTransport[];
  }>;
  extensions?: WebAuthnExtensionsInput;
  [key: string]: unknown;
};

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function coercePrfSaltToArrayBuffer(value: WebAuthnPrfSaltInput): ArrayBuffer | WebAuthnPrfSaltInput {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    return bytesToArrayBuffer(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }

  if (typeof value === "string") {
    try {
      return bytesToArrayBuffer(base64UrlToBytes(value));
    } catch {
      return value;
    }
  }

  if (Array.isArray(value) && value.every((entry) => typeof entry === "number")) {
    return bytesToArrayBuffer(new Uint8Array(value));
  }

  return value;
}

function preparePrfEval(evalInput?: WebAuthnPrfEvalInput): WebAuthnPrfEvalInput | undefined {
  if (!evalInput) {
    return undefined;
  }

  const prepared: WebAuthnPrfEvalInput = {};

  for (const key of ["first", "second"] as const) {
    if (evalInput[key] === undefined) {
      continue;
    }
    const coerced = coercePrfSaltToArrayBuffer(evalInput[key]);
    if (coerced instanceof ArrayBuffer) {
      prepared[key] = coerced;
    }
  }

  return Object.keys(prepared).length > 0 ? prepared : undefined;
}

/**
 * Converts JSON-serializable PRF salts (base64url strings, number arrays) to ArrayBuffer
 * for `navigator.credentials.get` / `create`.
 */
export function prepareWebAuthnPrfExtensions<T extends { prf?: WebAuthnPrfExtensionInput }>(
  extensions: T
): T {
  if (!extensions.prf) {
    return extensions;
  }

  const prf = extensions.prf;
  const preparedEval = prf.eval ? preparePrfEval(prf.eval) : undefined;
  const evalByCredential = prf.evalByCredential
    ? Object.fromEntries(
        Object.entries(prf.evalByCredential)
          .map(([credentialId, evalInput]) => [credentialId, preparePrfEval(evalInput)])
          .filter((entry): entry is [string, WebAuthnPrfEvalInput] => entry[1] !== undefined)
      )
    : undefined;
  const { eval: _eval, evalByCredential: _evalByCredential, ...prfRest } = prf;

  return {
    ...extensions,
    prf: {
      ...prfRest,
      ...(preparedEval ? { eval: preparedEval } : {}),
      ...(evalByCredential && Object.keys(evalByCredential).length > 0
        ? { evalByCredential }
        : {}),
    },
  };
}

function resolveSingleCredentialId(
  options: PublicKeyCredentialRequestOptionsInput,
  credentialId?: string
): string | undefined {
  if (credentialId) {
    return credentialId;
  }

  if (options.allowCredentials?.length === 1) {
    return options.allowCredentials[0]?.id;
  }

  return undefined;
}

/**
 * When a PRF authentication ceremony uses a single allowCredential, iOS requires `prf.eval`
 * instead of `prf.evalByCredential` for parity with registration ceremonies.
 */
export function alignPrfExtensionsForCredential<T extends PublicKeyCredentialRequestOptionsInput>(
  options: T,
  credentialId?: string
): T {
  const prf = options.extensions?.prf;
  if (!prf?.evalByCredential) {
    return options;
  }

  const singleCredentialId = resolveSingleCredentialId(options, credentialId);
  if (!singleCredentialId) {
    return options;
  }

  const evalInput =
    prf.evalByCredential[singleCredentialId] ??
    (Object.keys(prf.evalByCredential).length === 1
      ? Object.values(prf.evalByCredential)[0]
      : undefined);

  if (!evalInput?.first) {
    return options;
  }

  const { evalByCredential: _removed, ...prfWithoutMap } = prf;

  return {
    ...options,
    extensions: {
      ...options.extensions,
      prf: {
        ...prfWithoutMap,
        eval: preparePrfEval(evalInput),
      },
    },
  };
}
