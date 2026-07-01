"use client";

import { useCallback, useEffect, useState } from "react";
import { listVaultAdminConfigEntries } from "../../../admin/resolve-config.js";
import type { VaultAdminConfigEntry } from "../../../admin/types.js";
import {
  AdminBackLink,
  AdminHeader,
  AdminShell,
  SourceBadge,
  formatConfigValue,
  useVaultAdminPaths,
  type VaultAdminPageProps,
} from "../shared.js";

const EMPTY_ADMIN_OVERRIDES: Record<string, unknown> = {};

function parseEditValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  const trimmed = raw.trim();
  const asNumber = Number(trimmed);
  if (trimmed !== "" && Number.isFinite(asNumber) && String(asNumber) === trimmed) {
    return asNumber;
  }
  return raw;
}

export function VaultAdminConfigPage({
  config,
  paths,
  env = {},
  adminOverrides = EMPTY_ADMIN_OVERRIDES,
  configApiBase,
  LinkComponent,
}: VaultAdminPageProps) {
  const resolvedPaths = useVaultAdminPaths(config, paths);
  const [entries, setEntries] = useState<VaultAdminConfigEntry[]>(() =>
    listVaultAdminConfigEntries(config, env, adminOverrides)
  );
  const [isLoading, setIsLoading] = useState(Boolean(configApiBase));
  const [error, setError] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!configApiBase) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${configApiBase}/admin/config`);
      if (!response.ok) throw new Error("Failed to load config");
      const data = (await response.json()) as { entries?: VaultAdminConfigEntry[] };
      setEntries(
        data.entries ?? listVaultAdminConfigEntries(config, env, adminOverrides)
      );
    } catch {
      setError("Failed to load vault config overrides.");
    } finally {
      setIsLoading(false);
    }
  }, [configApiBase, config, env, adminOverrides]);

  useEffect(() => {
    if (configApiBase) void load();
  }, [configApiBase, load]);

  function startEdit(entry: VaultAdminConfigEntry) {
    setEditingKey(entry.key);
    setEditValue(formatConfigValue(entry.value));
  }

  async function saveEdit(key: string) {
    if (!configApiBase) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${configApiBase}/admin/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: parseEditValue(editValue) }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      setEditingKey(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function resetOverride(key: string) {
    if (!configApiBase) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${configApiBase}/admin/config`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!response.ok) throw new Error("Reset failed");
      await load();
    } catch {
      setError("Failed to reset override.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <AdminBackLink href={resolvedPaths.panel} LinkComponent={LinkComponent} />
      <AdminHeader
        title="Vault configuration"
        description={
          configApiBase
            ? "Effective settings with priority: admin → env → default. Editable keys persist in the consuming app database."
            : "Effective settings resolved from environment variables and crypto profile."
        }
      />

      {error ? <p className="vc-admin-alert vc-admin-alert--danger">{error}</p> : null}

      {isLoading ? (
        <p className="vc-admin-muted">Loading configuration…</p>
      ) : (
        <div className="vc-admin-card">
          <div className="vc-admin-table-wrap">
            <table className="vc-admin-table">
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Value</th>
                  <th>Source</th>
                  <th>Env var</th>
                  {configApiBase ? <th aria-label="Actions" /> : null}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.key}>
                    <td>
                      <strong>{entry.label}</strong>
                      <div className="vc-admin-card-desc">{entry.description}</div>
                    </td>
                    <td>
                      {configApiBase && editingKey === entry.key ? (
                        <input
                          className="vc-admin-input"
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void saveEdit(entry.key);
                            if (event.key === "Escape") setEditingKey(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <code>{formatConfigValue(entry.value)}</code>
                      )}
                    </td>
                    <td>
                      <SourceBadge source={entry.source} />
                    </td>
                    <td>{entry.envVar ? <code>{entry.envVar}</code> : "—"}</td>
                    {configApiBase ? (
                      <td className="vc-admin-actions">
                        {entry.overridable ? (
                          editingKey === entry.key ? (
                            <>
                              <button
                                type="button"
                                className="vc-admin-btn vc-admin-btn--primary"
                                disabled={saving}
                                onClick={() => saveEdit(entry.key)}
                              >
                                {saving ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                className="vc-admin-btn"
                                onClick={() => setEditingKey(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="vc-admin-btn"
                                onClick={() => startEdit(entry)}
                              >
                                Edit
                              </button>
                              {entry.source === "admin" ? (
                                <button
                                  type="button"
                                  className="vc-admin-btn vc-admin-btn--danger"
                                  disabled={saving}
                                  onClick={() => resetOverride(entry.key)}
                                >
                                  Reset
                                </button>
                              ) : null}
                            </>
                          )
                        ) : (
                          <span className="vc-admin-muted">read-only</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
