export const DEFAULT_APPLE_MOBILE_PRF_MIN_MAJOR_VERSION = 18;

const APPLE_MOBILE_UA_PATTERN = /iPhone|iPod|iPad/i;
const APPLE_OS_VERSION_PATTERN = /OS (\d+)[_.]/i;

export type PrfExtensionSupportOptions = {
  userAgent?: string;
  minAppleMobileMajorVersion?: number;
  /** Disable the versioned Apple-mobile workaround while keeping the API heuristic. */
  appleMobileWorkaround?: boolean;
  /** Consumer override for the preliminary heuristic only. */
  heuristicOverride?: boolean;
};

export function resolvePrfSupportUserAgent(userAgent?: string): string {
  if (userAgent) {
    return userAgent;
  }
  if (typeof navigator !== "undefined" && typeof navigator.userAgent === "string") {
    return navigator.userAgent;
  }
  return "";
}

export function parseAppleMobileOsMajorVersion(userAgent: string): number | null {
  if (!APPLE_MOBILE_UA_PATTERN.test(userAgent)) {
    return null;
  }
  const match = userAgent.match(APPLE_OS_VERSION_PATTERN);
  if (!match) {
    return null;
  }
  const major = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(major) ? major : null;
}

export function isAppleMobileBelowPrfMinimum(
  userAgent: string,
  minMajorVersion = DEFAULT_APPLE_MOBILE_PRF_MIN_MAJOR_VERSION
): boolean {
  const major = parseAppleMobileOsMajorVersion(userAgent);
  return major !== null && major < minMajorVersion;
}

export function isPrfExtensionHeuristicallyAvailable(options?: PrfExtensionSupportOptions): boolean {
  if (options?.heuristicOverride !== undefined) {
    return options.heuristicOverride;
  }

  if (typeof globalThis === "undefined" || typeof globalThis.PublicKeyCredential === "undefined") {
    return false;
  }

  if (
    typeof PublicKeyCredential === "undefined" ||
    !("getClientExtensionResults" in PublicKeyCredential.prototype)
  ) {
    return false;
  }

  const userAgent = resolvePrfSupportUserAgent(options?.userAgent);
  const minMajor = options?.minAppleMobileMajorVersion ?? DEFAULT_APPLE_MOBILE_PRF_MIN_MAJOR_VERSION;
  if (
    options?.appleMobileWorkaround !== false &&
    isAppleMobileBelowPrfMinimum(userAgent, minMajor)
  ) {
    return false;
  }

  return true;
}

/** @deprecated This is only a heuristic. Use resolvePasskeyPrfCapability for confirmed states. */
export function isPrfExtensionSupported(options?: PrfExtensionSupportOptions): boolean {
  return isPrfExtensionHeuristicallyAvailable(options);
}
