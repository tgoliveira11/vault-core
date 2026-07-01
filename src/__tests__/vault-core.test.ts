import { describe, expect, it } from "vitest";
import {
  createUserVaultKey,
  importUserVaultKey,
  userVaultKeysEqual,
  encryptField,
  decryptField,
  createPasswordEnvelope,
  unlockWithPasswordEnvelope,
  createRecoveryEnvelope,
  unlockWithRecoveryEnvelope,
  createPasskeyPrfEnvelope,
  unlockWithPasskeyPrfEnvelope,
  encryptVaultPayload,
  decryptVaultPayload,
  createRecoveryPhrase,
  normalizeRecoveryPhrase,
  validateRecoveryPhraseFormat,
  pickRecoveryConfirmationIndices,
  assertRecoveryPhraseWordConfirmation,
  createRecoveryKitText,
  assertNoVaultPlaintextFields,
  validateNoPlaintextLeak,
  scanForSentinels,
  encryptedPayloadSchema,
  serializeArgon2idMetadata,
  parseArgon2idMetadata,
  SENTINEL_VAULT_PASSWORD,
  SENTINEL_PRIVATE_LABEL,
} from "../index.js";
import {
  LIQSENSE_COMPAT_PROFILE,
  LIQSENSE_COMPAT_SCOPE,
  FIXTURE_UVK_BYTES,
  FIXTURE_ARGON2_SALT,
  FIXTURE_VAULT_PASSWORD,
  FIXTURE_12_WORD_PHRASE,
  FIXTURE_24_WORD_PHRASE,
  FIXTURE_PRF_OUTPUT,
  FIXTURE_PAYLOAD_V1,
} from "../testing/fixtures/liqsense-compat.js";
import { bytesToBase64Url } from "../crypto/encoding.js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AES-GCM", () => {
  it("encrypts and decrypts roundtrip", async () => {
    const key = await createUserVaultKey();
    const encrypted = await encryptField(
      "hello vault",
      key,
      { ...LIQSENSE_COMPAT_SCOPE, field: "vault_payload" },
      LIQSENSE_COMPAT_PROFILE
    );
    const plaintext = await decryptField(encrypted, key);
    expect(plaintext).toBe("hello vault");
  });

  it("fails with wrong key", async () => {
    const key = await createUserVaultKey();
    const wrongKey = await createUserVaultKey();
    const encrypted = await encryptField(
      "secret",
      key,
      { ...LIQSENSE_COMPAT_SCOPE, field: "vault_payload" },
      LIQSENSE_COMPAT_PROFILE
    );
    await expect(decryptField(encrypted, wrongKey)).rejects.toThrow();
  });

  it("fails with tampered ciphertext", async () => {
    const key = await createUserVaultKey();
    const encrypted = await encryptField(
      "secret",
      key,
      { ...LIQSENSE_COMPAT_SCOPE, field: "vault_payload" },
      LIQSENSE_COMPAT_PROFILE
    );
    const tampered = {
      ...encrypted,
      ciphertext: bytesToBase64Url(new Uint8Array([0, 1, 2, 3])),
    };
    await expect(decryptField(tampered, key)).rejects.toThrow();
  });

  it("fails with wrong AAD userId on stored payload", async () => {
    const key = await createUserVaultKey();
    const encrypted = await encryptField(
      "secret",
      key,
      { ...LIQSENSE_COMPAT_SCOPE, field: "vault_payload" },
      LIQSENSE_COMPAT_PROFILE
    );
    const wrongAad = {
      ...encrypted,
      aad: {
        ...encrypted.aad,
        userId: "11111111-1111-4111-8111-111111111111",
      },
    };
    await expect(decryptField(wrongAad, key)).rejects.toThrow();
  });

  it("decrypts with legacy AAD candidate ordering", async () => {
    const key = await createUserVaultKey();
    const encrypted = await encryptField(
      "legacy-aad",
      key,
      { ...LIQSENSE_COMPAT_SCOPE, field: "vault_key" },
      LIQSENSE_COMPAT_PROFILE
    );
    expect(encrypted.aad.context).toBe(LIQSENSE_COMPAT_PROFILE.aadContextEnvelope);
    expect(await decryptField(encrypted, key)).toBe("legacy-aad");
  });
});

describe("password envelope", () => {
  it("creates and unlocks with fixed salt fixture", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const { envelope, kdfMetadata } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    expect(envelope.method).toBe("password");
    expect(kdfMetadata.kdf).toBe("argon2id");
    expect(envelope.encryptedVaultKey.aad.context).toBe(
      LIQSENSE_COMPAT_PROFILE.aadContextEnvelope
    );

    const unwrapped = await unlockWithPasswordEnvelope(
      FIXTURE_VAULT_PASSWORD,
      envelope,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(await userVaultKeysEqual(vaultKey, unwrapped)).toBe(true);
  });
});

describe("recovery envelope", () => {
  it("creates and unlocks 12-word phrase with fixed salt", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const { envelope } = await createRecoveryEnvelope(
      vaultKey,
      FIXTURE_12_WORD_PHRASE,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      { phraseLength: 12 },
      FIXTURE_ARGON2_SALT
    );

    const unwrapped = await unlockWithRecoveryEnvelope(
      FIXTURE_12_WORD_PHRASE,
      envelope,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(await userVaultKeysEqual(vaultKey, unwrapped)).toBe(true);
  });

  it("creates and unlocks 24-word phrase with fixed salt", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const { envelope } = await createRecoveryEnvelope(
      vaultKey,
      FIXTURE_24_WORD_PHRASE,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      { phraseLength: 24 },
      FIXTURE_ARGON2_SALT
    );

    const unwrapped = await unlockWithRecoveryEnvelope(
      FIXTURE_24_WORD_PHRASE,
      envelope,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(await userVaultKeysEqual(vaultKey, unwrapped)).toBe(true);
  });
});

describe("recovery phrase helpers", () => {
  it("generates valid 12 and 24 word phrases", () => {
    const phrase12 = createRecoveryPhrase({ wordCount: 12 });
    const phrase24 = createRecoveryPhrase({ wordCount: 24 });
    expect(validateRecoveryPhraseFormat(phrase12)).toBe(true);
    expect(validateRecoveryPhraseFormat(phrase24)).toBe(true);
    expect(normalizeRecoveryPhrase(`  ${phrase12.toUpperCase()}  `)).toBe(phrase12);
  });

  it("confirms selected words by index", () => {
    const phrase = FIXTURE_12_WORD_PHRASE;
    const indices = pickRecoveryConfirmationIndices(12, 3);
    const answers = Object.fromEntries(
      indices.map((index) => [index, phrase.split(" ")[index - 1]!])
    );
    expect(() => assertRecoveryPhraseWordConfirmation(phrase, answers)).not.toThrow();
  });

  it("builds recovery kit text", () => {
    const text = createRecoveryKitText({
      recoveryPhrase: FIXTURE_12_WORD_PHRASE,
      wordCount: 12,
      productName: "TestApp",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(text).toContain("TestApp Vault Recovery Kit");
    expect(text).toContain(FIXTURE_12_WORD_PHRASE);
  });
});

describe("passkey PRF envelope", () => {
  it("creates and unlocks with fixture PRF output", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const envelope = await createPasskeyPrfEnvelope(
      vaultKey,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );

    const unwrapped = await unlockWithPasskeyPrfEnvelope(
      envelope,
      FIXTURE_PRF_OUTPUT,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(await userVaultKeysEqual(vaultKey, unwrapped)).toBe(true);
  });

  it("rejects PRF output shorter than 32 bytes", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    await expect(
      createPasskeyPrfEnvelope(
        vaultKey,
        new Uint8Array(16),
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toThrow(/32 bytes/);
  });
});

describe("encrypted vault payload", () => {
  it("roundtrips generic JSON payload", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const encrypted = await encryptVaultPayload(
      FIXTURE_PAYLOAD_V1,
      vaultKey,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(encrypted.aad.context).toBe(LIQSENSE_COMPAT_PROFILE.aadContextVault);
    const decrypted = await decryptVaultPayload<typeof FIXTURE_PAYLOAD_V1>(
      encrypted,
      vaultKey,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    expect(decrypted).toEqual(FIXTURE_PAYLOAD_V1);
  });

  it("does not leak sentinels outside ciphertext metadata", async () => {
    const vaultKey = await createUserVaultKey();
    const payload = {
      ...FIXTURE_PAYLOAD_V1,
      profile: { displayName: SENTINEL_PRIVATE_LABEL },
    };
    const encrypted = await encryptVaultPayload(
      payload,
      vaultKey,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );
    const serialized = JSON.stringify(encrypted);
    expect(serialized).not.toContain(SENTINEL_PRIVATE_LABEL);
    expect(scanForSentinels({ aad: encrypted.aad, iv: encrypted.iv })).toHaveLength(0);
  });

  it("rejects a valid payload when its AAD does not match the expected scope", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const encrypted = await encryptVaultPayload(
      FIXTURE_PAYLOAD_V1,
      vaultKey,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );

    await expect(
      decryptVaultPayload(
        encrypted,
        vaultKey,
        {
          ...LIQSENSE_COMPAT_SCOPE,
          resourceId: "11111111-1111-4111-8111-111111111111",
        },
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toThrow(/resourceId mismatch/);
  });
});

describe("validation", () => {
  it("validates encrypted payload schema", () => {
    const parsed = encryptedPayloadSchema.safeParse({
      version: "enc-v1",
      alg: "AES-GCM",
      iv: "abc",
      ciphertext: "def",
      aad: {
        userId: LIQSENSE_COMPAT_SCOPE.userId,
        resourceId: LIQSENSE_COMPAT_SCOPE.resourceId,
        field: "vault_payload",
        context: LIQSENSE_COMPAT_PROFILE.aadContextVault,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects forbidden plaintext fields", () => {
    expect(() => assertNoVaultPlaintextFields({ vaultPassword: "x" })).toThrow();
    expect(() => assertNoVaultPlaintextFields({ recoveryPhrase: "words" })).toThrow();
    expect(() => assertNoVaultPlaintextFields({ mnemonic: "words" })).toThrow();
    expect(() => assertNoVaultPlaintextFields({ VaultPassword: "x" })).toThrow();
    expect(validateNoPlaintextLeak({ encryptedBlob: { iv: "x" } }).ok).toBe(true);
  });

  it("rejects forbidden plaintext fields at any nesting depth", () => {
    expect(() =>
      assertNoVaultPlaintextFields({ payload: { entries: [{ recoveryPhrase: "words" }] } })
    ).toThrow(/payload\.entries\.0\.recoveryPhrase/);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => assertNoVaultPlaintextFields(cyclic)).not.toThrow();
  });

  it("rejects Argon2id metadata outside the safe resource limits", async () => {
    const vaultKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );

    const unsafeEnvelope = {
      ...envelope,
      kdfMetadata: {
        ...envelope.kdfMetadata,
        memory: 262145,
      },
    };
    await expect(
      unlockWithPasswordEnvelope(
        FIXTURE_VAULT_PASSWORD,
        unsafeEnvelope,
        LIQSENSE_COMPAT_SCOPE,
        LIQSENSE_COMPAT_PROFILE
      )
    ).rejects.toThrow(/memory must be an integer between/);
  });

  it("serializes and parses Argon2id metadata", () => {
    const metadata = serializeArgon2idMetadata(FIXTURE_ARGON2_SALT);
    const parsed = parseArgon2idMetadata(metadata);
    expect(parsed.salt).toEqual(FIXTURE_ARGON2_SALT);
    expect(metadata.memory).toBe(131072);
    expect(metadata.iterations).toBe(4);
    expect(metadata.version).toBe("kdf-v2");
    expect(metadata.parallelism).toBe(1);
  });
});

describe("LiqSense backwards compatibility fixtures", () => {
  it("unlocks stored golden password envelope fixture", async () => {
    const golden = JSON.parse(
      readFileSync(
        path.join(__dirname, "fixtures/golden-password-envelope.json"),
        "utf8"
      )
    ) as {
      encryptedVaultKey: import("../validation/schemas.js").EncryptedVaultPayload;
      kdfMetadata: import("../validation/schemas.js").Argon2idKdfMetadata;
    };

    const unwrapped = await unlockWithPasswordEnvelope(
      FIXTURE_VAULT_PASSWORD,
      {
        method: "password",
        encryptedVaultKey: golden.encryptedVaultKey,
        kdfMetadata: golden.kdfMetadata,
      },
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE
    );

    const originalKey = await importUserVaultKey(FIXTURE_UVK_BYTES, { extractable: true });
    expect(await userVaultKeysEqual(originalKey, unwrapped)).toBe(true);
    expect(golden.kdfMetadata.salt).toBeTruthy();
    expect(golden.encryptedVaultKey.aad.context).toBe(
      LIQSENSE_COMPAT_PROFILE.aadContextEnvelope
    );
  });
});

describe("package boundary", () => {
  const srcRoot = path.join(__dirname, "..");

  function listSourceFiles(dir: string, options?: { excludeReact?: boolean }): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "fixtures") continue;
        if (options?.excludeReact && entry.name === "react") continue;
        files.push(...listSourceFiles(fullPath, options));
      } else if (
        (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".test.tsx")
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it("does not import forbidden dependencies from core/browser/testing entries", () => {
    const forbidden = [
      "react",
      "next",
      "@tgoliveira/secure-auth",
      "next-auth",
      "@simplewebauthn/browser",
      "drizzle-orm",
      "liqsense",
    ];

    const files = listSourceFiles(srcRoot, { excludeReact: true });
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const dep of forbidden) {
        expect(content, `${file} must not reference ${dep}`).not.toMatch(
          new RegExp(`from ['"]${dep.replace("/", "\\/")}`)
        );
      }
    }
  });

  it("react entry does not import next, secure-auth, or product modules", () => {
    const forbidden = ["next", "@tgoliveira/secure-auth", "next-auth", "drizzle-orm", "liqsense"];
    const files = listSourceFiles(path.join(srcRoot, "react"));
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const dep of forbidden) {
        expect(content, `${file} must not reference ${dep}`).not.toMatch(
          new RegExp(`from ['"]${dep.replace("/", "\\/")}`)
        );
      }
    }
  });

  it("documents the current package version in the changelog", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8")
    ) as { version: string; files: string[] };
    const changelog = readFileSync(
      path.join(__dirname, "..", "..", "CHANGELOG.md"),
      "utf8"
    );
    const packageLock = JSON.parse(
      readFileSync(path.join(__dirname, "..", "..", "package-lock.json"), "utf8")
    ) as { version: string; packages: Record<string, { version?: string }> };
    const escapedVersion = packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    expect(changelog).toMatch(
      new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`, "m")
    );
    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[""]?.version).toBe(packageJson.version);
    expect(packageJson.files).toEqual(
      expect.arrayContaining(["CHANGELOG.md", "AGENTS.md", "docs"])
    );
    for (const documentationPath of [
      "AGENTS.md",
      "API_REFERENCE.md",
      "SECURITY.md",
      "docs/README.md",
      "docs/IMPLEMENTATION_GUIDE.md",
      "docs/RELEASING.md",
    ]) {
      expect(
        readFileSync(path.join(__dirname, "..", "..", documentationPath), "utf8").length,
        `${documentationPath} must be present and non-empty`
      ).toBeGreaterThan(0);
    }
  });

  it("keeps local documentation links resolvable", () => {
    const repositoryRoot = path.join(__dirname, "..", "..");
    const rootDocs = readdirSync(repositoryRoot)
      .filter((name) => name.endsWith(".md"))
      .map((name) => path.join(repositoryRoot, name));
    const nestedDocs = readdirSync(path.join(repositoryRoot, "docs"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => path.join(repositoryRoot, "docs", name));

    for (const documentationFile of [...rootDocs, ...nestedDocs]) {
      const markdown = readFileSync(documentationFile, "utf8");
      for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
        const target = match[1]!;
        if (/^(?:https?:|mailto:|#)/.test(target)) continue;
        const fileTarget = target.split("#", 1)[0]!;
        expect(
          existsSync(path.resolve(path.dirname(documentationFile), fileTarget)),
          `${path.relative(repositoryRoot, documentationFile)} links to missing ${target}`
        ).toBe(true);
      }
    }
  });
});
