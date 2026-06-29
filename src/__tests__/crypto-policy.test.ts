import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENCRYPTION_ALG,
  ENCRYPTION_VERSION,
} from "../constants.js";
import {
  assertVaultCryptoPolicyIntegrity,
  isEnvelopeKdfUpgradeRecommended,
  isLegacyArgon2idMetadata,
  isRecommendedArgon2idMetadata,
  isRecommendedEncryptionPayload,
  LEGACY_KDF_VERSION,
  RECOMMENDED_KDF_ALGORITHM,
  RECOMMENDED_KDF_VERSION,
  VAULT_CRYPTO_POLICY,
} from "../crypto/policy.js";
import {
  DEFAULT_ARGON2ID_PARAMS,
  LEGACY_ARGON2ID_PARAMS,
  RECOMMENDED_ARGON2ID_PARAMS,
} from "../kdf/params.js";
import { serializeArgon2idMetadata } from "../kdf/argon2id.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

describe("vault crypto policy", () => {
  it("keeps the canonical recommended algorithms", () => {
    assertVaultCryptoPolicyIntegrity();

    expect(VAULT_CRYPTO_POLICY.encryption).toEqual({
      version: ENCRYPTION_VERSION,
      alg: ENCRYPTION_ALG,
    });
    expect(ENCRYPTION_ALG).toBe("AES-GCM");
    expect(ENCRYPTION_VERSION).toBe("enc-v1");
    expect(RECOMMENDED_KDF_ALGORITHM).toBe("argon2id");
    expect(RECOMMENDED_KDF_VERSION).toBe("kdf-v2");
    expect(LEGACY_KDF_VERSION).toBe("kdf-v1");
  });

  it("requires recommended Argon2id params to be stronger than legacy params", () => {
    expect(RECOMMENDED_ARGON2ID_PARAMS.memory).toBeGreaterThan(LEGACY_ARGON2ID_PARAMS.memory);
    expect(RECOMMENDED_ARGON2ID_PARAMS.iterations).toBeGreaterThanOrEqual(
      LEGACY_ARGON2ID_PARAMS.iterations
    );
    expect(DEFAULT_ARGON2ID_PARAMS).toEqual(RECOMMENDED_ARGON2ID_PARAMS);
  });

  it("detects legacy envelopes that should upgrade on unlock", () => {
    const legacy = serializeArgon2idMetadata(
      new Uint8Array(16),
      LEGACY_ARGON2ID_PARAMS,
      LEGACY_KDF_VERSION
    );
    const recommended = serializeArgon2idMetadata(
      new Uint8Array(16),
      RECOMMENDED_ARGON2ID_PARAMS,
      RECOMMENDED_KDF_VERSION
    );

    expect(isRecommendedArgon2idMetadata(legacy)).toBe(false);
    expect(isEnvelopeKdfUpgradeRecommended(legacy)).toBe(true);
    expect(isRecommendedArgon2idMetadata(recommended)).toBe(true);
    expect(isEnvelopeKdfUpgradeRecommended(recommended)).toBe(false);
    expect(isEnvelopeKdfUpgradeRecommended(null)).toBe(false);
    expect(
      isLegacyArgon2idMetadata(
        serializeArgon2idMetadata(new Uint8Array(16), LEGACY_ARGON2ID_PARAMS, LEGACY_KDF_VERSION)
      )
    ).toBe(true);
    expect(
      isRecommendedArgon2idMetadata(
        serializeArgon2idMetadata(new Uint8Array(16), LEGACY_ARGON2ID_PARAMS, LEGACY_KDF_VERSION)
      )
    ).toBe(false);
    expect(
      isRecommendedArgon2idMetadata({
        ...serializeArgon2idMetadata(
          new Uint8Array(16),
          RECOMMENDED_ARGON2ID_PARAMS,
          RECOMMENDED_KDF_VERSION
        ),
        memory: LEGACY_ARGON2ID_PARAMS.memory,
      })
    ).toBe(false);
  });

  it("recognizes recommended encrypted payload versions", () => {
    expect(
      isRecommendedEncryptionPayload({ version: ENCRYPTION_VERSION, alg: ENCRYPTION_ALG })
    ).toBe(true);
    expect(isRecommendedEncryptionPayload({ version: "enc-v0", alg: ENCRYPTION_ALG })).toBe(false);
    expect(isRecommendedEncryptionPayload({ version: ENCRYPTION_VERSION, alg: "AES-CBC" })).toBe(
      false
    );
  });

  it("fails CI if recommended encryption or KDF algorithms are weakened in source", () => {
    const constantsSource = readFileSync(path.join(repoRoot, "src/constants.ts"), "utf8");
    const policySource = readFileSync(path.join(repoRoot, "src/crypto/policy.ts"), "utf8");
    const paramsSource = readFileSync(path.join(repoRoot, "src/kdf/params.ts"), "utf8");

    expect(constantsSource).toMatch(/ENCRYPTION_ALG = "AES-GCM"/);
    expect(constantsSource).toMatch(/ENCRYPTION_VERSION = "enc-v1"/);
    expect(policySource).toMatch(/RECOMMENDED_KDF_ALGORITHM = "argon2id"/);
    expect(policySource).toMatch(/RECOMMENDED_KDF_VERSION = "kdf-v2"/);
    expect(paramsSource).toMatch(/RECOMMENDED_ARGON2ID_PARAMS[\s\S]*memory: 131072/);
    expect(paramsSource).toMatch(/RECOMMENDED_ARGON2ID_PARAMS[\s\S]*iterations: 4/);
  });

  it("does not ship email or SMTP dependencies", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, "package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };

    const dependencyNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.optionalDependencies ?? {}),
    ];

    for (const name of dependencyNames) {
      expect(name).not.toMatch(/nodemailer|sendgrid|mailgun|postmark|resend|smtp/i);
    }

    const srcFiles = readFileSync(path.join(repoRoot, "src/index.ts"), "utf8");
    expect(srcFiles).not.toMatch(/sendEmail|nodemailer|smtp/i);
  });
});
