import { useEffect, useState } from "react";
import {
  getVaultAutoLockMinutes,
  getVaultAutoLockRemainingMs,
  subscribeVaultSession,
} from "../../browser.js";
import { formatAutoLockCountdown } from "./format-auto-lock-countdown.js";

function useAutoLockTick(active: boolean): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;

    function refresh() {
      setTick((value) => value + 1);
    }

    refresh();
    const unsubSession = subscribeVaultSession(refresh);
    const interval = window.setInterval(refresh, 1000);

    return () => {
      unsubSession();
      window.clearInterval(interval);
    };
  }, [active]);
}

function resolveAutoLockTimeoutMs(autoLockMinutes?: number): number {
  return resolveVaultAutoLockMinutes(autoLockMinutes) * 60 * 1000;
}

/**
 * Resolves auto-lock minutes for dock UI. An explicit positive `overrideMinutes` wins;
 * otherwise uses `configureVaultSession()` / `VaultSessionProvider` session config.
 */
export function resolveVaultAutoLockMinutes(overrideMinutes?: number): number {
  if (
    overrideMinutes != null &&
    Number.isFinite(overrideMinutes) &&
    overrideMinutes > 0
  ) {
    return overrideMinutes;
  }
  return getVaultAutoLockMinutes();
}

/** Live resolved auto-lock minutes for dock labels and progress ring denominator. */
export function useVaultAutoLockMinutes(overrideMinutes?: number): number {
  const [, setTick] = useState(0);

  useEffect(() => subscribeVaultSession(() => setTick((value) => value + 1)), []);

  return resolveVaultAutoLockMinutes(overrideMinutes);
}

/** Live countdown until vault auto-lock after inactivity. */
export function useVaultAutoLockCountdown(
  active: boolean,
  autoLockMinutes?: number
): string | null {
  useAutoLockTick(active);

  if (!active) return null;

  const remainingMs = getVaultAutoLockRemainingMs();
  if (remainingMs === null) return null;
  return formatAutoLockCountdown(remainingMs);
}

/**
 * Live fraction (0..1) of the auto-lock window still remaining. Drives the
 * circular countdown ring in the expanded vault dock.
 */
export function useVaultAutoLockFraction(
  active: boolean,
  autoLockMinutes?: number
): number | null {
  useAutoLockTick(active);

  if (!active) return null;
  const remainingMs = getVaultAutoLockRemainingMs();
  if (remainingMs === null) return null;
  const totalMs = resolveAutoLockTimeoutMs(autoLockMinutes);
  return Math.max(0, Math.min(1, remainingMs / totalMs));
}
