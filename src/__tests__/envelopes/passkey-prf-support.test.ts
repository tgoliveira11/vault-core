import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_APPLE_MOBILE_PRF_MIN_MAJOR_VERSION,
  isAppleMobileBelowPrfMinimum,
  isPrfExtensionSupported,
  parseAppleMobileOsMajorVersion,
  resolvePrfSupportUserAgent,
} from "../../envelopes/passkey-prf-support.js";

const IPHONE_17 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15";
const IPHONE_18 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
const IPAD_17 =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

class PrfCapablePublicKeyCredential {
  getClientExtensionResults() {}
}

describe("parseAppleMobileOsMajorVersion", () => {
  it("parses iOS major versions on Apple mobile UAs", () => {
    expect(parseAppleMobileOsMajorVersion(IPHONE_17)).toBe(17);
    expect(parseAppleMobileOsMajorVersion(IPHONE_18)).toBe(18);
    expect(parseAppleMobileOsMajorVersion(IPAD_17)).toBe(17);
    expect(parseAppleMobileOsMajorVersion(DESKTOP)).toBeNull();
    expect(parseAppleMobileOsMajorVersion("")).toBeNull();
    expect(parseAppleMobileOsMajorVersion("iPhone without version")).toBeNull();
  });
});

describe("isAppleMobileBelowPrfMinimum", () => {
  it("flags Apple mobile below the configured minimum", () => {
    expect(isAppleMobileBelowPrfMinimum(IPHONE_17)).toBe(true);
    expect(isAppleMobileBelowPrfMinimum(IPHONE_18)).toBe(false);
    expect(isAppleMobileBelowPrfMinimum(DESKTOP)).toBe(false);
    expect(isAppleMobileBelowPrfMinimum(IPHONE_17, 16)).toBe(false);
  });
});

describe("resolvePrfSupportUserAgent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers an explicit user agent override", () => {
    expect(resolvePrfSupportUserAgent("custom-agent")).toBe("custom-agent");
  });

  it("falls back to navigator.userAgent in browser environments", () => {
    vi.stubGlobal("navigator", { userAgent: "navigator-agent" });
    expect(resolvePrfSupportUserAgent()).toBe("navigator-agent");
  });

  it("returns an empty string when no user agent is available", () => {
    vi.stubGlobal("navigator", undefined);
    expect(resolvePrfSupportUserAgent()).toBe("");
  });
});

describe("isPrfExtensionSupported", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false on iOS below the minimum major version", () => {
    vi.stubGlobal("PublicKeyCredential", PrfCapablePublicKeyCredential);
    expect(isPrfExtensionSupported({ userAgent: IPHONE_17 })).toBe(false);
    expect(isPrfExtensionSupported({ userAgent: IPAD_17 })).toBe(false);
  });

  it("returns true on iOS at or above the minimum when WebAuthn PRF API exists", () => {
    vi.stubGlobal("PublicKeyCredential", PrfCapablePublicKeyCredential);
    expect(isPrfExtensionSupported({ userAgent: IPHONE_18 })).toBe(true);
    expect(isPrfExtensionSupported({ userAgent: DESKTOP })).toBe(true);
  });

  it("honors a custom minimum Apple mobile major version", () => {
    vi.stubGlobal("PublicKeyCredential", PrfCapablePublicKeyCredential);
    expect(
      isPrfExtensionSupported({ userAgent: IPHONE_17, minAppleMobileMajorVersion: 17 })
    ).toBe(true);
  });

  it("exports default minimum iOS major version 18", () => {
    expect(DEFAULT_APPLE_MOBILE_PRF_MIN_MAJOR_VERSION).toBe(18);
  });

  it("returns false when WebAuthn PRF APIs are unavailable", () => {
    vi.stubGlobal("PublicKeyCredential", undefined);
    expect(isPrfExtensionSupported({ userAgent: DESKTOP })).toBe(false);
  });

  it("returns false when getClientExtensionResults is missing", () => {
    class WithoutPrf {}
    vi.stubGlobal("PublicKeyCredential", WithoutPrf);
    expect(isPrfExtensionSupported({ userAgent: DESKTOP })).toBe(false);
  });
});
