"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { requestVaultDockExpand, DEFAULT_VAULT_DOCK_EXPAND_EVENT } from "../status-dock/events.js";
import { useVaultUnlocked } from "../session/use-vault-unlocked.js";
import { shouldVaultLockOverlayExpandDock } from "./should-vault-lock-overlay-expand-dock.js";
import { useVaultLockOverlayPanels } from "./use-vault-lock-overlay-panels.js";

export type VaultProtectedGateProps = {
  children: ReactNode;
  /**
   * Vault setup state. When `false`, redirects to `redirectToSetup`.
   * When `null`, shows `loadingFallback` (use while resolving setup status).
   * When omitted or `true`, only the lock overlay applies.
   */
  configured?: boolean | null;
  /** Path to redirect when `configured` is `false`. */
  redirectToSetup?: string;
  /** App router callback for setup redirect (e.g. Next.js `router.replace`). */
  onRedirectToSetup?: (path: string) => void;
  /** Expand the vault status dock on Enter while locked. Defaults to `requestVaultDockExpand`. */
  onExpandDock?: () => void;
  expandEventName?: string;
  className?: string;
  /** Extra class names on each lock overlay panel element. */
  overlayClassName?: string;
  /**
   * Lock overlay background color. Sets `--vc-vault-lock-overlay-color` on each overlay panel.
   * Use any valid CSS color or `color-mix()` expression (for example
   * `color-mix(in srgb, var(--background) 92%, transparent)`).
   */
  overlayBackground?: string;
  loadingFallback?: ReactNode;
};

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const DEFAULT_LOADING = (
  <p className="vc-vault-protected-gate__loading">Checking vault session…</p>
);

/** Wraps vault-protected page content; shows a blur overlay while the vault is locked. */
export function VaultProtectedGate({
  children,
  configured,
  redirectToSetup,
  onRedirectToSetup,
  onExpandDock,
  expandEventName = DEFAULT_VAULT_DOCK_EXPAND_EVENT,
  className,
  overlayClassName,
  overlayBackground,
  loadingFallback = DEFAULT_LOADING,
}: VaultProtectedGateProps) {
  const unlocked = useVaultUnlocked();
  const locked = !unlocked;
  const awaitingSetup = configured === null;
  const needsSetup = configured === false;
  const overlayPanels = useVaultLockOverlayPanels(locked && !awaitingSetup && !needsSetup);

  useEffect(() => {
    if (!needsSetup || !redirectToSetup) return;
    if (onRedirectToSetup) {
      onRedirectToSetup(redirectToSetup);
      return;
    }
    if (typeof window !== "undefined") {
      window.location.assign(redirectToSetup);
    }
  }, [needsSetup, onRedirectToSetup, redirectToSetup]);

  useEffect(() => {
    if (!locked || awaitingSetup || needsSetup) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!shouldVaultLockOverlayExpandDock(event)) return;
      event.preventDefault();
      if (onExpandDock) {
        onExpandDock();
      } else {
        requestVaultDockExpand(expandEventName);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [awaitingSetup, expandEventName, locked, needsSetup, onExpandDock]);

  if (awaitingSetup) {
    return <>{loadingFallback}</>;
  }

  if (needsSetup) {
    return <>{loadingFallback}</>;
  }

  const overlayStyle = overlayBackground
    ? ({ "--vc-vault-lock-overlay-color": overlayBackground } as CSSProperties)
    : undefined;

  const overlay =
    locked && typeof document !== "undefined"
      ? createPortal(
          <>
            {overlayPanels.map((panel, index) => (
              <div
                key={`${panel.top}-${panel.left}-${index}`}
                className={cn("vc-vault-lock-overlay", overlayClassName)}
                style={{
                  ...overlayStyle,
                  top: panel.top,
                  left: panel.left,
                  width: panel.width,
                  height: panel.height,
                }}
                data-testid={index === 0 ? "vault-lock-overlay" : undefined}
                aria-hidden="true"
              />
            ))}
          </>,
          document.body
        )
      : null;

  return (
    <div
      className={cn("vc-vault-protected-gate", className)}
      data-vault-protected-locked={locked ? "true" : "false"}
    >
      <div
        className={cn(
          "vc-vault-protected-gate__content",
          locked && "vc-vault-protected-gate__content--locked"
        )}
        {...(locked ? { inert: true as const, "aria-hidden": true } : {})}
      >
        {children}
      </div>
      {overlay}
    </div>
  );
}
