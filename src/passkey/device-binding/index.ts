export type {
  VaultDeviceBindingId,
  VaultDeviceBindingStore,
  VaultPasskeyBindingTarget,
  VaultPasskeyBindingStore,
} from "./types.js";
export {
  parseDeviceBindingId,
  parsePasskeyBindingId,
  type ParsedDeviceBindingId,
  type ParsedPasskeyBindingId,
} from "./parse-binding-id.js";
export {
  scopeAuthenticationOptionsToCredential,
  scopeAuthenticationOptionsToDevice,
  selectAuthenticationCredentials,
  type PasskeyCredentialSelection,
  type ScopeAuthenticationOptionsInput,
  type ScopeAuthenticationOptionsToCredentialContext,
  type ScopeAuthenticationOptionsToDeviceContext,
} from "./scope-auth-options.js";
export {
  resolvePasskeyUnlockAvailable,
  resolvePasskeyUnlockAvailableOnDevice,
  type ResolvePasskeyUnlockAvailableInput,
  type ResolvePasskeyUnlockAvailableOnDeviceInput,
} from "./resolve-availability.js";
