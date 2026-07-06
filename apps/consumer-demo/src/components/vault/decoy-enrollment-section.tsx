"use client";

import { useState } from "react";
import { containsDuressSequence } from "@tgoliveira/vault-core";
import { enrollDemoDecoyVault } from "@/lib/vault-demo-crypto";
import { buildHoneyPayloadFromTemplates } from "@/lib/vault-demo-honey-templates";
import {
  loadDemoEmergencyMetadata,
  saveDemoEmergencyMetadata,
} from "@/lib/vault-demo-emergency-store";

export function DecoyEnrollmentSection({
  busy,
  onComplete,
}: {
  busy: boolean;
  onComplete: () => void;
}) {
  const meta = loadDemoEmergencyMetadata();
  const [duressSequence, setDuressSequence] = useState(meta.duressSequence ?? "");
  const [duressPassword, setDuressPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requireEmailOtp, setRequireEmailOtp] = useState(
    meta.emergencyExitEmailRequired ?? false
  );
  const [error, setError] = useState("");

  async function handleEnroll() {
    setError("");
    if (!duressSequence.trim()) {
      setError("Choose a duress sequence.");
      return;
    }
    if (duressPassword !== confirmPassword) {
      setError("Duress passwords do not match.");
      return;
    }
    if (!containsDuressSequence(duressPassword, duressSequence)) {
      setError("Duress password must contain the configured sequence.");
      return;
    }

    try {
      await enrollDemoDecoyVault({
        duressSequence: duressSequence.trim(),
        duressPassword,
        honeyPayload: buildHoneyPayloadFromTemplates(),
      });
      saveDemoEmergencyMetadata({
        ...loadDemoEmergencyMetadata(),
        decoyConfigured: true,
        duressSequence: duressSequence.trim(),
        emergencyExitEmailRequired: requireEmailOtp,
      });
      setDuressPassword("");
      setConfirmPassword("");
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enrollment failed.");
    }
  }

  return (
    <section className="vc-admin-card space-y-3">
      <h2 className="vc-admin-card-title">Emergency / decoy vault</h2>
      <p className="vc-admin-card-desc">
        Configure a decoy vault with honey content. Unlock with a password containing your
        duress sequence, or long-press (≥ 1 s) the passkey button or dock handle during passkey
        unlock.
      </p>

      {meta.decoyConfigured ? (
        <p className="text-sm text-green-700">Decoy vault is configured.</p>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Duress sequence</span>
        <input
          className="vc-admin-input w-full"
          value={duressSequence}
          onChange={(event) => setDuressSequence(event.target.value)}
          placeholder="e.g. 911"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Duress password (must contain sequence)</span>
        <input
          type="password"
          className="vc-admin-input w-full"
          value={duressPassword}
          onChange={(event) => setDuressPassword(event.target.value)}
          autoComplete="new-password"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Confirm duress password</span>
        <input
          type="password"
          className="vc-admin-input w-full"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={requireEmailOtp}
          onChange={(event) => setRequireEmailOtp(event.target.checked)}
        />
        Require email OTP to exit emergency mode (demo OTP: 123456)
      </label>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        onClick={() => void handleEnroll()}
      >
        {meta.decoyConfigured ? "Update decoy vault" : "Set up decoy vault"}
      </button>

      {meta.decoyConfigured ? (
        <p className="text-sm">
          <a href="/vault/emergency-exit" className="text-[var(--primary)] hover:underline">
            Exit emergency mode
          </a>{" "}
          (requires primary recovery phrase)
        </p>
      ) : null}
    </section>
  );
}
