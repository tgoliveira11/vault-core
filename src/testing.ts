export * from "./validation/plaintext-reject.js";
export {
  assertNoVaultPlaintextInDocument,
  scanDocumentForVaultPlaintextSentinels,
} from "./testing/dom-plaintext-scan.js";
