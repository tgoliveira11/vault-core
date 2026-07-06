export * from "./validation/plaintext-reject.js";
export {
  assertNoVaultPlaintextInDocument,
  scanDocumentForVaultPlaintextSentinels,
} from "./testing/dom-plaintext-scan.js";
export { assertVaultSessionMode } from "./testing/emergency-session.js";
export {
  createPrimaryDecoyVaultFixture,
  HONEY_VAULT_SENTINEL_NOTE,
  PRIMARY_VAULT_SENTINEL_NOTE,
  type PrimaryDecoyVaultFixture,
  type TestVaultFixtureScope,
} from "./testing/emergency-fixtures.js";
