"use client";

import {
  useCallback,
  useEffect,
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
import { buildVaultUnlockHref } from "../unlock/vault-unlock-routes.js";
import { navigateToVaultFullUnlock } from "./navigate-to-full-unlock.js";

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
  /**
   * When dock passkey unlock is cancelled or fails, navigates to the full unlock page with the
   * current return path. Set to `false` to disable. Defaults to `true`.
   */
  redirectOnPasskeyUnlockFailure?: boolean;
  /** App navigation for full unlock redirect (for example Next.js `router.push`). */
  onNavigateToUnlock?: (href: string) => void;
  /** Custom quick-unlock slot; defaults to none (link to full unlock only). */
  renderQuickUnlock?: (context: {
    loading: boolean;
    error: string | null;
    serverStatus: VaultServerStatusSnapshot | null;
    collapse: () => void;
    fullUnlockHref: string;
    onPasskeyUnlockFailed: (error: unknown) => void;
  }) => ReactNode;
};

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function iconToneClass(clientStatus: VaultClientStatus): string {
  switch (clientStatus) {
    case "unlocked":
      return "vc-status-dock__icon--open";
    case "locked":
    case "unsupported_prf":
      return "vc-status-dock__icon--closed";
    default:
      return "vc-status-dock__icon--muted";
  }
}

function handleToneClass(clientStatus: VaultClientStatus): string {
  switch (clientStatus) {
    case "unlocked":
      return "vc-status-dock-handle--open";
    case "locked":
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
  redirectOnPasskeyUnlockFailure = true,
  onNavigateToUnlock,
  renderQuickUnlock,
}: VaultStatusDockProps) {
  const labels = { ...DEFAULT_VAULT_STATUS_DOCK_LABELS, ...labelOverrides };
  const buildUnlockHref =
    buildUnlockHrefProp ?? ((returnPath: string) => buildVaultUnlockHref(unlockPath, returnPath));
  const clientStatus = useVaultClientStatus(serverStatus, prfSupported);
  const matchesFullUnlockPage =
    isFullUnlockPage ?? createVaultFullUnlockPageMatcher(unlockPath);
  const onFullUnlockPage = matchesFullUnlockPage(pathname);
  const isOpen = clientStatus === "unlocked";
  const resolvedAutoLockMinutes = useVaultAutoLockMinutes(autoLockMinutes);
  const countdown = useVaultAutoLockCountdown(isOpen, resolvedAutoLockMinutes);
  const lockFraction = useVaultAutoLockFraction(isOpen, resolvedAutoLockMinutes);
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const expandedRootRef = useRef<HTMLDivElement>(null);
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
    if (onFullUnlockPage && (clientStatus === "locked" || clientStatus === "unsupported_prf")) {
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
    handleRef.current?.focus();
  }, [clientStatus, collapsedPreferenceKey]);

  const expand = useCallback(() => {
    suppressVaultActivity();
    setExpansion({ status: clientStatus, expanded: true });
    writeVaultStatusDockCollapsedPreference(false, collapsedPreferenceKey);
  }, [clientStatus, collapsedPreferenceKey]);

  useEffect(() => subscribeVaultDockExpand(expand, expandEventName), [expand, expandEventName]);

  useEffect(() => {
    if (
      !expanded ||
      !panelRef.current ||
      (clientStatus !== "locked" && clientStatus !== "unsupported_prf") ||
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
      (clientStatus === "locked" || clientStatus === "unsupported_prf")
    ) {
      collapse();
      return;
    }
    if (
      (previous === "locked" || previous === "unsupported_prf") &&
      clientStatus === "unlocked"
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
    (_error: unknown) => {
      if (!redirectOnPasskeyUnlockFailure) return;
      collapse();
      navigateToVaultFullUnlock(unlockHref, onNavigateToUnlock);
    },
    [collapse, onNavigateToUnlock, redirectOnPasskeyUnlockFailure, unlockHref]
  );

  if (!visible) return null;
  if (clientStatus === "not_setup" || clientStatus === "error") return null;

  const status = clientStatus;
  const expandedCopy = getVaultStatusDockExpandedCopy(status, countdown, labels);
  const passkeyAvailability = resolveVaultDockPasskeyAvailability(serverStatus);
  const showQuickUnlock =
    quickUnlockEnabled &&
    (status === "locked" || status === "unsupported_prf") &&
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
    touchVaultSession();
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

  if (status === "unlocked") {
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
