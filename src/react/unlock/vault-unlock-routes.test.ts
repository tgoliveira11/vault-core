import { describe, expect, it } from "vitest";
import {
  VAULT_UNLOCK_RETURN_QUERY_PARAM,
  buildVaultUnlockHref,
  readVaultUnlockReturnPath,
  resolveVaultUnlockReturnPath,
} from "./vault-unlock-routes.js";

describe("resolveVaultUnlockReturnPath", () => {
  it("returns default when value is missing", () => {
    expect(resolveVaultUnlockReturnPath(null)).toBe("/");
    expect(resolveVaultUnlockReturnPath(undefined, { defaultPath: "/vault" })).toBe("/vault");
  });

  it("accepts safe relative paths", () => {
    expect(resolveVaultUnlockReturnPath("/vault")).toBe("/vault");
    expect(resolveVaultUnlockReturnPath("/vault/settings?tab=security")).toBe(
      "/vault/settings?tab=security"
    );
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(resolveVaultUnlockReturnPath("//evil.example")).toBe("/");
    expect(resolveVaultUnlockReturnPath("https://evil.example")).toBe("/");
  });

  it("rejects encoded protocol-relative bypasses", () => {
    expect(resolveVaultUnlockReturnPath("/%2F%2Fevil.example")).toBe("/");
    expect(resolveVaultUnlockReturnPath("%2F%2Fevil.example")).toBe("/");
    expect(resolveVaultUnlockReturnPath("/%2f%2fevil.example")).toBe("/");
  });

  it("rejects backslashes and scheme-like paths", () => {
    expect(resolveVaultUnlockReturnPath("/\\evil.example")).toBe("/");
    expect(resolveVaultUnlockReturnPath("/https:evil")).toBe("/");
  });
});

describe("readVaultUnlockReturnPath", () => {
  it("reads the default next param", () => {
    const params = new URLSearchParams({ [VAULT_UNLOCK_RETURN_QUERY_PARAM]: "/notes" });
    expect(readVaultUnlockReturnPath(params)).toBe("/notes");
  });

  it("supports custom param names", () => {
    const params = new URLSearchParams({ returnTo: "/dashboard" });
    expect(readVaultUnlockReturnPath(params, { paramName: "returnTo" })).toBe("/dashboard");
  });
});

describe("buildVaultUnlockHref", () => {
  it("appends the return path query param", () => {
    expect(buildVaultUnlockHref("/vault/unlock", "/vault")).toBe("/vault/unlock?next=%2Fvault");
  });

  it("sanitizes unsafe return paths in hrefs", () => {
    expect(buildVaultUnlockHref("/vault/unlock", "//evil.example")).toBe("/vault/unlock?next=%2F");
  });

  it("appends with & when unlock path already has search", () => {
    expect(buildVaultUnlockHref("/vault/unlock?foo=1", "/vault")).toBe(
      "/vault/unlock?foo=1&next=%2Fvault"
    );
  });
});
