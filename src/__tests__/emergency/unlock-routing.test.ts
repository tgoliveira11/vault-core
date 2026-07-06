import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPrimaryDecoyVaultFixture,
  HONEY_VAULT_SENTINEL_NOTE,
  PRIMARY_VAULT_SENTINEL_NOTE,
} from "../../testing/emergency-fixtures.js";
import { createNonExtractableSessionVaultKey } from "../../testing/session-vault-key.js";
import {
  decryptVaultPayloadForSession,
  DuressPasswordMissingSequenceError,
  createDecoyVaultSetup,
  resolveVaultUnlockTarget,
  resolveSessionEncryptedBlob,
  VaultAuthorizationError,
  VaultEmergencyDecryptError,
} from "../../index.js";
import {
  clearEmergencyModePin,
  exitEmergencyMode,
  getSessionVaultKey,
  hydrateVaultEmergencyModeFromServer,
  isVaultEmergencyMode,
  lockVaultSession,
  unlockVaultWithPasskeyRouting,
  unlockVaultWithPasswordRouting,
} from "../../browser.js";
import { z } from "zod";
import type { VaultCryptoProfile } from "../../profile.js";

const scope = {
  userId: "00000000-0000-4000-8000-000000000099",
  resourceId: "00000000-0000-4000-8000-000000000098",
};
const profile: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "test:vault:v1",
  aadContextEnvelope: "test:envelope:v1",
};

const payloadSchema = z.object({
  version: z.literal(1),
  sentinel: z.string(),
});

describe("emergency unlock routing", () => {
  beforeEach(() => {
    lockVaultSession();
    clearEmergencyModePin();
  });

  it("routes duress password to decoy vault", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });

    await unlockVaultWithPasswordRouting({
      record: fixture.record,
      password: fixture.duressPassword,
      duressSequence: fixture.duressSequence,
      emergencyModeActive: false,
      scope,
      profile,
    });

    const payload = await decryptVaultPayloadForSession({
      record: fixture.record,
      vaultKey: getSessionVaultKey()!,
      scope,
      profile,
      schema: payloadSchema,
    });

    expect(payload.sentinel).toBe(HONEY_VAULT_SENTINEL_NOTE);
  });

  it("routes normal password to primary vault", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });

    await unlockVaultWithPasswordRouting({
      record: fixture.record,
      password: fixture.primaryPassword,
      duressSequence: fixture.duressSequence,
      emergencyModeActive: false,
      scope,
      profile,
    });

    const payload = await decryptVaultPayloadForSession({
      record: fixture.record,
      vaultKey: getSessionVaultKey()!,
      scope,
      profile,
      schema: payloadSchema,
    });

    expect(payload.sentinel).toBe(PRIMARY_VAULT_SENTINEL_NOTE);
  });

  it("routes to decoy when emergencyModeActive is pinned", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });

    await unlockVaultWithPasswordRouting({
      record: fixture.record,
      password: fixture.duressPassword,
      duressSequence: fixture.duressSequence,
      emergencyModeActive: true,
      scope,
      profile,
    });

    expect(isVaultEmergencyMode()).toBe(true);
  });

  it("refuses primary decrypt when emergency active", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });

    await unlockVaultWithPasswordRouting({
      record: fixture.record,
      password: fixture.duressPassword,
      duressSequence: fixture.duressSequence,
      emergencyModeActive: false,
      scope,
      profile,
    });

    const { assertSessionPayloadDecryptAllowed } = await import(
      "../../emergency/unlock-routing.js"
    );
    expect(() =>
      assertSessionPayloadDecryptAllowed({
        mode: "emergency",
        targetBlob: fixture.record.encryptedBlob,
        primaryBlob: fixture.record.encryptedBlob,
      })
    ).toThrow(VaultEmergencyDecryptError);
  });

  it("exits emergency mode with primary recovery phrase", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });

    await unlockVaultWithPasswordRouting({
      record: fixture.record,
      password: fixture.duressPassword,
      duressSequence: fixture.duressSequence,
      emergencyModeActive: false,
      scope,
      profile,
    });

    await exitEmergencyMode({
      recoveryPhrase: fixture.primaryRecoveryPhrase,
      scope,
      profile,
      primaryRecoveryEnvelope: fixture.record.recoveryEnvelope,
    });

    expect(isVaultEmergencyMode()).toBe(false);
    expect(getSessionVaultKey()).toBeNull();
  });

  it("requires email OTP when configured", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });
    await unlockVaultWithPasswordRouting({
      record: fixture.record,
      password: fixture.duressPassword,
      duressSequence: fixture.duressSequence,
      emergencyModeActive: false,
      scope,
      profile,
    });

    await expect(
      exitEmergencyMode({
        recoveryPhrase: fixture.primaryRecoveryPhrase,
        scope,
        profile,
        primaryRecoveryEnvelope: fixture.record.recoveryEnvelope,
        emailOtpRequired: true,
      })
    ).rejects.toThrow(VaultAuthorizationError);
  });

  it("hydrates emergency mode from server flag", () => {
    hydrateVaultEmergencyModeFromServer(true);
    expect(isVaultEmergencyMode()).toBe(true);
    hydrateVaultEmergencyModeFromServer(false);
  });

  it("resolveVaultUnlockTarget handles passkey duress latch", () => {
    expect(
      resolveVaultUnlockTarget({ emergencyModeActive: false, duressSignaled: true })
    ).toBe("decoy");
    expect(
      resolveVaultUnlockTarget({
        emergencyModeActive: false,
        password: "x",
        duressSequence: "911",
      })
    ).toBe("primary");
  });

  it("resolveSessionEncryptedBlob throws without decoy blob", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });
    expect(() =>
      resolveSessionEncryptedBlob({
        mode: "emergency",
        primaryBlob: fixture.record.encryptedBlob,
        decoyBlob: null,
      })
    ).toThrow(VaultEmergencyDecryptError);
  });

  it("createDecoyVaultSetup rejects password without sequence", async () => {
    await expect(
      createDecoyVaultSetup({
        duressPassword: "NoSequenceHere!",
        duressSequence: "911",
        honeyPayload: { version: 1, sentinel: "honey" },
        scope,
        profile,
      })
    ).rejects.toThrow(DuressPasswordMissingSequenceError);
  });

  it("rejects unlock when decoy not configured but routing requires decoy", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });
    const recordWithoutDecoy = { ...fixture.record, decoy: undefined };

    await expect(
      unlockVaultWithPasswordRouting({
        record: recordWithoutDecoy,
        password: fixture.duressPassword,
        duressSequence: fixture.duressSequence,
        emergencyModeActive: true,
        scope,
        profile,
      })
    ).rejects.toThrow(VaultAuthorizationError);
  });

  it("rejects passkey unlock when no envelope configured", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });
    const record = { ...fixture.record, passkeyPrfEnvelope: null, decoy: null };

    await expect(
      unlockVaultWithPasskeyRouting({
        record,
        prfOutput: new Uint8Array(32),
        duressSignaled: false,
        emergencyModeActive: false,
        scope,
        profile,
      })
    ).rejects.toThrow(VaultAuthorizationError);
  });

  it("calls onEmergencyEntered callback", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });
    let called = false;

    await unlockVaultWithPasswordRouting({
      record: fixture.record,
      password: fixture.duressPassword,
      duressSequence: fixture.duressSequence,
      emergencyModeActive: false,
      scope,
      profile,
      onEmergencyEntered: () => {
        called = true;
      },
    });

    expect(called).toBe(true);
  });

  it("exitEmergencyMode is no-op when not in emergency", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });
    await exitEmergencyMode({
      recoveryPhrase: fixture.primaryRecoveryPhrase,
      scope,
      profile,
      primaryRecoveryEnvelope: fixture.record.recoveryEnvelope,
    });
    expect(isVaultEmergencyMode()).toBe(false);
  });

  it("exits with email OTP when required", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });
    await unlockVaultWithPasswordRouting({
      record: fixture.record,
      password: fixture.duressPassword,
      duressSequence: fixture.duressSequence,
      emergencyModeActive: false,
      scope,
      profile,
    });

    await exitEmergencyMode({
      recoveryPhrase: fixture.primaryRecoveryPhrase,
      emailOtp: "123456",
      scope,
      profile,
      primaryRecoveryEnvelope: fixture.record.recoveryEnvelope,
      emailOtpRequired: true,
    });

    expect(isVaultEmergencyMode()).toBe(false);
  });

  it("passkey routing uses duress latch", async () => {
    const fixture = await createPrimaryDecoyVaultFixture({ scope, profile });
    const { createPasskeyPrfEnvelope, createUserVaultKey } = await import("../../index.js");
    const vaultKey = await createUserVaultKey();
    const prfOutput = new Uint8Array(32).fill(7);
    const envelope = await createPasskeyPrfEnvelope(vaultKey, prfOutput, scope, profile);
    const record = { ...fixture.record, passkeyPrfEnvelope: envelope };

    const passkeyModule = await import("../../envelopes/passkey-prf.js");
    const spy = vi.spyOn(passkeyModule, "unlockWithPasskeyPrfEnvelope");
    spy.mockResolvedValue(await createNonExtractableSessionVaultKey());

    await unlockVaultWithPasskeyRouting({
      record,
      prfOutput,
      duressSignaled: true,
      emergencyModeActive: false,
      scope,
      profile,
    });

    expect(spy).toHaveBeenCalled();
    expect(isVaultEmergencyMode()).toBe(true);
    spy.mockRestore();
  });
});
