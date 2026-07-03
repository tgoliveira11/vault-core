export type { VaultDeviceBindingId, VaultDeviceBindingStore } from "./types.js";
export { parseDeviceBindingId, type ParsedDeviceBindingId } from "./parse-binding-id.js";
export { scopeAuthenticationOptionsToDevice, type ScopeAuthenticationOptionsInput, type ScopeAuthenticationOptionsToDeviceContext } from "./scope-auth-options.js";
export { resolvePasskeyUnlockAvailableOnDevice, type ResolvePasskeyUnlockAvailableOnDeviceInput } from "./resolve-availability.js";
