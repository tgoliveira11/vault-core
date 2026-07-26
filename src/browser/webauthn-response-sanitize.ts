export type WebAuthnResponseWithClientExtensionResults = {
  clientExtensionResults?: unknown;
};

export type WebAuthnResponseWithoutPrfResults<
  T extends WebAuthnResponseWithClientExtensionResults,
> = Omit<T, "clientExtensionResults"> & {
  clientExtensionResults: Record<string, unknown>;
};

/**
 * Returns a non-mutating copy of a WebAuthn registration/authentication JSON response with the
 * complete PRF extension result removed. Call this before serializing a response for a server;
 * raw PRF output and hashes must remain browser-only.
 *
 * Other client extension results are preserved because an application verification stack may use
 * them. Consumers that do not verify any client extensions may replace the result with an empty
 * `clientExtensionResults` object at their API boundary.
 */
export function sanitizeWebAuthnResponseForServer<
  T extends WebAuthnResponseWithClientExtensionResults,
>(response: T): WebAuthnResponseWithoutPrfResults<T> {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new TypeError("WebAuthn response must be an object");
  }

  const extensionResults = response.clientExtensionResults;
  const sanitizedExtensionResults =
    extensionResults && typeof extensionResults === "object" && !Array.isArray(extensionResults)
      ? Object.fromEntries(
          Object.entries(extensionResults as Record<string, unknown>).filter(
            ([key]) => key !== "prf"
          )
        )
      : {};

  return {
    ...response,
    clientExtensionResults: sanitizedExtensionResults,
  } as WebAuthnResponseWithoutPrfResults<T>;
}
