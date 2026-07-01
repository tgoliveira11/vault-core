"use client";

import type { ReactNode } from "react";
import { VAULT_LOCK_OVERLAY_EXCLUDE_ATTR } from "./overlay-exclude.js";

export type VaultLockOverlayExcludeProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Wraps app chrome (navigation, vault dock host, etc.) that must stay visible and
 * interactive while `VaultProtectedGate` shows the lock overlay.
 *
 * Mount **outside** the gate's inert content — typically as a sibling above protected
 * page content in the layout.
 */
export function VaultLockOverlayExclude({ children, className }: VaultLockOverlayExcludeProps) {
  return (
    <div
      className={className ? `vc-vault-lock-overlay-exclude ${className}` : "vc-vault-lock-overlay-exclude"}
      {...{ [VAULT_LOCK_OVERLAY_EXCLUDE_ATTR]: "true" }}
    >
      {children}
    </div>
  );
}
