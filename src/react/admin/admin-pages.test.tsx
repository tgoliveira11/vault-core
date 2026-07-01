/** @vitest-environment jsdom */
import type React from "react";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("loads and edits config via API when configApiBase is set", async () => {
    const entries = [
      {
        key: "basePath",
        envVar: "VAULT_ADMIN_PATH",
        label: "Admin base path",
        description: "Mount path for vault admin pages.",
        group: "admin" as const,
        value: "/admin/vault",
        source: "default" as const,
        overridable: true,
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/admin/config") && (!init || init.method === "GET")) {
        return new Response(JSON.stringify({ entries }), { status: 200 });
      }
      if (url.endsWith("/admin/config") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            entries: [{ ...entries[0], value: "/ops/vault", source: "admin" }],
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <VaultAdminConfigPage
        config={config}
        env={{}}
        configApiBase="/api/vault"
      />
    );

    await waitFor(() => {
      expect(screen.queryByText("Loading configuration…")).toBeNull();
      expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByDisplayValue("/admin/vault"), { target: { value: "/ops/vault" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/vault/admin/config",
        expect.objectContaining({ method: "POST" })
      );
    });

    vi.unstubAllGlobals();
  });

  it("handles reset, cancel, and save errors", async () => {
    const adminEntry = {
      key: "passwordMinLength",
      envVar: "VAULT_PASSWORD_MIN_LENGTH",
      label: "Password min length",
      description: "Minimum vault password length.",
      group: "password_policy" as const,
      value: 20,
      source: "admin" as const,
      overridable: true,
    };
    const entries = [
      adminEntry,
      {
        key: "encryptionAlgorithm",
        label: "Encryption algorithm",
        description: "Symmetric encryption algorithm for vault payloads.",
        group: "crypto_profile" as const,
        value: "AES-256-GCM",
        source: "default" as const,
        overridable: false,
      },
    ];

    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ error: "invalid" }), { status: 422 });
      }
      if (init?.method === "DELETE") {
        return new Response(
          JSON.stringify({ entries: [{ ...adminEntry, source: "default", value: 12 }] }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ entries }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<VaultAdminConfigPage config={config} env={{}} configApiBase="/api/vault" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    });

    expect(screen.getByText("read-only")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByDisplayValue("20"), { target: { value: "22" } });
    fireEvent.keyDown(screen.getByDisplayValue("22"), { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByDisplayValue("20"), { target: { value: "22" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByDisplayValue("20"), { target: { value: "22" } });
    fireEvent.keyDown(screen.getByDisplayValue("22"), { key: "Enter" });
    await waitFor(() => {
      expect(screen.getByText("invalid")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/vault/admin/config",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    vi.unstubAllGlobals();
  });

  it("shows load error when config API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    );

    render(<VaultAdminConfigPage config={config} env={{}} configApiBase="/api/vault" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load vault config overrides/i)).toBeTruthy();
    });

    vi.unstubAllGlobals();
  });

  it("shows reset error when delete fails", async () => {
    const entries = [
      {
        key: "basePath",
        envVar: "VAULT_ADMIN_PATH",
        label: "Admin base path",
        description: "Mount path for vault admin pages.",
        group: "admin" as const,
        value: "/custom",
        source: "admin" as const,
        overridable: true,
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          return new Response("", { status: 500 });
        }
        return new Response(JSON.stringify({ entries }), { status: 200 });
      })
    );

    render(<VaultAdminConfigPage config={config} env={{}} configApiBase="/api/vault" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to reset override/i)).toBeTruthy();
    });

    vi.unstubAllGlobals();
  });

  it("falls back to static entries when API omits entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
    );

    render(<VaultAdminConfigPage config={config} env={{}} configApiBase="/api/vault" />);

    await waitFor(() => {
      expect(screen.getByText("VAULT_ADMIN_ENABLED")).toBeTruthy();
    });

    vi.unstubAllGlobals();
  });

  it("shows generic save failure messages", async () => {
    const entries = [
      {
        key: "enabled",
        envVar: "VAULT_ADMIN_ENABLED",
        label: "Vault admin enabled",
        description: "Whether vault admin routes are enabled.",
        group: "admin" as const,
        value: false,
        source: "default" as const,
        overridable: true,
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
        if (init?.method === "POST") {
          throw "save exploded";
        }
        return new Response(JSON.stringify({ entries }), { status: 200 });
      })
    );

    render(<VaultAdminConfigPage config={config} env={{}} configApiBase="/api/vault" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByDisplayValue("false"), { target: { value: "true" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to save.")).toBeTruthy();
    });

    vi.unstubAllGlobals();
  });

  it("shows save failed when API returns no error body", async () => {
    const entries = [
      {
        key: "enabled",
        envVar: "VAULT_ADMIN_ENABLED",
        label: "Vault admin enabled",
        description: "Whether vault admin routes are enabled.",
        group: "admin" as const,
        value: false,
        source: "default" as const,
        overridable: true,
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
        if (init?.method === "POST") {
          return new Response("not-json", { status: 500 });
        }
        return new Response(JSON.stringify({ entries }), { status: 200 });
      })
    );

    render(<VaultAdminConfigPage config={config} env={{}} configApiBase="/api/vault" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByDisplayValue("false"), { target: { value: "true" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeTruthy();
    });

    vi.unstubAllGlobals();
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
        <SourceBadge source="admin" />
        <SourceBadge source="default" />
      </AdminShell>
    );
    expect(screen.getByText("Narrow")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back/ })).toBeTruthy();
    expect(screen.getByText("profile")).toBeTruthy();
  });
});
