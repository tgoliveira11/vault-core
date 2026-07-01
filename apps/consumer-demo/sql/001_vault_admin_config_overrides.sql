CREATE TABLE IF NOT EXISTS vault_admin_config_overrides (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
