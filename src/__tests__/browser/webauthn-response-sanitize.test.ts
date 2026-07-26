import { describe, expect, it } from "vitest";
import { sanitizeWebAuthnResponseForServer } from "../../browser/webauthn-response-sanitize.js";

const PRF_SENTINEL = "PRF_OUTPUT_MUST_STAY_IN_BROWSER";

function responseWithPrf(first: unknown) {
  return {
    id: "credential-1",
    type: "public-key" as const,
    response: { clientDataJSON: "client-data" },
    clientExtensionResults: {
      prf: {
        results: { first },
        evalByCredential: {
          "credential-1": { first },
        },
      },
      credProps: { rk: true },
    },
  };
}

describe("sanitizeWebAuthnResponseForServer", () => {
  it.each([
    PRF_SENTINEL,
    Array.from(new TextEncoder().encode(PRF_SENTINEL)),
    new TextEncoder().encode(PRF_SENTINEL),
    new TextEncoder().encode(PRF_SENTINEL).buffer,
  ])("removes every PRF result representation before serialization", (first) => {
    const original = responseWithPrf(first);
    const sanitized = sanitizeWebAuthnResponseForServer(original);

    expect(sanitized).not.toBe(original);
    expect(sanitized.clientExtensionResults).toEqual({ credProps: { rk: true } });
    expect("prf" in sanitized.clientExtensionResults).toBe(false);
    expect(JSON.stringify(sanitized)).not.toContain(PRF_SENTINEL);
    expect(original.clientExtensionResults.prf).toBeDefined();
  });

  it.each([undefined, null, "invalid", []])(
    "normalizes non-record extension results to an empty object",
    (clientExtensionResults) => {
      const sanitized = sanitizeWebAuthnResponseForServer({
        id: "credential-1",
        clientExtensionResults,
      });
      expect(sanitized.clientExtensionResults).toEqual({});
    }
  );

  it.each([null, "invalid", []])("rejects a non-object WebAuthn response", (response) => {
    expect(() =>
      sanitizeWebAuthnResponseForServer(
        response as unknown as { clientExtensionResults?: unknown }
      )
    ).toThrow("WebAuthn response must be an object");
  });
});
