import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  VAULT_ADMIN_CONFIG_OVERRIDES_TABLE,
  getVaultAdminConfigOverrideSchemaSql,
} from "./persistence-schema.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("getVaultAdminConfigOverrideSchemaSql", () => {
  it("returns PostgreSQL DDL with default table name", () => {
    const sql = getVaultAdminConfigOverrideSchemaSql();
    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${VAULT_ADMIN_CONFIG_OVERRIDES_TABLE}`);
    expect(sql).toContain("key TEXT PRIMARY KEY");
    expect(sql).toContain("value JSONB NOT NULL");
    expect(sql).toContain("updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  });

  it("supports custom table name and strict create", () => {
    const sql = getVaultAdminConfigOverrideSchemaSql({
      ifNotExists: false,
      tableName: "app_vault_admin_overrides",
    });
    expect(sql).toMatch(/^CREATE TABLE app_vault_admin_overrides \(/);
    expect(sql).not.toContain("IF NOT EXISTS");
  });

  it("matches the checked-in reference SQL file", () => {
    const fromHelper = getVaultAdminConfigOverrideSchemaSql().trim();
    const fromFile = readFileSync(
      join(repoRoot, "docs/schemas/vault_admin_config_overrides.sql"),
      "utf8"
    )
      .replace(/^--.*\n/gm, "")
      .trim();
    expect(fromHelper).toBe(fromFile);
  });
});
