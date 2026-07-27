import type { VaultSessionKeyRole } from "./memory-session.js";

const vaultSessionOperationBrand: unique symbol = Symbol("vault-session-operation");
const vaultSessionLeaseBrand: unique symbol = Symbol("vault-session-lease");

/** Opaque epoch token for one account-owned browser vault operation. */
export type VaultSessionOperation = Readonly<{
  [vaultSessionOperationBrand]: true;
}>;

/** Canonical name for an operation token used by one outer unlock/finalize attempt. */
export type VaultSessionUnlockAttempt = VaultSessionOperation;

/**
 * Owner-bound capability for the currently installed browser vault session.
 * The CryptoKey remains non-extractable.
 */
export type VaultSessionLease = Readonly<{
  ownerId: string;
  epoch: number;
  role: VaultSessionKeyRole;
  vaultKey: CryptoKey;
  [vaultSessionLeaseBrand]: true;
}>;

export type VaultSessionSnapshot = Readonly<{
  ownerId: string;
  epoch: number;
  role: VaultSessionKeyRole;
}>;

export type VaultSessionMutationOptions = {
  operation?: VaultSessionOperation;
};

export type VaultSessionOperationCancellationReason =
  | "missing_operation"
  | "stale_operation";

export class VaultSessionOperationCancelledError extends Error {
  readonly code = "vault_session_operation_cancelled" as const;

  constructor(readonly reason: VaultSessionOperationCancellationReason) {
    super(
      reason === "missing_operation"
        ? "A current vault session operation is required for this mutation."
        : "This vault session operation was cancelled by a newer operation or lock."
    );
    this.name = "VaultSessionOperationCancelledError";
  }
}

type VaultSessionOperationMetadata = {
  epoch: number;
  ownerId: string;
};

const operationMetadata = new WeakMap<object, VaultSessionOperationMetadata>();
const leaseMetadata = new WeakMap<object, VaultSessionLease>();
let currentEpoch = 0;
let currentOwnerId: string | null = null;
let currentOperation: VaultSessionOperation | null = null;
let currentLease: VaultSessionLease | null = null;
let ownershipModeEnabled = false;

/** @internal Shared validation before an owner transition mutates browser state. */
export function assertVaultSessionOperationOwnerId(ownerId: string): void {
  if (
    typeof ownerId !== "string" ||
    ownerId.length === 0 ||
    ownerId.length > 2048 ||
    ownerId.trim() !== ownerId
  ) {
    throw new TypeError("Vault session operation ownerId must be a non-empty opaque identifier");
  }
}

/** @internal Issue a token after the session layer has handled any owner transition. */
export function issueVaultSessionOperation(ownerId: string): VaultSessionOperation {
  assertVaultSessionOperationOwnerId(ownerId);
  ownershipModeEnabled = true;
  currentEpoch += 1;
  currentOwnerId = ownerId;
  const operation = Object.freeze({
    [vaultSessionOperationBrand]: true,
  }) as VaultSessionOperation;
  operationMetadata.set(operation, { epoch: currentEpoch, ownerId });
  currentOperation = operation;
  return operation;
}

/** @internal Commit an owner-bound lease only after the session key mutation is ready to install. */
export function commitVaultSessionLease(
  operation: VaultSessionOperation | undefined,
  vaultKey: CryptoKey,
  role: VaultSessionKeyRole
): VaultSessionLease | null {
  assertVaultSessionMutationAllowed(operation);
  if (!operation) {
    currentLease = null;
    return null;
  }
  const metadata = operationMetadata.get(operation);
  if (!metadata) {
    throw new VaultSessionOperationCancelledError("stale_operation");
  }
  const lease = Object.freeze({
    ownerId: metadata.ownerId,
    epoch: metadata.epoch,
    role,
    vaultKey,
    [vaultSessionLeaseBrand]: true,
  }) as VaultSessionLease;
  leaseMetadata.set(lease, lease);
  currentLease = lease;
  return lease;
}

/** @internal Lock and owner transitions invalidate access to the installed key. */
export function invalidateVaultSessionLease(): void {
  currentLease = null;
}

/** @internal Invalidate async work while retaining the active owner across an ordinary lock. */
export function invalidateVaultSessionOperation(): void {
  currentEpoch += 1;
  currentOperation = null;
}

/** @internal Clear ownership on logout/account removal after session state has been purged. */
export function clearVaultSessionOperationOwner(): void {
  invalidateVaultSessionOperation();
  currentOwnerId = null;
}

/** @internal Used by the browser session layer to detect A → B transitions. */
export function getVaultSessionOperationOwner(): string | null {
  return currentOwnerId;
}

export function isVaultSessionOperationCurrent(
  operation: VaultSessionOperation
): boolean {
  const metadata = operationMetadata.get(operation);
  return Boolean(
    metadata &&
      operation === currentOperation &&
      metadata.epoch === currentEpoch &&
      metadata.ownerId === currentOwnerId
  );
}

export function assertVaultSessionOperationCurrent(
  operation: VaultSessionOperation
): void {
  if (!isVaultSessionOperationCurrent(operation)) {
    throw new VaultSessionOperationCancelledError("stale_operation");
  }
}

/** Canonical unlock-attempt aliases. */
export const isVaultSessionUnlockAttemptCurrent = isVaultSessionOperationCurrent;
export const assertVaultSessionUnlockAttemptCurrent =
  assertVaultSessionOperationCurrent;

export function isVaultSessionLeaseCurrent(lease: VaultSessionLease): boolean {
  const metadata = leaseMetadata.get(lease);
  return Boolean(
    metadata &&
      metadata === currentLease &&
      lease === currentLease &&
      lease.ownerId === currentOwnerId
  );
}

export function assertVaultSessionLeaseCurrent(lease: VaultSessionLease): void {
  if (!isVaultSessionLeaseCurrent(lease)) {
    throw new VaultSessionOperationCancelledError("stale_operation");
  }
}

export function captureVaultSessionLease(ownerId: string): VaultSessionLease {
  assertVaultSessionOperationOwnerId(ownerId);
  if (!currentLease || currentLease.ownerId !== ownerId) {
    throw new VaultSessionOperationCancelledError("stale_operation");
  }
  assertVaultSessionLeaseCurrent(currentLease);
  return currentLease;
}

export function getVaultSessionSnapshot(): VaultSessionSnapshot | null {
  if (!currentLease) return null;
  return Object.freeze({
    ownerId: currentLease.ownerId,
    epoch: currentLease.epoch,
    role: currentLease.role,
  });
}

/** @internal Fail closed after a consumer opts into owner-scoped operations. */
export function assertVaultSessionMutationAllowed(
  operation?: VaultSessionOperation
): void {
  if (operation) {
    assertVaultSessionOperationCurrent(operation);
    return;
  }
  if (ownershipModeEnabled) {
    throw new VaultSessionOperationCancelledError("missing_operation");
  }
}

/** @internal Fail closed for post-unlock session mutations after owner-scoped opt-in. */
export function assertVaultSessionLeaseMutationAllowed(
  lease?: VaultSessionLease
): void {
  if (lease) {
    assertVaultSessionLeaseCurrent(lease);
    return;
  }
  if (ownershipModeEnabled) {
    throw new VaultSessionOperationCancelledError("missing_operation");
  }
}

/** @internal Test isolation helper. */
export function resetVaultSessionOperationsForTests(): void {
  currentEpoch = 0;
  currentOwnerId = null;
  currentOperation = null;
  currentLease = null;
  ownershipModeEnabled = false;
}
