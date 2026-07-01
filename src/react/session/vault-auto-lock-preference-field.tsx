"use client";

import { useId } from "react";
import { VAULT_USER_AUTO_LOCK_MIN_MINUTES } from "../../session/user-auto-lock-preference.js";

export type VaultAutoLockPreferenceFieldProps = {
  value: number;
  onChange: (minutes: number) => void;
  /** Admin-resolved ceiling (admin → env → default). */
  adminMaxMinutes: number;
  minMinutes?: number;
  disabled?: boolean;
  className?: string;
  /** When set, shown when the user has not overridden the admin default. */
  adminDefaultMinutes?: number;
  usingUserPreference?: boolean;
};

export function VaultAutoLockPreferenceField({
  value,
  onChange,
  adminMaxMinutes,
  minMinutes = VAULT_USER_AUTO_LOCK_MIN_MINUTES,
  disabled = false,
  className,
  adminDefaultMinutes,
  usingUserPreference = false,
}: VaultAutoLockPreferenceFieldProps) {
  const inputId = useId();
  const max = Math.max(minMinutes, adminMaxMinutes);

  return (
    <div className={className ?? "vc-auto-lock-preference"}>
      <div className="vc-auto-lock-preference-header">
        <label className="vc-auto-lock-preference-label" htmlFor={inputId}>
          Auto-lock after inactivity
        </label>
        <output className="vc-auto-lock-preference-value" htmlFor={inputId}>
          {value} min
        </output>
      </div>
      <input
        id={inputId}
        type="range"
        className="vc-auto-lock-preference-slider"
        min={minMinutes}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
        aria-valuemin={minMinutes}
        aria-valuemax={max}
        aria-valuenow={value}
      />
      <p className="vc-auto-lock-preference-hint">
        Range: {minMinutes}–{max} minutes.
        {adminDefaultMinutes != null ? (
          <>
            {" "}
            Organization default: {adminDefaultMinutes} min
            {usingUserPreference ? " (overridden by your preference)" : ""}.
          </>
        ) : null}
      </p>
    </div>
  );
}
