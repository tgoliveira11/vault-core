const DEVICE_BINDING_PREFIX = "v1.";
export type ParsedDeviceBindingId = { version: 1; credentialId: string };
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
