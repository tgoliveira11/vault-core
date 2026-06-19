import type { RecoveryPhraseWordCount } from "../profile.js";

export function createRecoveryKitText(input: {
  recoveryPhrase: string;
  wordCount: RecoveryPhraseWordCount;
  productName: string;
  createdAt?: Date;
  warnings?: string[];
}): string {
  const createdAt = input.createdAt ?? new Date();
  const defaultWarnings = [
    "Store this offline in a safe place.",
    `Anyone with this phrase may be able to unlock your ${input.productName} vault.`,
    `${input.productName} cannot recover your vault if you lose both your vault password and this phrase.`,
    "This recovery phrase was generated in your browser and should never be shared.",
  ];
  const warnings = input.warnings ?? defaultWarnings;

  return `${input.productName} Vault Recovery Kit

Recovery phrase type: ${input.wordCount}-word recovery phrase
Created: ${createdAt.toISOString()}
Product: ${input.productName}

Recovery phrase:
${input.recoveryPhrase}

Important:
${warnings.map((line) => `- ${line}`).join("\n")}
`;
}

/** @deprecated Use createRecoveryKitText */
export function buildRecoveryKitContent(
  recoveryPhrase: string,
  options: { wordCount: RecoveryPhraseWordCount; productName: string; createdAt?: Date; warnings?: string[] }
): string {
  return createRecoveryKitText({
    recoveryPhrase,
    wordCount: options.wordCount,
    productName: options.productName,
    createdAt: options.createdAt,
    warnings: options.warnings,
  });
}
