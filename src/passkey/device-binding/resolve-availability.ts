export type ResolvePasskeyUnlockAvailableOnDeviceInput = {
  hasPasskeyPrfEnvelope?: boolean;
  passkeyUnlockAvailableOnThisDevice?: boolean;
};
export function resolvePasskeyUnlockAvailableOnDevice(input: ResolvePasskeyUnlockAvailableOnDeviceInput): boolean {
  if (!input.hasPasskeyPrfEnvelope) return false;
  return input.passkeyUnlockAvailableOnThisDevice !== false;
}
