"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  lockVaultSessionManually,
  suppressVaultActivity,
  touchVaultSession,
  type VaultSessionLease,
} from "../../browser.js";
import { useVaultClientStatus } from "../status/use-vault-client-status.js";
import type {
  VaultClientStatus,
  VaultServerStatusSnapshot,
} from "../status/resolve-vault-client-status.js";
import {
  DEFAULT_VAULT_STATUS_DOCK_LABELS,
  getDefaultVaultStatusDockExpanded,
  getVaultStatusDockExpandedCopy,
  getVaultStatusDockHandleLabel,
  resolveVaultStatusDockExpanded,
  buildVaultStatusDockReturnPath,
  vaultStatusDockAutoCollapseWhenExpanded,
  type VaultStatusDockLabels,
} from "./copy.js";
import { subscribeVaultDockExpand, DEFAULT_VAULT_DOCK_EXPAND_EVENT } from "./events.js";
import {
  VaultStatusDockLockIcon,
  VaultStatusIcon,
} from "./icons.js";
import {
  readVaultStatusDockCollapsedPreference,
  writeVaultStatusDockCollapsedPreference,
  DEFAULT_VAULT_STATUS_DOCK_COLLAPSED_KEY,
} from "./preference.js";
import { resolveVaultDockPasskeyAvailability } from "./resolve-passkey-dock-availability.js";
import {
  useVaultAutoLockCountdown,
  useVaultAutoLockFraction,
  useVaultAutoLockMinutes,
  resolveVaultAutoLockMinutes,
} from "./use-vault-auto-lock-countdown.js";
import { useVaultDockDismiss } from "./use-vault-dock-dismiss.js";
import {
  classifyPasskeyUnlockFailure,
  type PasskeyUnlockFailureKind,
} from "../../errors/passkey-unlock-failure.js";
import { buildVaultUnlockHref } from "../unlock/vault-unlock-routes.js";
import { navigateToVaultFullUnlock } from "./navigate-to-full-unlock.js";
import { tryConsumePasskeyAutoStart } from "./passkey-auto-start-dedupe.js";
import { useLongPressDuressSignal } from "../emergency/use-long-press-duress-signal.js";

const DEFAULT_PASSKEY_AUTO_START_DELAY_MS = 2000;

const DEFAULT_PASSKEY_REDIRECT_KINDS: PasskeyUnlockFailureKind[] = ["redirect_to_full_unlock"];

function shouldRedirectOnPasskeyFailure(
  error: unknown,
  redirectOnPasskeyUnlockFailure: boolean | PasskeyUnlockFailureKind[],
  shouldRedirectOnPasskeyUnlockFailure?: (error: unknown) => boolean
): boolean {
  if (shouldRedirectOnPasskeyUnlockFailure) {
    return shouldRedirectOnPasskeyUnlockFailure(error);
  }
  if (redirectOnPasskeyUnlockFailure === false) return false;
  const kind = classifyPasskeyUnlockFailure(error);
  if (redirectOnPasskeyUnlockFailure === true) {
    return kind !== "user_cancelled";
  }
  return redirectOnPasskeyUnlockFailure.includes(kind);
}

export type VaultStatusDockLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
};

export type VaultStatusDockProps = {
  /** When false, the dock does not render (e.g. signed-out). Defaults to true. */
  visible?: boolean;
  serverStatus: VaultServerStatusSnapshot | null;
  prfSupported: boolean;
  pathname: string;
  /** Path to the full unlock page (e.g. `/vault/unlock`). */
  unlockPath: string;
  /** Build href for the full unlock page with return path. */
  buildUnlockHref?: (returnPath: string) => string;
  /** When the pathname matches, the dock stays collapsed (handle only) on the full unlock page. */
  isFullUnlockPage?: (pathname: string) => boolean;
  /** Minutes shown on the stay-unlocked action and used for countdown fraction. When omitted, uses the active vault session config. */
  autoLockMinutes?: number;
  /** When false, locked quick-unlock panel is hidden (e.g. setup incomplete). */
  quickUnlockEnabled?: boolean;
  loading?: boolean;
  unlockError?: string | null;
  labels?: Partial<VaultStatusDockLabels>;
  collapsedPreferenceKey?: string;
  expandEventName?: string;
  LinkComponent?: ComponentType<VaultStatusDockLinkProps>;
  className?: string;
  onLock?: () => void;
  onStayUnlocked?: () => void;
  /** Required for Stay unlocked after owner-scoped session mode is enabled. */
  sessionLease?: VaultSessionLease;
  /**
   * When dock passkey unlock fails with a matching failure kind, navigates to the full unlock
   * page with the current return path. User cancellation does not redirect by default.
   * Defaults to `["redirect_to_full_unlock"]`. Set to `false` to disable, or `true` to redirect
   * on every failure except user cancellation.
   */
  redirectOnPasskeyUnlockFailure?: boolean | PasskeyUnlockFailureKind[];
  /** Overrides {@link redirectOnPasskeyUnlockFailure} when provided. */
  shouldRedirectOnPasskeyUnlockFailure?: (error: unknown) => boolean;
  /** App navigation for full unlock redirect (for example Next.js `router.push`). */
  onNavigateToUnlock?: (href: string) => void;
  /** Invoked when dock passkey unlock is cancelled (no redirect by default). */
  onPasskeyUnlockCancelled?: (error: unknown) => void;
  /**
   * Delay (ms) before passkey auto-start after dock expand. Default 2000 ms so long-press on the
   * handle can complete before the ceremony starts. Set to 0 for immediate auto-start (tests).
   */
  passkeyAutoStartDelayMs?: number;
  /** Notified when the long-press duress latch changes (handle or passkey button). */
  onDuressSignalChange?: (signaled: boolean) => void;
  /** Custom quick-unlock slot; defaults to none (link to full unlock only). */
  renderQuickUnlock?: (context: {
    loading: boolean;
    error: string | null;
    serverStatus: VaultServerStatusSnapshot | null;
    collapse: () => void;
    fullUnlockHref: string;
    /** Fatal passkey failures that may redirect to the full unlock page. */
    onPasskeyUnlockFailed: (error: unknown) => void;
    /** User-cancelled passkey unlock; does not call {@link onNavigateToUnlock}. */
    onPasskeyUnlockCancelled: (error: unknown) => void;
    /**
     * Register a synchronous passkey auto-start handler from dock expand.
     * Pass to {@link VaultDockQuickUnlock.bindAutoStartPasskey}.
     */
    bindAutoStartPasskey: (handler: (() => void) | null) => void;
    /** Whether passkey auto-start was already consumed for this expand (dedupe). */
    autoStartConsumed: boolean;
    /** Latched long-press duress signal for this expand/unlock attempt. */
    duressSignaled: boolean;
    resetDuressSignal: () => void;
  }) => ReactNode;
};

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function iconToneClass(clientStatus: VaultClientStatus): string {
  switch (clientStatus) {
    case "unlocked":
    case "emergency_unlocked":
      return "vc-status-dock__icon--open";
    case "locked":
    case "emergency_locked":
    case "unsupported_prf":
      return "vc-status-dock__icon--closed";
    default:
      return "vc-status-dock__icon--muted";
  }
}

function handleToneClass(clientStatus: VaultClientStatus): string {
  switch (clientStatus) {
    case "unlocked":
    case "emergency_unlocked":
      return "vc-status-dock-handle--open";
    case "locked":
    case "emergency_locked":
    case "unsupported_prf":
      return "vc-status-dock-handle--closed";
    default:
      return "vc-status-dock-handle--muted";
  }
}

function resolveExpanded(
  clientStatus: VaultClientStatus,
  preference: boolean | null,
  onFullUnlockPage: boolean
): boolean {
  return resolveVaultStatusDockExpanded(clientStatus, preference, onFullUnlockPage);
}

function buildCurrentReturnPath(pathname: string, search: string): string {
  return buildVaultStatusDockReturnPath(pathname, search);
}

/** Header-attached collapsible vault status handle and expanded dock. */
export function VaultStatusDock({
  visible = true,
  serverStatus,
  prfSupported,
  pathname,
  unlockPath,
  buildUnlockHref: buildUnlockHrefProp,
  isFullUnlockPage,
  autoLockMinutes,
  quickUnlockEnabled = true,
  loading = false,
  unlockError = null,
  labels: labelOverrides,
  collapsedPreferenceKey = DEFAULT_VAULT_STATUS_DOCK_COLLAPSED_KEY,
  expandEventName = DEFAULT_VAULT_DOCK_EXPAND_EVENT,
  LinkComponent,
  className,
  onLock,
  onStayUnlocked,
  sessionLease,
  redirectOnPasskeyUnlockFailure = DEFAULT_PASSKEY_REDIRECT_KINDS,
  shouldRedirectOnPasskeyUnlockFailure,
  onNavigateToUnlock,
  onPasskeyUnlockCancelled,
  passkeyAutoStartDelayMs = DEFAULT_PASSKEY_AUTO_START_DELAY_MS,
  onDuressSignalChange,
  renderQuickUnlock,
}: VaultStatusDockProps) {
  const labels = { ...DEFAULT_VAULT_STATUS_DOCK_LABELS, ...labelOverrides };
  const buildUnlockHref =
    buildUnlockHrefProp ?? ((returnPath: string) => buildVaultUnlockHref(unlockPath, returnPath));
  const clientStatus = useVaultClientStatus(serverStatus, prfSupported);
  const matchesFullUnlockPage =
    isFullUnlockPage ?? createVaultFullUnlockPageMatcher(unlockPath);
  const onFullUnlockPage = matchesFullUnlockPage(pathname);
  const isOpen = clientStatus === "unlocked" || clientStatus === "emergency_unlocked";
  const resolvedAutoLockMinutes = useVaultAutoLockMinutes(autoLockMinutes);
  const countdown = useVaultAutoLockCountdown(isOpen, resolvedAutoLockMinutes);
  const lockFraction = useVaultAutoLockFraction(isOpen, resolvedAutoLockMinutes);
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const expandedRootRef = useRef<HTMLDivElement>(null);
  const autoStartHandlerRef = useRef<(() => void) | null>(null);
  const pendingAutoStartRef = useRef(false);
  const autoStartConsumedRef = useRef(false);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartScopeKey = `${collapsedPreferenceKey}:passkey-auto-start`;
  const handleDuress = useLongPressDuressSignal();
  const [expansion, setExpansion] = useState<{
    status: VaultClientStatus;
    expanded: boolean;
  } | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSearch(window.location.search.replace(/^\?/, ""));
  }, [pathname]);

  const currentReturnPath = useMemo(
    () => buildCurrentReturnPath(pathname, search),
    [pathname, search]
  );

  const expanded = useMemo(() => {
    if (clientStatus === "not_setup" || clientStatus === "error") return false;
    if (
      onFullUnlockPage &&
      (clientStatus === "locked" ||
        clientStatus === "unsupported_prf" ||
        clientStatus === "emergency_locked")
    ) {
      return false;
    }
    if (expansion?.status === clientStatus) return expansion.expanded;
    const preference = readVaultStatusDockCollapsedPreference(collapsedPreferenceKey);
    return resolveExpanded(clientStatus, preference, onFullUnlockPage);
  }, [clientStatus, collapsedPreferenceKey, expansion, onFullUnlockPage]);

  const collapse = useCallback(() => {
    suppressVaultActivity();
    setExpansion({ status: clientStatus, expanded: false });
    writeVaultStatusDockCollapsedPreference(true, collapsedPreferenceKey);
    autoStartConsumedRef.current = false;
    pendingAutoStartRef.current = false;
    if (autoStartTimerRef.current) {
      clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
    handleDuress.resetDuressSignal();
    handleRef.current?.focus();
  }, [clientStatus, collapsedPreferenceKey, handleDuress]);

  useEffect(() => {
    onDuressSignalChange?.(handleDuress.duressSignaled);
  }, [handleDuress.duressSignaled, onDuressSignalChange]);

  const triggerPasskeyAutoStart = useCallback(() => {
    if (autoStartConsumedRef.current) return;
    if (!tryConsumePasskeyAutoStart(autoStartScopeKey)) {
      autoStartConsumedRef.current = true;
      return;
    }
    autoStartConsumedRef.current = true;
    pendingAutoStartRef.current = true;

    const fire = () => {
      if (!autoStartHandlerRef.current) return;
      pendingAutoStartRef.current = false;
      autoStartHandlerRef.current();
    };

    if (passkeyAutoStartDelayMs <= 0) {
      fire();
      return;
    }

    if (autoStartTimerRef.current) {
      clearTimeout(autoStartTimerRef.current);
    }
    autoStartTimerRef.current = setTimeout(() => {
      autoStartTimerRef.current = null;
      fire();
    }, passkeyAutoStartDelayMs);
  }, [autoStartScopeKey, passkeyAutoStartDelayMs]);

  const bindAutoStartPasskey = useCallback((handler: (() => void) | null) => {
    autoStartHandlerRef.current = handler;
    if (handler && pendingAutoStartRef.current && passkeyAutoStartDelayMs <= 0) {
      pendingAutoStartRef.current = false;
      handler();
    }
  }, [passkeyAutoStartDelayMs]);

  const expand = useCallback(() => {
    suppressVaultActivity();
    setExpansion({ status: clientStatus, expanded: true });
    writeVaultStatusDockCollapsedPreference(false, collapsedPreferenceKey);
    triggerPasskeyAutoStart();
  }, [clientStatus, collapsedPreferenceKey, triggerPasskeyAutoStart]);

  useEffect(() => subscribeVaultDockExpand(expand, expandEventName), [expand, expandEventName]);

  useLayoutEffect(() => {
    if (!expanded || onFullUnlockPage) return;
    if (
      clientStatus !== "locked" &&
      clientStatus !== "unsupported_prf" &&
      clientStatus !== "emergency_locked"
    ) {
      return;
    }
    if (!quickUnlockEnabled || serverStatus?.configured !== true) return;
    triggerPasskeyAutoStart();
  }, [
    clientStatus,
    expanded,
    onFullUnlockPage,
    quickUnlockEnabled,
    serverStatus?.configured,
    triggerPasskeyAutoStart,
  ]);

  useEffect(() => {
    if (
      !expanded ||
      !panelRef.current ||
      (clientStatus !== "locked" &&
        clientStatus !== "unsupported_prf" &&
        clientStatus !== "emergency_locked") ||
      onFullUnlockPage
    ) {
      return;
    }
    const input =
      panelRef.current.querySelector<HTMLElement>("input") ??
      panelRef.current.querySelector<HTMLElement>("button");
    input?.focus();
  }, [expanded, clientStatus, onFullUnlockPage]);

  const prevClientStatusRef = useRef<VaultClientStatus | null>(null);

  useEffect(() => {
    const previous = prevClientStatusRef.current;
    prevClientStatusRef.current = clientStatus;
    if (!expanded) return;
    if (
      previous === "unlocked" &&
      (clientStatus === "locked" ||
        clientStatus === "unsupported_prf" ||
        clientStatus === "emergency_locked")
    ) {
      collapse();
      return;
    }
    if (
      (previous === "locked" ||
        previous === "unsupported_prf" ||
        previous === "emergency_locked") &&
      (clientStatus === "unlocked" || clientStatus === "emergency_unlocked")
    ) {
      collapse();
    }
  }, [clientStatus, collapse, expanded]);

  const autoCollapseEnabled =
    expanded && vaultStatusDockAutoCollapseWhenExpanded(clientStatus);

  useVaultDockDismiss({
    rootRef: expandedRootRef,
    enabled: autoCollapseEnabled,
    shouldPreventDismiss: () => loading,
    onDismiss: collapse,
  });

  const unlockHref = useMemo(
    () => buildUnlockHref(currentReturnPath),
    [buildUnlockHref, currentReturnPath]
  );

  const handlePasskeyUnlockFailed = useCallback(
    (error: unknown) => {
      if (
        !shouldRedirectOnPasskeyFailure(
          error,
          redirectOnPasskeyUnlockFailure,
          shouldRedirectOnPasskeyUnlockFailure
        )
      ) {
        return;
      }
      collapse();
      navigateToVaultFullUnlock(unlockHref, onNavigateToUnlock);
    },
    [
      collapse,
      onNavigateToUnlock,
      redirectOnPasskeyUnlockFailure,
      shouldRedirectOnPasskeyUnlockFailure,
      unlockHref,
    ]
  );

  const handlePasskeyUnlockCancelled = useCallback(
    (error: unknown) => {
      onPasskeyUnlockCancelled?.(error);
    },
    [onPasskeyUnlockCancelled]
  );

  if (!visible) return null;
  if (clientStatus === "not_setup" || clientStatus === "error") return null;

  const status = clientStatus;
  const expandedCopy = getVaultStatusDockExpandedCopy(status, countdown, labels);
  const passkeyAvailability = resolveVaultDockPasskeyAvailability(serverStatus);
  const showQuickUnlock =
    quickUnlockEnabled &&
    (status === "locked" ||
      status === "unsupported_prf" ||
      status === "emergency_locked") &&
    serverStatus?.configured === true;
  const fullUnlockLinkLabel =
    passkeyAvailability.hasEnvelope && !passkeyAvailability.showPasskey
      ? labels.fullUnlockLink
      : labels.moreUnlockOptions;
  const Link = LinkComponent ?? "a";

  function lockNow() {
    lockVaultSessionManually();
    onLock?.();
    collapse();
  }

  function stayUnlocked() {
    touchVaultSession(sessionLease);
    onStayUnlocked?.();
  }

  function openFullUnlockPage() {
    collapse();
  }

  const rootClass = cn("vc-status-dock", className);

  function renderHandle(handleExpanded: boolean) {
    return (
      <button
        ref={handleRef}
        type="button"
        className={cn("vc-status-dock-handle", handleToneClass(status), rootClass)}
        data-vault-dock-ignore-activity
        data-testid="vault-status-dock-handle"
        data-vault-state={isOpen ? "open" : "locked"}
        aria-expanded={handleExpanded}
        aria-label={handleExpanded ? labels.collapseAriaLabel : labels.expandAriaLabel}
        onClick={handleExpanded ? undefined : expand}
        onPointerDown={handleDuress.onPointerDown}
        onPointerUp={handleDuress.onPointerUp}
        onPointerLeave={handleDuress.onPointerLeave}
        onPointerCancel={handleDuress.onPointerCancel}
      >
        <span className={cn("vc-status-dock-handle__icon", iconToneClass(status))}>
          <VaultStatusIcon status={status} />
        </span>
        <span className="vc-status-dock-handle__label">
          {isOpen ? labels.handleOpen : labels.handleLocked}
        </span>
        <span
          className={cn(
            "vc-status-dock-handle__time",
            !(isOpen && countdown) && "vc-status-dock-handle__time--reserved"
          )}
          aria-hidden={!(isOpen && countdown)}
        >
          {isOpen && countdown ? countdown : "0:00"}
        </span>
      </button>
    );
  }

  if (!expanded) {
    return renderHandle(false);
  }

  if (status === "unlocked" || status === "emergency_unlocked") {
    const ringCircumference = 2 * Math.PI * 16;
    const ringOffset = lockFraction === null ? 0 : ringCircumference * (1 - lockFraction);
    const stayMinutes = resolvedAutoLockMinutes;

    return (
      <div ref={expandedRootRef} className={cn("vc-status-dock-expanded", rootClass)}>
        {renderHandle(true)}
        <div
          ref={panelRef}
          className={cn(
            "vc-status-dock-panel vc-status-dock-panel--open vc-status-dock-panel--unlocked",
            rootClass
          )}
          data-vault-dock-ignore-activity
          data-testid="vault-status-dock"
          data-vault-state="open"
          data-expanded="true"
          role="status"
          aria-live="polite"
        >
        <div className="vc-status-dock-open-row">
          <div className="vc-status-dock-ring" aria-hidden="true">
            <svg width="38" height="38" viewBox="0 0 38 38">
              <circle cx="19" cy="19" r="16" fill="none" className="vc-status-dock-ring__track" strokeWidth="3" />
              <circle
                cx="19"
                cy="19"
                r="16"
                fill="none"
                className="vc-status-dock-ring__progress"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                transform="rotate(-90 19 19)"
              />
            </svg>
            <span className="vc-status-dock-ring__icon">
              <VaultStatusIcon status={status} />
            </span>
          </div>
          <div className="vc-status-dock-open-row__text">
            <div className="vc-status-dock-panel__title">{expandedCopy.title}</div>
            {countdown ? (
              <div className="vc-status-dock-panel__countdown">
                {labels.autoLocksIn(countdown)}
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={stayUnlocked}
          className="vc-status-dock__action vc-status-dock__action--subtle vc-status-dock__stay-unlocked"
        >
          {labels.stayUnlocked(stayMinutes)}
        </button>
        <button
          type="button"
          onClick={lockNow}
          className="vc-status-dock__action vc-status-dock__action--subtle vc-status-dock__lock-now"
        >
          <VaultStatusDockLockIcon />
          {labels.lockNow}
        </button>
        </div>
      </div>
    );
  }

  if (showQuickUnlock) {
    return (
      <div ref={expandedRootRef} className={cn("vc-status-dock-expanded", rootClass)}>
        {renderHandle(true)}
        <div
          ref={panelRef}
          className={cn(
            "vc-status-dock-panel vc-status-dock-panel--closed vc-status-dock-panel--unlocked",
            rootClass
          )}
          data-vault-dock-ignore-activity
          data-testid="vault-status-dock"
          data-vault-state="locked"
          data-expanded="true"
          role="status"
          aria-live="polite"
        >
          {renderQuickUnlock?.({
            loading,
            error: unlockError,
            serverStatus,
            collapse,
            fullUnlockHref: unlockHref,
            onPasskeyUnlockFailed: handlePasskeyUnlockFailed,
            onPasskeyUnlockCancelled: handlePasskeyUnlockCancelled,
            bindAutoStartPasskey,
            autoStartConsumed: autoStartConsumedRef.current,
            duressSignaled: handleDuress.duressSignaled,
            resetDuressSignal: handleDuress.resetDuressSignal,
          })}
          <p className="vc-status-dock-panel__fallback">
            <Link
              href={unlockHref}
              className="vc-status-dock-panel__fallback-link"
              onClick={openFullUnlockPage}
            >
              {fullUnlockLinkLabel}
          </Link>
        </p>
        </div>
      </div>
    );
  }

  return null;
}

/** Default full-unlock path matcher using unlockPath prop. */
export function createVaultFullUnlockPageMatcher(unlockPath: string) {
  return (pathname: string) => pathname === unlockPath;
}
