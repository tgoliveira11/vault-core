"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { VaultRateLimitError } from "../../errors/vault-errors.js";
import {
  withVaultUnlockRateLimit,
  type VaultUnlockRateLimiter,
} from "../../rate-limit/vault-unlock-rate-limit.js";
import { resolveVaultDockPasskeyAvailability } from "./resolve-passkey-dock-availability.js";
import type { VaultServerStatusSnapshot } from "../status/resolve-vault-client-status.js";

export type VaultDockQuickUnlockLabels = {
  vaultPassword: string;
  unlockVault: string;
  unlockWithPasskey: string;
  unlocking: string;
  passkeyUnavailable: string;
};

export const DEFAULT_VAULT_DOCK_QUICK_UNLOCK_LABELS: VaultDockQuickUnlockLabels = {
  vaultPassword: "Vault password",
  unlockVault: "Unlock vault",
  unlockWithPasskey: "Unlock with passkey",
  unlocking: "Unlocking…",
  passkeyUnavailable: "Passkey unlock is unavailable in this browser.",
};

export type VaultDockQuickUnlockProps = {
  loading?: boolean;
  error?: string | null;
  serverStatus?: VaultServerStatusSnapshot | null;
  idPrefix?: string;
  labels?: Partial<VaultDockQuickUnlockLabels>;
  onUnlockPassword: (password: string) => void | Promise<void>;
  onUnlockPasskey?: () => void | Promise<void>;
  passkeyReady?: boolean;
  /** When passkey unlock is cancelled or fails, navigate to the full unlock page. */
  onPasskeyUnlockFailed?: (error: unknown) => void;
  /** Focus the vault password field when password unlock is primary. Defaults to true. */
  autoFocusPassword?: boolean;
  /** Attempt passkey unlock once when passkey unlock is primary. Defaults to true. */
  autoStartPasskey?: boolean;
  unlockRateLimiter?: VaultUnlockRateLimiter;
  rateLimitScopeKey?: string;
  /** Optional alert slot for styled error output. */
  renderError?: (message: string) => ReactNode;
};

function DefaultError({ message }: { message: string }) {
  return (
    <p className="vc-status-dock-unlock__error" role="alert">
      {message}
    </p>
  );
}

/** Compact dock unlock: one primary method — passkey when configured, otherwise vault password. */
export function VaultDockQuickUnlock({
  loading = false,
  error = null,
  serverStatus = null,
  idPrefix = "dock-unlock",
  labels: labelOverrides,
  onUnlockPassword,
  onUnlockPasskey,
  passkeyReady = true,
  onPasskeyUnlockFailed,
  autoFocusPassword = true,
  autoStartPasskey = true,
  unlockRateLimiter,
  rateLimitScopeKey = "default",
  renderError = (message) => <DefaultError message={message} />,
}: VaultDockQuickUnlockProps) {
  const labels = { ...DEFAULT_VAULT_DOCK_QUICK_UNLOCK_LABELS, ...labelOverrides };
  const [vaultPassword, setVaultPassword] = useState("");
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const passkeyAutoStartedRef = useRef(false);
  const { hasEnvelope, showPasskey, prfExplicitlyUnsupported } =
    resolveVaultDockPasskeyAvailability(serverStatus);
  const passwordId = `${idPrefix}-vault-password`;
  const usePasskeyPrimary = hasEnvelope;
  const displayedError = rateLimitError ?? error;

  async function runUnlockAttempt<T>(
    action: "password" | "passkey_prf",
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

  async function submitPasskey() {
    if (!passkeyReady || !onUnlockPasskey) return;
    try {
      await runUnlockAttempt("passkey_prf", () => Promise.resolve(onUnlockPasskey()));
    } catch (error) {
      onPasskeyUnlockFailed?.(error);
    }
  }

  useEffect(() => {
    if (!autoFocusPassword || usePasskeyPrimary) return;
    passwordInputRef.current?.focus();
  }, [autoFocusPassword, usePasskeyPrimary]);

  useEffect(() => {
    if (
      !autoStartPasskey ||
      !usePasskeyPrimary ||
      !showPasskey ||
      !onUnlockPasskey ||
      !passkeyReady ||
      loading ||
      passkeyAutoStartedRef.current
    ) {
      return;
    }
    passkeyAutoStartedRef.current = true;
    void submitPasskey();
  }, [
    autoStartPasskey,
    usePasskeyPrimary,
    showPasskey,
    onUnlockPasskey,
    passkeyReady,
    loading,
  ]);

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPassword();
  }

  if (usePasskeyPrimary) {
    if (!showPasskey || !onUnlockPasskey) {
      return (
        <div className="vc-status-dock-unlock">
          <p className="vc-status-dock-unlock__note">{labels.passkeyUnavailable}</p>
          {displayedError ? renderError(displayedError) : null}
        </div>
      );
    }

    return (
      <div className="vc-status-dock-unlock">
        <button
          type="button"
          className="vc-status-dock__action vc-status-dock__action--subtle vc-status-dock-unlock__submit"
          disabled={loading || !passkeyReady}
          onClick={() => void submitPasskey()}
        >
          {loading ? labels.unlocking : labels.unlockWithPasskey}
        </button>
        {prfExplicitlyUnsupported ? (
          <p className="vc-status-dock-unlock__note">{labels.passkeyUnavailable}</p>
        ) : null}
        {displayedError ? renderError(displayedError) : null}
      </div>
    );
  }

  return (
    <form className="vc-status-dock-unlock" onSubmit={handlePasswordSubmit}>
      <label className="vc-status-dock-unlock__field" htmlFor={passwordId}>
        <span className="vc-status-dock-unlock__label">{labels.vaultPassword}</span>
        <input
          ref={passwordInputRef}
          id={passwordId}
          className="vc-status-dock-unlock__input"
          type="password"
          autoComplete="current-password"
          value={vaultPassword}
          onChange={(event) => setVaultPassword(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className="vc-status-dock__action vc-status-dock__action--subtle vc-status-dock-unlock__submit"
        disabled={loading || !vaultPassword}
      >
        {loading ? labels.unlocking : labels.unlockVault}
      </button>
      {displayedError ? renderError(displayedError) : null}
    </form>
  );
}
