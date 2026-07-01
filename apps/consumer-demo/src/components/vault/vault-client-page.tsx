"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useVaultSession } from "@tgoliveira/vault-core/react";
import { AppShell } from "@/components/app-shell";
import { VaultUnlockedGate } from "@/components/vault/vault-unlocked-gate";
import {
  loadDecryptedDemoPayload,
  saveDemoPayload,
  type DemoVaultPayload,
} from "@/lib/vault-demo-crypto";

export function VaultClientPage() {
  return (
    <VaultUnlockedGate>
      <VaultClientContent />
    </VaultUnlockedGate>
  );
}

function VaultClientContent() {
  const { lock } = useVaultSession({
    registerActivityGuard: false,
    registerUnloadGuard: false,
  });
  const [payload, setPayload] = useState<DemoVaultPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const decrypted = await loadDecryptedDemoPayload();
      setPayload(decrypted);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load vault data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAddNote(event: React.FormEvent) {
    event.preventDefault();
    if (!payload) return;
    setSaving(true);
    setError("");
    try {
      const next: DemoVaultPayload = {
        ...payload,
        notes: [
          {
            id: crypto.randomUUID(),
            title: title.trim(),
            body: body.trim(),
            createdAt: new Date().toISOString(),
          },
          ...payload.notes,
        ],
      };
      await saveDemoPayload(next);
      setPayload(next);
      setTitle("");
      setBody("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="My vault"
      description="Client-only encrypted notes demo. This page is reachable only while the vault session is unlocked."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => lock()}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--card-muted)]"
        >
          Lock vault
        </button>
        <Link
          href="/vault/settings"
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--card-muted)]"
        >
          Vault security
        </Link>
        <Link
          href="/vault/unlock?next=/vault"
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--card-muted)]"
        >
          Unlock again
        </Link>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Decrypting vault payload…</p>
      ) : (
        <div className="grid gap-4">
          <form onSubmit={handleAddNote} className="vc-admin-card space-y-3">
            <h2 className="vc-admin-card-title">Add encrypted note</h2>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Title</span>
              <input
                className="vc-admin-input w-full"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Body</span>
              <textarea
                className="vc-admin-input min-h-24 w-full"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Encrypting…" : "Save note"}
            </button>
          </form>

          <section className="vc-admin-card">
            <h2 className="vc-admin-card-title">Notes ({payload?.notes.length ?? 0})</h2>
            {payload?.notes.length ? (
              <ul className="mt-3 space-y-3">
                {payload.notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-md border border-[var(--border)] bg-[var(--card-muted)] p-3"
                  >
                    <p className="font-medium">{note.title}</p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{note.body}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">No notes yet.</p>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
