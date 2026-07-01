"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  database: { ok: boolean; latencyMs: number; error?: string };
};

export function DatabaseStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/health")
      .then((res) => res.json())
      .then((data: HealthResponse) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) {
          setHealth({
            status: "error",
            database: { ok: false, latencyMs: 0, error: "Health request failed" },
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="vc-admin-card-desc mt-2">Checking PostgreSQL…</p>;
  }

  const db = health?.database;
  return (
    <div className="mt-2">
      <p className="text-lg font-semibold">
        {db?.ok ? (
          <span style={{ color: "var(--success)" }}>Connected</span>
        ) : (
          <span style={{ color: "var(--warning)" }}>Unavailable</span>
        )}
        {db?.ok ? (
          <span className="ml-2 text-sm font-normal text-[var(--muted)]">
            ({db.latencyMs} ms)
          </span>
        ) : null}
      </p>
      {db?.error ? (
        <p className="vc-admin-card-desc mt-2">
          {db.error}. Run <code>npm run db:up</code> and set <code>DATABASE_URL</code> in{" "}
          <code>.env.local</code>.
        </p>
      ) : (
        <p className="vc-admin-card-desc mt-2">
          Docker Postgres on host port <code>5437</code> — ready for future vault persistence.
        </p>
      )}
    </div>
  );
}
