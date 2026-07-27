import { beforeEach, describe, expect, it } from "vitest";
import { createUserVaultKey } from "../../index.js";
import { createPasskeyPrfEnvelopeWithSessionCache } from "../../envelopes/passkey-prf.js";
import {
  beginVaultSessionOperation,
  clearVaultSessionOwner,
} from "../../session/auto-lock.js";
import {
  isVaultSessionOperationCurrent,
  resetVaultSessionOperationsForTests,
  VaultSessionOperationCancelledError,
} from "../../session/vault-session-operation.js";
import {
  FIXTURE_PRF_OUTPUT,
  LIQSENSE_COMPAT_PROFILE,
  LIQSENSE_COMPAT_SCOPE,
} from "../../testing/fixtures/liqsense-compat.js";

describe("passkey envelope session operation ownership", () => {
  beforeEach(() => {
    clearVaultSessionOwner();
    resetVaultSessionOperationsForTests();
  });

  it("does not return an A envelope after B supersedes the operation", async () => {
    const vaultKey = await createUserVaultKey();
    const operationA = beginVaultSessionOperation("account-A");
    const envelopeA = createPasskeyPrfEnvelopeWithSessionCache(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      undefined,
      { operation: operationA }
    );

    const operationB = beginVaultSessionOperation("account-B");

    await expect(envelopeA).rejects.toBeInstanceOf(
      VaultSessionOperationCancelledError
    );
    expect(isVaultSessionOperationCurrent(operationB)).toBe(true);
  });

  it("requires an operation after the consumer opts into ownership", async () => {
    const vaultKey = await createUserVaultKey();
    beginVaultSessionOperation("account-A");

    await expect(
      createPasskeyPrfEnvelopeWithSessionCache(
        vaultKey,
        FIXTURE_PRF_OUTPUT,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toMatchObject({ reason: "missing_operation" });
  });
});
