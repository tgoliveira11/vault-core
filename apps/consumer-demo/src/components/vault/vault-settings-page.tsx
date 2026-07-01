"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { assertRecoveryPhraseConfirmation } from "@tgoliveira/vault-core";
import type { RecoveryPhraseWordCount, VaultAdminPasswordPolicy } from "@tgoliveira/vault-core";
import { validateVaultPasswordSetup } from "@tgoliveira/vault-core";
import { VaultPasswordSetupFields } from "@tgoliveira/vault-core/react";
import { AppShell } from "@/components/app-shell";
import { getDemoPasskeySupport } from "@/lib/vault-demo-passkey";
import {
  changeDemoVaultPassword,
  commitDemoRecoveryRotation,
  deleteDemoVault,
  generateDemoRecoveryRotation,
  getVaultSecuritySnapshot,
  linkDemoPasskeyPrf,
  unlinkDemoPasskeyPrf,
  upgradeDemoPasswordEnvelope,
  upgradeDemoRecoveryEnvelope,
  type VaultSecuritySnapshot,
} from "@/lib/vault-demo-security";

function formatSecurityError(error: unknown): string {
  if (error instanceof Error) {
    if (/unchanged/i.test(error.message)) return "Choose a different vault password.";
    if (/authorization|incorrect|mismatch|decrypt|operation/i.test(error.message)) {
      return "Authorization failed. Check your vault password.";
    }
    return error.message;
  }
  return "Operation failed.";
}

export function VaultSettingsPage({
  recoveryWordCount,
  passkeyPrfUnlockEnabled,
  passwordPolicy,
}: {
  recoveryWordCount: RecoveryPhraseWordCount;
  passkeyPrfUnlockEnabled: boolean;
  passwordPolicy: VaultAdminPasswordPolicy;
}) {
  return (
    <VaultSettingsContent
      recoveryWordCount={recoveryWordCount}
      passkeyPrfUnlockEnabled={passkeyPrfUnlockEnabled}
      passwordPolicy={passwordPolicy}
    />
  );
}

function VaultSettingsContent({
  recoveryWordCount,
  passkeyPrfUnlockEnabled,
  passwordPolicy,
}: {
  recoveryWordCount: RecoveryPhraseWordCount;
  passkeyPrfUnlockEnabled: boolean;
  passwordPolicy: VaultAdminPasswordPolicy;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<VaultSecuritySnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setSnapshot(getVaultSecuritySnapshot());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const passkeySupport = getDemoPasskeySupport();

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      refresh();
    } catch (caught) {
      setError(formatSecurityError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      vaultProtected
      title="Vault security"
      description="Change vault password, rotate recovery phrase, link passkey PRF unlock, and upgrade legacy KDF envelopes. Requires an unlocked vault session."
    >
      <div className="mb-4">
        <Link
          href="/vault"
          className="text-sm text-[var(--primary)] hover:underline"
        >
          ← Back to my vault
        </Link>
      </div>

      {message ? (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {snapshot ? (
        <div className="grid gap-4">
          <section className="vc-admin-card">
            <h2 className="vc-admin-card-title">Envelope status</h2>
            <ul className="vc-admin-list mt-2">
              <li>
                Password envelope KDF: <code>{snapshot.passwordKdfVersion}</code>
                {snapshot.passwordKdfUpgradeRecommended ? " (upgrade available)" : null}
              </li>
              <li>
                Recovery envelope KDF: <code>{snapshot.recoveryKdfVersion}</code>
                {snapshot.recoveryKdfUpgradeRecommended ? " (upgrade available)" : null}
              </li>
              <li>
                Passkey PRF envelope:{" "}
                <code>{snapshot.hasPasskey ? "linked" : "not linked"}</code>
              </li>
            </ul>
          </section>

          <PasswordChangeSection
            busy={busy}
            passwordPolicy={passwordPolicy}
            onSubmit={async (currentPassword, newPassword) => {
              await runAction(async () => {
                await changeDemoVaultPassword({ currentPassword, newPassword });
                setMessage("Vault password updated.");
              });
            }}
          />

          <RecoveryRotationSection
            busy={busy}
            recoveryWordCount={recoveryWordCount}
            onComplete={() => {
              refresh();
              setMessage("Recovery phrase rotated and saved.");
            }}
            onError={setError}
            setBusy={setBusy}
          />

          <PasskeySection
            busy={busy}
            enabled={passkeyPrfUnlockEnabled}
            snapshot={snapshot}
            support={passkeySupport}
            onLink={() =>
              runAction(async () => {
                await linkDemoPasskeyPrf();
                setMessage("Passkey PRF unlock linked on this device.");
              })
            }
            onUnlink={() =>
              runAction(async () => {
                unlinkDemoPasskeyPrf();
                setMessage("Passkey PRF unlock removed.");
              })
            }
          />

          <KdfUpgradeSection
            busy={busy}
            snapshot={snapshot}
            recoveryWordCount={recoveryWordCount}
            onUpgradePassword={async (currentPassword) => {
              await runAction(async () => {
                const upgraded = await upgradeDemoPasswordEnvelope(currentPassword);
                setMessage(
                  upgraded
                    ? "Password envelope upgraded to the recommended KDF."
                    : "Password envelope is already up to date."
                );
              });
            }}
            onUpgradeRecovery={async (recoveryPhrase) => {
              await runAction(async () => {
                const upgraded = await upgradeDemoRecoveryEnvelope({
                  recoveryPhrase,
                  wordCount: recoveryWordCount,
                });
                setMessage(
                  upgraded
                    ? "Recovery envelope upgraded to the recommended KDF."
                    : "Recovery envelope is already up to date."
                );
              });
            }}
          />

          <DeleteVaultSection
            busy={busy}
            onDelete={async (currentPassword) => {
              await runAction(async () => {
                await deleteDemoVault(currentPassword);
                router.replace("/vault/setup");
              });
            }}
          />
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">Loading vault security status…</p>
      )}
    </AppShell>
  );
}

function PasswordChangeSection({
  busy,
  passwordPolicy,
  onSubmit,
}: {
  busy: boolean;
  passwordPolicy: VaultAdminPasswordPolicy;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);

  function handleSubmit() {
    const validation = validateVaultPasswordSetup({
      password: newPassword,
      confirmation: confirmPassword,
      policy: passwordPolicy,
    });
    if (!validation.valid || !currentPassword) return;
    void onSubmit(currentPassword, newPassword);
  }

  return (
    <section className="vc-admin-card space-y-3">
      <h2 className="vc-admin-card-title">Change vault password</h2>
      <p className="vc-admin-card-desc">
        Re-wraps the same UVK with a new password via <code>rotateVaultPassword()</code>.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Current password</span>
        <input
          type="password"
          className="vc-admin-input w-full"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
      <VaultPasswordSetupFields
        password={newPassword}
        confirmation={confirmPassword}
        onPasswordChange={setNewPassword}
        onConfirmationChange={setConfirmPassword}
        policy={passwordPolicy}
        passwordLabel="New password"
        confirmationLabel="Confirm new password"
        disabled={busy}
        onValidityChange={setPasswordValid}
      />
      <button
        type="button"
        disabled={
          busy ||
          !currentPassword ||
          (passwordPolicy.enforcement === "enforce" && !passwordValid)
        }
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        onClick={handleSubmit}
      >
        Update vault password
      </button>
    </section>
  );
}

function RecoveryRotationSection({
  busy,
  recoveryWordCount,
  onComplete,
  onError,
  setBusy,
}: {
  busy: boolean;
  recoveryWordCount: RecoveryPhraseWordCount;
  onComplete: () => void;
  onError: (message: string) => void;
  setBusy: (value: boolean) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [pendingPhrase, setPendingPhrase] = useState<string | null>(null);
  const [pendingKit, setPendingKit] = useState<string | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [pendingEnvelope, setPendingEnvelope] = useState<
    Awaited<ReturnType<typeof generateDemoRecoveryRotation>>["envelope"] | null
  >(null);

  async function handleGenerate() {
    setBusy(true);
    onError("");
    try {
      const result = await generateDemoRecoveryRotation({
        currentPassword,
        wordCount: recoveryWordCount,
      });
      setPendingPhrase(result.recoveryPhrase);
      setPendingKit(result.recoveryKitText);
      setPendingEnvelope(result.envelope);
      setConfirmPhrase("");
    } catch (caught) {
      onError(formatSecurityError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!pendingPhrase || !pendingEnvelope) return;
    setBusy(true);
    onError("");
    try {
      assertRecoveryPhraseConfirmation(pendingPhrase, confirmPhrase);
      await commitDemoRecoveryRotation(pendingEnvelope);
      setPendingPhrase(null);
      setPendingKit(null);
      setPendingEnvelope(null);
      setConfirmPhrase("");
      setCurrentPassword("");
      onComplete();
    } catch (caught) {
      onError(formatSecurityError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="vc-admin-card space-y-3">
      <h2 className="vc-admin-card-title">Rotate recovery phrase</h2>
      <p className="vc-admin-card-desc">
        Generates a new {recoveryWordCount}-word BIP39 phrase via{" "}
        <code>rotateRecoveryPhrase()</code>. Save it offline before confirming.
      </p>
      {!pendingPhrase ? (
        <>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Current vault password</span>
            <input
              type="password"
              className="vc-admin-input w-full"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button
            type="button"
            disabled={busy || !currentPassword}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void handleGenerate()}
          >
            Generate new recovery phrase
          </button>
        </>
      ) : (
        <>
          <pre className="vc-admin-pre">{pendingPhrase}</pre>
          {pendingKit ? <pre className="vc-admin-pre">{pendingKit}</pre> : null}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Re-enter the new phrase to confirm</span>
            <textarea
              className="vc-admin-input min-h-24 w-full"
              value={confirmPhrase}
              onChange={(event) => setConfirmPhrase(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={() => void handleCommit()}
            >
              Save new recovery envelope
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
              onClick={() => {
                setPendingPhrase(null);
                setPendingKit(null);
                setPendingEnvelope(null);
                setConfirmPhrase("");
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function PasskeySection({
  busy,
  enabled,
  snapshot,
  support,
  onLink,
  onUnlink,
}: {
  busy: boolean;
  enabled: boolean;
  snapshot: VaultSecuritySnapshot;
  support: { passkey: boolean; prf: boolean };
  onLink: () => Promise<void>;
  onUnlink: () => Promise<void>;
}) {
  if (!enabled) {
    return (
      <section className="vc-admin-card">
        <h2 className="vc-admin-card-title">Passkey PRF unlock</h2>
        <p className="vc-admin-card-desc mt-2">
          Disabled by admin config (<code>VAULT_PASSKEY_PRF_UNLOCK_ENABLED</code>).
        </p>
      </section>
    );
  }

  return (
    <section className="vc-admin-card space-y-3">
      <h2 className="vc-admin-card-title">Passkey PRF unlock</h2>
      <p className="vc-admin-card-desc">
        Registers a WebAuthn passkey with the PRF extension and stores a{" "}
        <code>passkeyPrfEnvelope</code> locally. PRF output never leaves the browser.
      </p>
      <ul className="vc-admin-list">
        <li>Browser passkey support: {support.passkey ? "yes" : "no"}</li>
        <li>PRF extension support: {support.prf ? "yes" : "no"}</li>
        <li>Credential on this device: {snapshot.passkeyCredentialLinked ? "yes" : "no"}</li>
      </ul>
      {!snapshot.hasPasskey ? (
        <button
          type="button"
          disabled={busy || !support.passkey || !support.prf}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => void onLink()}
        >
          Link passkey unlock
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-700"
          onClick={() => void onUnlink()}
        >
          Remove passkey unlock
        </button>
      )}
    </section>
  );
}

function KdfUpgradeSection({
  busy,
  snapshot,
  recoveryWordCount,
  onUpgradePassword,
  onUpgradeRecovery,
}: {
  busy: boolean;
  snapshot: VaultSecuritySnapshot;
  recoveryWordCount: RecoveryPhraseWordCount;
  onUpgradePassword: (currentPassword: string) => Promise<void>;
  onUpgradeRecovery: (recoveryPhrase: string) => Promise<void>;
}) {
  const [passwordForUpgrade, setPasswordForUpgrade] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");

  if (!snapshot.passwordKdfUpgradeRecommended && !snapshot.recoveryKdfUpgradeRecommended) {
    return (
      <section className="vc-admin-card">
        <h2 className="vc-admin-card-title">KDF upgrade</h2>
        <p className="vc-admin-card-desc mt-2">All envelopes already use the recommended KDF.</p>
      </section>
    );
  }

  return (
    <section className="vc-admin-card space-y-4">
      <h2 className="vc-admin-card-title">Upgrade legacy KDF envelopes</h2>
      <p className="vc-admin-card-desc">
        Calls <code>maybeUpgradePasswordEnvelopeAfterUnlock()</code> and{" "}
        <code>maybeUpgradeRecoveryEnvelopeAfterUnlock()</code> after unlock.
      </p>

      {snapshot.passwordKdfUpgradeRecommended ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Password envelope</p>
          <input
            type="password"
            className="vc-admin-input w-full"
            placeholder="Current vault password"
            value={passwordForUpgrade}
            onChange={(event) => setPasswordForUpgrade(event.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            disabled={busy || !passwordForUpgrade}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
            onClick={() => void onUpgradePassword(passwordForUpgrade)}
          >
            Upgrade password envelope
          </button>
        </div>
      ) : null}

      {snapshot.recoveryKdfUpgradeRecommended ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Recovery envelope ({recoveryWordCount} words)</p>
          <textarea
            className="vc-admin-input min-h-20 w-full"
            placeholder="Current recovery phrase"
            value={recoveryPhrase}
            onChange={(event) => setRecoveryPhrase(event.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            disabled={busy || !recoveryPhrase.trim()}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
            onClick={() => void onUpgradeRecovery(recoveryPhrase)}
          >
            Upgrade recovery envelope
          </button>
          <p className="text-xs text-[var(--muted)]">
            Recovery upgrade requires your current recovery phrase while the vault is unlocked.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function DeleteVaultSection({
  busy,
  onDelete,
}: {
  busy: boolean;
  onDelete: (currentPassword: string) => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const canDelete = currentPassword.length > 0 && confirmation === "DELETE";

  return (
    <section className="vc-admin-card space-y-3 border border-red-200">
      <h2 className="vc-admin-card-title text-red-800">Delete vault</h2>
      <p className="vc-admin-card-desc">
        Permanently removes this device&apos;s vault record (password and recovery envelopes,
        encrypted notes, and passkey link). This cannot be undone. Confirms your password via{" "}
        <code>unlockWithPasswordEnvelope()</code>, then clears local storage and the vault session
        via <code>lockVaultSession()</code>.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Current vault password</span>
        <input
          type="password"
          className="vc-admin-input w-full"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Type DELETE to confirm</span>
        <input
          type="text"
          className="vc-admin-input w-full"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          placeholder="DELETE"
        />
      </label>
      <button
        type="button"
        disabled={busy || !canDelete}
        className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-60"
        onClick={() => void onDelete(currentPassword)}
      >
        Delete vault permanently
      </button>
    </section>
  );
}
