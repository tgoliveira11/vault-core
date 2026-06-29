/** @vitest-environment jsdom */
import type React from "react";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildVaultAdminConfigFromEnv } from "../../admin/resolve-config.js";
import {
  VaultAdminPanelPage,
  VaultAdminConfigPage,
  VaultAdminCryptoPolicyPage,
  VaultAdminEnvTemplatePage,
  VaultAdminProfilePage,
  VaultAdminSessionPage,
  VaultAdminPasswordPolicyPage,
  VaultAdminSecurityPage,
  AdminLink,
  AdminShell,
  AdminHeader,
  AdminBackLink,
  SourceBadge,
  formatConfigValue,
  useVaultAdminPaths,
} from "./index.js";

const config = buildVaultAdminConfigFromEnv({
  productName: "Test App",
  env: { VAULT_ADMIN_ENABLED: "true" },
  profile: {
    cryptoVersion: "vault-v1",
    aadContextVault: "test:vault:v1",
    aadContextEnvelope: "test:envelope:v1",
  },
});

describe("vault admin pages", () => {
  afterEach(() => cleanup());

  it("renders panel hub with sections", () => {
    render(<VaultAdminPanelPage config={config} />);
    expect(screen.getByRole("heading", { name: "Vault Admin" })).toBeTruthy();
    expect(screen.getByText("Configuration")).toBeTruthy();
    expect(screen.getByText("Crypto policy")).toBeTruthy();
  });

  it("renders config table", () => {
    render(<VaultAdminConfigPage config={config} env={{ VAULT_ADMIN_ENABLED: "true" }} />);
    expect(screen.getByRole("heading", { name: "Vault configuration" })).toBeTruthy();
    expect(screen.getByText("VAULT_ADMIN_ENABLED")).toBeTruthy();
  });

  it("renders crypto policy", () => {
    render(<VaultAdminCryptoPolicyPage config={config} />);
    expect(screen.getByRole("heading", { name: "Crypto policy" })).toBeTruthy();
    expect(screen.getAllByText(/kdf-v2/).length).toBeGreaterThan(0);
  });

  it("renders env template", () => {
    render(<VaultAdminEnvTemplatePage config={config} />);
    expect(screen.getByText(/VAULT_ADMIN_ENABLED=true/)).toBeTruthy();
  });

  it("renders remaining admin pages", () => {
    render(<VaultAdminProfilePage config={config} />);
    expect(screen.getByText("test:vault:v1")).toBeTruthy();

    cleanup();
    render(<VaultAdminSessionPage config={config} />);
    expect(screen.getByText(/15 minutes/)).toBeTruthy();

    cleanup();
    render(<VaultAdminPasswordPolicyPage config={config} />);
    expect(screen.getByText("VAULT_PASSWORD_MIN_LENGTH")).toBeTruthy();

    cleanup();
    render(<VaultAdminSecurityPage config={config} />);
    expect(screen.getByText(/zero-knowledge/i)).toBeTruthy();
  });

  it("shows disabled banner when admin is off", () => {
    const disabled = buildVaultAdminConfigFromEnv({ productName: "Off App" });
    render(<VaultAdminPanelPage config={disabled} />);
    expect(screen.getByText(/Vault admin is disabled/)).toBeTruthy();
  });

  it("uses custom paths and link component", () => {
    const paths = {
      panel: "/ops/vault",
      config: "/ops/vault/config",
      cryptoPolicy: "/ops/vault/crypto-policy",
      profile: "/ops/vault/profile",
      session: "/ops/vault/session",
      passwordPolicy: "/ops/vault/password-policy",
      security: "/ops/vault/security",
      envTemplate: "/ops/vault/env-template",
    };
    function CustomLink({
      href,
      className,
      children,
    }: {
      href: string;
      className?: string;
      children: React.ReactNode;
    }) {
      return (
        <a href={href} className={className} data-testid="custom-link">
          {children}
        </a>
      );
    }

    render(<VaultAdminPanelPage config={config} paths={paths} LinkComponent={CustomLink} />);
    expect(screen.getAllByTestId("custom-link")[0]?.getAttribute("href")).toBe("/ops/vault/config");

    cleanup();
    const { result } = renderHook(() => useVaultAdminPaths(config, paths));
    expect(result.current.session).toBe("/ops/vault/session");

    cleanup();
    render(
      <AdminLink href="/x" LinkComponent={CustomLink} className="link">
        go
      </AdminLink>
    );
    expect(screen.getByRole("link", { name: "go" }).getAttribute("href")).toBe("/x");
  });

  it("covers shared helpers and layout variants", () => {
    expect(formatConfigValue(false)).toBe("false");
    expect(formatConfigValue(true)).toBe("true");

    render(
      <AdminShell narrow>
        <AdminHeader title="Narrow" />
        <AdminBackLink href="/admin/vault" label="Back" />
        <SourceBadge source="profile" />
        <SourceBadge source="default" />
      </AdminShell>
    );
    expect(screen.getByText("Narrow")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back/ })).toBeTruthy();
    expect(screen.getByText("profile")).toBeTruthy();
  });
});
