import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import type {
  PasskeyPrfEnvelope,
  PasswordEnvelope,
  RecoveryPhraseEnvelope,
  VaultDecoyRecord,
  VaultSetupWithDecoy,
} from "../validation/schemas.js";
import { unlockWithPasswordEnvelope } from "../envelopes/password.js";
import { unlockWithPasskeyPrfEnvelope } from "../envelopes/passkey-prf.js";
import { unlockWithRecoveryEnvelope } from "../envelopes/recovery.js";
import { resolveVaultUnlockTarget } from "./unlock-routing.js";
import {
  enterVaultEmergencyMode,
  isVaultEmergencyMode,
  lockVaultSession,
  unlockVaultSession,
  clearEmergencyModePin,
  type VaultSessionKeyRole,
} from "../session/auto-lock.js";
import { VaultAuthorizationError } from "../errors/vault-errors.js";

export type EmergencyUnlockPasswordInput = {
  record: VaultSetupWithDecoy;
  password: string;
  duressSequence?: string | null;
  emergencyModeActive: boolean;
  scope: Pick<VaultAadScope, "userId" | "resourceId">;
  profile: VaultCryptoProfile;
  /** Called after successful decoy unlock so consumer can persist server flag. */
  onEmergencyEntered?: () => void | Promise<void>;
};

export type EmergencyUnlockPasskeyInput = {
  record: VaultSetupWithDecoy;
  prfOutput: Uint8Array;
  duressSignaled?: boolean;
  emergencyModeActive: boolean;
  scope: Pick<VaultAadScope, "userId" | "resourceId">;
  profile: VaultCryptoProfile;
  onEmergencyEntered?: () => void | Promise<void>;
};

export type ExitEmergencyModeInput = {
  recoveryPhrase: string;
  /** Required when consumer configured recovery email for exit (consumer validates OTP). */
  emailOtp?: string;
  scope: Pick<VaultAadScope, "userId" | "resourceId">;
  profile: VaultCryptoProfile;
  primaryRecoveryEnvelope: RecoveryPhraseEnvelope;
  /** When true, {@link emailOtp} must be provided (consumer-prevalidated). */
  emailOtpRequired?: boolean;
};

function requireDecoy(record: VaultSetupWithDecoy): VaultDecoyRecord {
  if (!record.decoy) {
    throw new VaultAuthorizationError("Decoy vault is not configured.");
  }
  return record.decoy;
}

function selectPasswordEnvelope(
  record: VaultSetupWithDecoy,
  target: "primary" | "decoy"
): PasswordEnvelope {
  if (target === "decoy") {
    return requireDecoy(record).passwordEnvelope;
  }
  return record.passwordEnvelope;
}

function selectPasskeyEnvelope(
  record: VaultSetupWithDecoy,
  target: "primary" | "decoy"
): PasskeyPrfEnvelope {
  const envelope =
    target === "decoy"
      ? requireDecoy(record).passkeyPrfEnvelope ?? record.passkeyPrfEnvelope
      : record.passkeyPrfEnvelope;
  if (!envelope) {
    throw new VaultAuthorizationError("Passkey unlock is not configured for this vault.");
  }
  return envelope;
}

async function finalizeUnlock(
  vaultKey: CryptoKey,
  role: VaultSessionKeyRole,
  enteredEmergency: boolean,
  onEmergencyEntered?: () => void | Promise<void>
): Promise<CryptoKey> {
  await unlockVaultSession(vaultKey, { role });
  if (enteredEmergency) {
    await onEmergencyEntered?.();
  }
  return vaultKey;
}

/**
 * Password unlock with emergency-aware envelope routing.
 */
export async function unlockVaultWithPasswordRouting(
  input: EmergencyUnlockPasswordInput
): Promise<CryptoKey> {
  const target = resolveVaultUnlockTarget({
    password: input.password,
    duressSequence: input.duressSequence,
    emergencyModeActive: input.emergencyModeActive || isVaultEmergencyMode(),
  });

  const envelope = selectPasswordEnvelope(input.record, target);
  const vaultKey = await unlockWithPasswordEnvelope(
    input.password,
    envelope,
    input.scope,
    input.profile
  );

  const role: VaultSessionKeyRole = target === "decoy" ? "decoy" : "primary";
  const enteredEmergency = target === "decoy";
  if (enteredEmergency) {
    enterVaultEmergencyMode();
  }

  return finalizeUnlock(vaultKey, role, enteredEmergency, input.onEmergencyEntered);
}

/**
 * Passkey PRF unlock with emergency-aware envelope routing.
 */
export async function unlockVaultWithPasskeyRouting(
  input: EmergencyUnlockPasskeyInput
): Promise<CryptoKey> {
  const target = resolveVaultUnlockTarget({
    duressSignaled: input.duressSignaled,
    emergencyModeActive: input.emergencyModeActive || isVaultEmergencyMode(),
  });

  const envelope = selectPasskeyEnvelope(input.record, target);
  const vaultKey = await unlockWithPasskeyPrfEnvelope(
    envelope,
    input.prfOutput,
    input.scope,
    input.profile
  );

  const role: VaultSessionKeyRole = target === "decoy" ? "decoy" : "primary";
  const enteredEmergency = target === "decoy";
  if (enteredEmergency) {
    enterVaultEmergencyMode();
  }

  return finalizeUnlock(vaultKey, role, enteredEmergency, input.onEmergencyEntered);
}

/**
 * Verifies the primary recovery phrase and exits emergency mode.
 * Normal vault password does not clear emergency — only this flow.
 */
export async function exitEmergencyMode(input: ExitEmergencyModeInput): Promise<void> {
  if (!isVaultEmergencyMode()) {
    return;
  }

  if (input.emailOtpRequired && !input.emailOtp) {
    throw new VaultAuthorizationError("Email verification is required to exit emergency mode.");
  }

  await unlockWithRecoveryEnvelope(
    input.recoveryPhrase,
    input.primaryRecoveryEnvelope,
    input.scope,
    input.profile
  );

  lockVaultSession();
  clearEmergencyModePin();
}

/**
 * Apply server-persisted emergency flag on app hydration (before unlock).
 */
export function hydrateVaultEmergencyModeFromServer(emergencyModeActive: boolean): void {
  if (emergencyModeActive) {
    enterVaultEmergencyMode();
  }
}
