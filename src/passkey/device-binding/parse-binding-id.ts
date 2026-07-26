const DEVICE_BINDING_PREFIX = "v1.";
export type ParsedPasskeyBindingId = { version: 1; bindingId: string };
export type ParsedDeviceBindingId = { version: 1; credentialId: string };

/** Parses an opaque browser-binding id without treating it as a credential id. */
export function parsePasskeyBindingId(raw: string | null | undefined): ParsedPasskeyBindingId | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const bindingId = trimmed.startsWith(DEVICE_BINDING_PREFIX)
    ? trimmed.slice(DEVICE_BINDING_PREFIX.length).trim()
    : trimmed;
  return bindingId ? { version: 1, bindingId } : null;
}

/** @deprecated Binding ids must be opaque. Use parsePasskeyBindingId. */
export function parseDeviceBindingId(raw: string | null | undefined): ParsedDeviceBindingId | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(DEVICE_BINDING_PREFIX)) {
    const credentialId = trimmed.slice(DEVICE_BINDING_PREFIX.length).trim();
    return credentialId ? { version: 1, credentialId } : null;
  }
  return { version: 1, credentialId: trimmed };
}
