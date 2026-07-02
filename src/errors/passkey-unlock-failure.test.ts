import { describe, expect, it } from "vitest";
import {
  PasskeyPrfRequiredError,
  PasskeyUnlockError,
  VaultRateLimitError,
} from "./vault-errors.js";
import {
  classifyPasskeyUnlockFailure,
  shouldRedirectPasskeyUnlockFailureByDefault,
} from "./passkey-unlock-failure.js";

describe("classifyPasskeyUnlockFailure", () => {
  it("classifies NotAllowedError as user_cancelled", () => {
    expect(
      classifyPasskeyUnlockFailure(new DOMException("cancelled", "NotAllowedError"))
    ).toBe("user_cancelled");
  });

  it("classifies AbortError as user_cancelled", () => {
    expect(classifyPasskeyUnlockFailure(new DOMException("aborted", "AbortError"))).toBe(
      "user_cancelled"
    );
  });

  it("classifies cancellation messages as user_cancelled", () => {
    expect(classifyPasskeyUnlockFailure(new Error("Passkey unlock was cancelled"))).toBe(
      "user_cancelled"
    );
    expect(classifyPasskeyUnlockFailure(new Error("User canceled the request"))).toBe(
      "user_cancelled"
    );
  });

  it("classifies PRF and envelope errors as redirect_to_full_unlock", () => {
    expect(
      classifyPasskeyUnlockFailure(
        new PasskeyPrfRequiredError("This passkey requires browser PRF support")
      )
    ).toBe("redirect_to_full_unlock");
    expect(
      classifyPasskeyUnlockFailure(
        new PasskeyUnlockError("Could not decrypt your vault with this passkey")
      )
    ).toBe("redirect_to_full_unlock");
    expect(classifyPasskeyUnlockFailure(new Error("PRF unavailable in this browser"))).toBe(
      "redirect_to_full_unlock"
    );
    expect(classifyPasskeyUnlockFailure(new Error("Invalid envelope"))).toBe(
      "redirect_to_full_unlock"
    );
    expect(classifyPasskeyUnlockFailure(new Error("No passkey credential is linked"))).toBe(
      "redirect_to_full_unlock"
    );
    expect(classifyPasskeyUnlockFailure(new Error("Decrypt failed"))).toBe(
      "redirect_to_full_unlock"
    );
    expect(classifyPasskeyUnlockFailure(new Error("Challenge expired"))).toBe(
      "redirect_to_full_unlock"
    );
    expect(classifyPasskeyUnlockFailure(new Error("Server verify failed"))).toBe(
      "redirect_to_full_unlock"
    );
  });

  it("classifies rate limit as recoverable", () => {
    expect(
      classifyPasskeyUnlockFailure(new VaultRateLimitError("Too many attempts", 1000, 2000))
    ).toBe("recoverable");
  });

  it("defaults unknown errors to recoverable", () => {
    expect(classifyPasskeyUnlockFailure(new Error("network timeout"))).toBe("recoverable");
  });

  it("classifies string cancellation messages", () => {
    expect(classifyPasskeyUnlockFailure("Passkey unlock was cancelled")).toBe("user_cancelled");
  });
});

describe("shouldRedirectPasskeyUnlockFailureByDefault", () => {
  it("redirects only fatal passkey failures by default", () => {
    expect(shouldRedirectPasskeyUnlockFailureByDefault("redirect_to_full_unlock")).toBe(true);
    expect(shouldRedirectPasskeyUnlockFailureByDefault("user_cancelled")).toBe(false);
    expect(shouldRedirectPasskeyUnlockFailureByDefault("recoverable")).toBe(false);
  });
});
