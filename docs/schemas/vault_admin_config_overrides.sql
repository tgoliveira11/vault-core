-- Reference schema for runtime vault admin config overrides (PostgreSQL).
-- Canonical copy for migration tools; programmatic access:
--   getVaultAdminConfigOverrideSchemaSql() from @tgoliveira/vault-core
--
-- Consuming apps implement GET/POST/DELETE {configApiBase}/admin/config and persist rows here.
-- See docs/VAULT_ADMIN.md

CREATE TABLE IF NOT EXISTS vault_admin_config_overrides (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
