/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  assertNoVaultPlaintextInDocument,
  scanDocumentForVaultPlaintextSentinels,
} from "../../testing/dom-plaintext-scan.js";
import { SENTINEL_PRIVATE_NOTE } from "../../validation/plaintext-reject.js";

describe("dom-plaintext-scan", () => {
  it("treats null textContent as empty", () => {
    const root = { textContent: null } as unknown as ParentNode;
    expect(scanDocumentForVaultPlaintextSentinels(root)).toEqual([]);
  });

  it("detects sentinels in document text", () => {
    document.body.innerHTML = `<p>${SENTINEL_PRIVATE_NOTE}</p>`;
    expect(scanDocumentForVaultPlaintextSentinels(document.body)).toContain(
      SENTINEL_PRIVATE_NOTE
    );
  });

  it("assertNoVaultPlaintextInDocument passes when clean", () => {
    document.body.innerHTML = "<p>Vault locked</p>";
    expect(() => assertNoVaultPlaintextInDocument(document.body)).not.toThrow();
  });

  it("assertNoVaultPlaintextInDocument throws when sentinel present", () => {
    document.body.innerHTML = `<p>${SENTINEL_PRIVATE_NOTE}</p>`;
    expect(() => assertNoVaultPlaintextInDocument(document.body)).toThrow(/sentinel/i);
  });
});
