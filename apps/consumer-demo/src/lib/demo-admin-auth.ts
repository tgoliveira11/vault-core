export const DEMO_ADMIN_COOKIE = "vault-demo-admin-session";

export const DEMO_ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

export function getDemoAdminEmail(): string {
  const email = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error("DEMO_ADMIN_EMAIL is not configured");
  }
  return email;
}

function getDemoAdminSessionSecret(): string {
  const secret = process.env.DEMO_ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("DEMO_ADMIN_SESSION_SECRET is not configured");
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function importDemoAdminHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export function isDemoAdminEmailAuthorized(email: string): boolean {
  return email.trim().toLowerCase() === getDemoAdminEmail();
}

export async function createDemoAdminSessionToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const key = await importDemoAdminHmacKey(getDemoAdminSessionSecret());
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(normalized));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function hasValidDemoAdminSession(
  cookieValue: string | undefined | null
): Promise<boolean> {
  if (!cookieValue) return false;
  try {
    const expected = await createDemoAdminSessionToken(getDemoAdminEmail());
    return timingSafeEqualStrings(cookieValue, expected);
  } catch {
    return false;
  }
}

export function getDemoAdminCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_ADMIN_COOKIE_MAX_AGE_SECONDS,
  };
}
