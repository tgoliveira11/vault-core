export type ResolvePasskeyUnlockAvailableOnDeviceInput = {
  hasPasskeyPrfEnvelope?: boolean;
  passkeyUnlockAvailableOnThisBrowser?: boolean;
  /** @deprecated Use passkeyUnlockAvailableOnThisBrowser. */
  passkeyUnlockAvailableOnThisDevice?: boolean;
};

export type ResolvePasskeyUnlockAvailableInput = ResolvePasskeyUnlockAvailableOnDeviceInput;

/** Resolves bound-browser quick unlock availability. Missing binding state fails closed. */
export function resolvePasskeyUnlockAvailable(input: ResolvePasskeyUnlockAvailableInput): boolean {
  if (!input.hasPasskeyPrfEnvelope) return false;
  const bindingAvailable =
    input.passkeyUnlockAvailableOnThisBrowser ??
    input.passkeyUnlockAvailableOnThisDevice;
  return bindingAvailable === true;
}

/** @deprecated Use resolvePasskeyUnlockAvailable. */
export function resolvePasskeyUnlockAvailableOnDevice(input: ResolvePasskeyUnlockAvailableOnDeviceInput): boolean {
  return resolvePasskeyUnlockAvailable(input);
}
