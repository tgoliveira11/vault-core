"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { VaultRateLimitError } from "../../errors/vault-errors.js";
import {
  withVaultUnlockRateLimit,
  type VaultUnlockRateLimiter,
} from "../../rate-limit/vault-unlock-rate-limit.js";
import { resolveVaultDockPasskeyAvailability } from "../status-dock/resolve-passkey-dock-availability.js";
import type { VaultServerStatusSnapshot } from "../status/resolve-vault-client-status.js";

export type VaultUnlockMethod = "password" | "recovery_phrase";

export type VaultUnlockPanelLabels = {
  title: string;
  description: string;
  methodTabsLabel: string;
  passwordTab: string;
  recoveryTab: string;
  vaultPassword: string;
  recoveryPhrase: string;
  recoveryHint: string;
  unlockVault: string;
  recoverVault: string;
  unlockWithPasskey: string;
  unlocking: string;
  passkeyUnavailable: string;
};

export const DEFAULT_VAULT_UNLOCK_PANEL_LABELS: VaultUnlockPanelLabels = {
  title: "Unlock vault",
  description:
    "Your account may be signed in, but the vault stays locked until you unlock it with your vault password, recovery phrase, or linked passkey.",
  methodTabsLabel: "Unlock method",
  passwordTab: "Vault password",
  recoveryTab: "Recovery phrase",
  vaultPassword: "Vault password",
  recoveryPhrase: "Recovery phrase",
  recoveryHint:
    "Enter your recovery phrase to restore access to your vault. This does not recover your vault password.",
  unlockVault: "Unlock vault",
  recoverVault: "Recover vault access",
  unlockWithPasskey: "Unlock with passkey",
  unlocking: "Unlocking…",
  passkeyUnavailable: "Passkey unlock is unavailable in this browser.",
};

export type VaultUnlockPanelProps = {
  loading?: boolean;
  error?: string | null;
  serverStatus?: VaultServerStatusSnapshot | null;
  prfSupported?: boolean;
  /** When false, passkey UI stays visible but disabled (for example credential not on this device). */
  passkeyReady?: boolean;
  idPrefix?: string;
  labels?: Partial<VaultUnlockPanelLabels>;
  defaultMethod?: VaultUnlockMethod;
  onUnlockPassword: (password: string) => void | Promise<void>;
  onUnlockRecoveryPhrase: (phrase: string) => void | Promise<void>;
  onUnlockPasskey?: () => void | Promise<void>;
  autoFocusPassword?: boolean;
  autoStartPasskey?: boolean;
  unlockRateLimiter?: VaultUnlockRateLimiter;
  rateLimitScopeKey?: string;
  renderError?: (message: string) => ReactNode;
  className?: string;
};

function DefaultError({ message }: { message: string }) {
  return (
    <p className="vc-vault-unlock__error" role="alert">
      {message}
    </p>
  );
}

/** Full-page vault unlock UI with password, recovery phrase, and optional passkey unlock. */
export function VaultUnlockPanel({
  loading = false,
  error = null,
  serverStatus = null,
  prfSupported = true,
  passkeyReady = true,
  idPrefix = "vault-unlock",
  labels: labelOverrides,
  defaultMethod = "password",
  onUnlockPassword,
  onUnlockRecoveryPhrase,
  onUnlockPasskey,
  autoFocusPassword = true,
  autoStartPasskey = false,
  unlockRateLimiter,
  rateLimitScopeKey = "default",
  renderError = (message) => <DefaultError message={message} />,
  className,
}: VaultUnlockPanelProps) {
  const labels = { ...DEFAULT_VAULT_UNLOCK_PANEL_LABELS, ...labelOverrides };
  const [method, setMethod] = useState<VaultUnlockMethod>(defaultMethod);
  const [vaultPassword, setVaultPassword] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const passkeyAutoStartedRef = useRef(false);
  const { hasEnvelope, showPasskey: dockShowPasskey, prfExplicitlyUnsupported: dockPrfUnsupported } =
    resolveVaultDockPasskeyAvailability(serverStatus);
  const showPasskey = dockShowPasskey && prfSupported !== false;
  const prfExplicitlyUnsupported = dockPrfUnsupported || prfSupported === false;
  const showPasskeyUnlock = Boolean(hasEnvelope && onUnlockPasskey);
  const passwordId = `${idPrefix}-vault-password`;
  const phraseId = `${idPrefix}-recovery-phrase`;
  const displayedError = rateLimitError ?? error;

  async function runUnlockAttempt<T>(
    action: "password" | "recovery_phrase" | "passkey_prf",
    attempt: () => Promise<T>
  ): Promise<T | undefined> {
    if (loading) return undefined;
    setRateLimitError(null);
    try {
      if (unlockRateLimiter) {
        return await withVaultUnlockRateLimit(
          unlockRateLimiter,
          rateLimitScopeKey,
          action,
          attempt
        );
      }
      return await attempt();
    } catch (caught) {
      if (caught instanceof VaultRateLimitError) {
        setRateLimitError(caught.message);
      }
      throw caught;
    }
  }

  async function submitPassword() {
    if (!vaultPassword) return;
    try {
      await runUnlockAttempt("password", () => Promise.resolve(onUnlockPassword(vaultPassword)));
      setVaultPassword("");
    } catch {
      // Error surfaced via error or rate limit props.
    }
  }

  async function submitRecoveryPhrase() {
    if (!recoveryPhrase.trim()) return;
    try {
      await runUnlockAttempt("recovery_phrase", () =>
        Promise.resolve(onUnlockRecoveryPhrase(recoveryPhrase))
      );
      setRecoveryPhrase("");
    } catch {
      // Error surfaced via error or rate limit props.
    }
  }

  async function submitPasskey() {
    if (!passkeyReady || !onUnlockPasskey) return;
    try {
      await runUnlockAttempt("passkey_prf", () => Promise.resolve(onUnlockPasskey()));
    } catch {
      // Error surfaced via error or rate limit props.
    }
  }

  useEffect(() => {
    if (!autoFocusPassword || method !== "password" || showPasskeyUnlock) return;
    passwordInputRef.current?.focus();
  }, [autoFocusPassword, method, showPasskeyUnlock]);

  useEffect(() => {
    if (
      !autoStartPasskey ||
      !showPasskeyUnlock ||
      !showPasskey ||
      !passkeyReady ||
      loading ||
      passkeyAutoStartedRef.current
    ) {
      return;
    }
    passkeyAutoStartedRef.current = true;
    void submitPasskey();
  }, [autoStartPasskey, showPasskeyUnlock, showPasskey, passkeyReady, loading]);

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPassword();
  }

  function handleRecoverySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitRecoveryPhrase();
  }

  return (
    <div className={className ? `vc-vault-unlock ${className}` : "vc-vault-unlock"}>
      <div className="vc-vault-unlock__intro">
        <h2 className="vc-vault-unlock__title">{labels.title}</h2>
        <p className="vc-vault-unlock__description">{labels.description}</p>
      </div>

      {showPasskeyUnlock ? (
        <div className="vc-vault-unlock__passkey">
          <button
            type="button"
            className="vc-vault-unlock__submit vc-vault-unlock__submit--secondary"
            disabled={loading || !passkeyReady || !showPasskey}
            onClick={() => void submitPasskey()}
          >
            {loading ? labels.unlocking : labels.unlockWithPasskey}
          </button>
          {!showPasskey || prfExplicitlyUnsupported ? (
            <p className="vc-vault-unlock__note">{labels.passkeyUnavailable}</p>
          ) : null}
        </div>
      ) : null}

      <div className="vc-vault-unlock__tabs" role="tablist" aria-label={labels.methodTabsLabel}>
        <button
          type="button"
          role="tab"
          aria-selected={method === "password"}
          className={
            method === "password"
              ? "vc-vault-unlock__tab vc-vault-unlock__tab--active"
              : "vc-vault-unlock__tab"
          }
          onClick={() => setMethod("password")}
        >
          {labels.passwordTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === "recovery_phrase"}
          className={
            method === "recovery_phrase"
              ? "vc-vault-unlock__tab vc-vault-unlock__tab--active"
              : "vc-vault-unlock__tab"
          }
          onClick={() => setMethod("recovery_phrase")}
        >
          {labels.recoveryTab}
        </button>
      </div>

      {method === "password" ? (
        <form className="vc-vault-unlock__form" onSubmit={handlePasswordSubmit}>
          <label className="vc-vault-unlock__field" htmlFor={passwordId}>
            <span className="vc-vault-unlock__label">{labels.vaultPassword}</span>
            <input
              ref={passwordInputRef}
              id={passwordId}
              className="vc-admin-input w-full"
              type="password"
              autoComplete="current-password"
              value={vaultPassword}
              onChange={(event) => setVaultPassword(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="vc-vault-unlock__submit vc-vault-unlock__submit--primary"
            disabled={loading || !vaultPassword}
          >
            {loading ? labels.unlocking : labels.unlockVault}
          </button>
        </form>
      ) : (
        <form className="vc-vault-unlock__form" onSubmit={handleRecoverySubmit}>
          <p className="vc-vault-unlock__note">{labels.recoveryHint}</p>
          <label className="vc-vault-unlock__field" htmlFor={phraseId}>
            <span className="vc-vault-unlock__label">{labels.recoveryPhrase}</span>
            <textarea
              id={phraseId}
              className="vc-admin-input min-h-24 w-full"
              value={recoveryPhrase}
              onChange={(event) => setRecoveryPhrase(event.target.value)}
              placeholder="Enter your recovery phrase"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className="vc-vault-unlock__submit vc-vault-unlock__submit--primary"
            disabled={loading || !recoveryPhrase.trim()}
          >
            {loading ? labels.unlocking : labels.recoverVault}
          </button>
        </form>
      )}

      {displayedError ? renderError(displayedError) : null}
    </div>
  );
}
