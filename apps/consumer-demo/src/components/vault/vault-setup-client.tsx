"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { VaultAdminPasswordPolicy } from "@tgoliveira/vault-core";
import {
  assertRecoveryPhraseWordConfirmation,
  getRecoveryConfirmationPromptCount,
  pickRecoveryConfirmationIndices,
  validateVaultPasswordSetup,
} from "@tgoliveira/vault-core";
import { VaultPasswordSetupFields } from "@tgoliveira/vault-core/react";
import { AppShell } from "@/components/app-shell";
import { createDemoVault } from "@/lib/vault-demo-crypto";
import { isVaultConfigured } from "@/lib/vault-demo-store";

type Step = "password" | "recovery" | "confirm" | "creating";

export function VaultSetupClient({
  recoveryWordCount,
  passwordPolicy,
}: {
  recoveryWordCount: 12 | 24;
  passwordPolicy: VaultAdminPasswordPolicy;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [vaultPassword, setVaultPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);

  const confirmationIndices = useMemo(() => {
    if (!recoveryPhrase) return [];
    const words = recoveryPhrase.split(" ");
    const count = getRecoveryConfirmationPromptCount(recoveryWordCount);
    return pickRecoveryConfirmationIndices(words.length, count);
  }, [recoveryPhrase, recoveryWordCount]);

  useEffect(() => {
    if (isVaultConfigured()) {
      router.replace("/vault/unlock?next=/vault");
    }
  }, [router]);

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const setupValidation = validateVaultPasswordSetup({
      password: vaultPassword,
      confirmation: confirmPassword,
      policy: passwordPolicy,
    });
    if (!setupValidation.valid) {
      setError(
        setupValidation.confirmation.message ??
          setupValidation.password.messages[0] ??
          "Vault password does not meet the configured policy."
      );
      return;
    }

    setBusy(true);
    try {
      const result = await createDemoVault({ vaultPassword, recoveryWordCount });
      setRecoveryPhrase(result.recoveryPhrase);
      setStep("recovery");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleRecoveryContinue() {
    setAnswers({});
    setStep("confirm");
  }

  async function handleConfirmationSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const answersByOneBasedIndex: Record<number, string> = {};
      for (const index of confirmationIndices) {
        answersByOneBasedIndex[index] = answers[index] ?? "";
      }
      assertRecoveryPhraseWordConfirmation(
        recoveryPhrase,
        answersByOneBasedIndex,
        confirmationIndices
      );
      router.push("/vault");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recovery confirmation failed.");
    }
  }

  return (
    <AppShell
      title="Vault setup"
      description="Create a local demo vault. Ciphertext is stored in this browser; the vault password and recovery phrase never leave the client."
    >
      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {step === "password" ? (
        <form onSubmit={handlePasswordSubmit} className="vc-admin-card max-w-lg space-y-4">
          <h2 className="vc-admin-card-title">Choose a vault password</h2>
          <p className="vc-admin-card-desc">
            Separate from any account password. Required to unlock this demo vault on this device.
          </p>
          <VaultPasswordSetupFields
            password={vaultPassword}
            confirmation={confirmPassword}
            onPasswordChange={setVaultPassword}
            onConfirmationChange={setConfirmPassword}
            policy={passwordPolicy}
            disabled={busy}
            onValidityChange={setPasswordValid}
          />
          <button
            type="submit"
            disabled={busy || (passwordPolicy.enforcement === "enforce" && !passwordValid)}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Creating vault…" : "Continue"}
          </button>
        </form>
      ) : null}

      {step === "recovery" ? (
        <section className="vc-admin-card max-w-2xl space-y-4">
          <h2 className="vc-admin-card-title">Save your recovery phrase</h2>
          <p className="vc-admin-card-desc">
            Write down these {recoveryWordCount} words offline. Anyone with the phrase can unlock the
            vault.
          </p>
          <pre className="vc-admin-pre">{recoveryPhrase}</pre>
          <button
            type="button"
            onClick={handleRecoveryContinue}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            I saved it — confirm words
          </button>
        </section>
      ) : null}

      {step === "confirm" ? (
        <form onSubmit={handleConfirmationSubmit} className="vc-admin-card max-w-lg space-y-4">
          <h2 className="vc-admin-card-title">Confirm recovery phrase</h2>
          <p className="vc-admin-card-desc">Enter the requested words to finish setup.</p>
          {confirmationIndices.map((index) => (
            <label key={index} className="block text-sm">
              <span className="mb-1 block font-medium">Word #{index}</span>
              <input
                className="vc-admin-input w-full"
                value={answers[index] ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [index]: event.target.value }))
                }
                autoComplete="off"
                required
              />
            </label>
          ))}
          <button
            type="submit"
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Finish setup
          </button>
        </form>
      ) : null}
    </AppShell>
  );
}
