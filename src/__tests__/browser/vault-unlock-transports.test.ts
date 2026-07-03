import { describe, expect, it } from "vitest";
import {
  isAppleMobileUserAgent,
  preferPlatformTransportsForVaultUnlock,
  resolveVaultUnlockUserAgent,
} from "../../browser/vault-unlock-transports.js";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

describe("preferPlatformTransportsForVaultUnlock", () => {
  it("pins internal transport on Apple mobile user agents", () => {
    const options = {
      allowCredentials: [
        { id: "cred-1", type: "public-key" as const, transports: ["hybrid", "internal"] as const },
      ],
    };

    const prepared = preferPlatformTransportsForVaultUnlock(options, IPHONE_UA);
    expect(prepared.allowCredentials?.[0]?.transports).toEqual(["internal"]);
  });

  it("does not change transports on desktop user agents", () => {
    const options = {
      allowCredentials: [
        { id: "cred-1", type: "public-key" as const, transports: ["hybrid", "internal"] as const },
      ],
    };

    const prepared = preferPlatformTransportsForVaultUnlock(options, DESKTOP_UA);
    expect(prepared.allowCredentials?.[0]?.transports).toEqual(["hybrid", "internal"]);
  });

  it("resolveVaultUnlockUserAgent prefers explicit userAgent", () => {
    expect(resolveVaultUnlockUserAgent("custom-ua")).toBe("custom-ua");
  });

  it("resolveVaultUnlockUserAgent falls back to navigator.userAgent", () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { userAgent: IPHONE_UA },
    });
    try {
      expect(resolveVaultUnlockUserAgent()).toBe(IPHONE_UA);
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: originalNavigator,
      });
    }
  });

  it("resolveVaultUnlockUserAgent returns empty string without navigator", () => {
    const originalNavigator = globalThis.navigator;
    // @ts-expect-error test override
    delete globalThis.navigator;
    try {
      expect(resolveVaultUnlockUserAgent()).toBe("");
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: originalNavigator,
      });
    }
  });

  it("returns options unchanged when allowCredentials is empty", () => {
    const options = { allowCredentials: [] as const };
    expect(preferPlatformTransportsForVaultUnlock(options, IPHONE_UA)).toBe(options);
  });
});

describe("isAppleMobileUserAgent", () => {
  it("detects iPhone and iPad", () => {
    expect(isAppleMobileUserAgent(IPHONE_UA)).toBe(true);
    expect(isAppleMobileUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(true);
    expect(isAppleMobileUserAgent(DESKTOP_UA)).toBe(false);
  });
});
