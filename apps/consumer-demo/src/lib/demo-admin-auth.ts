import { createHmac, timingSafeEqual } from "node:crypto";

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

export function isDemoAdminEmailAuthorized(email: string): boolean {
  return email.trim().toLowerCase() === getDemoAdminEmail();
}

export function createDemoAdminSessionToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHmac("sha256", getDemoAdminSessionSecret()).update(normalized).digest("base64url");
}

export function hasValidDemoAdminSession(cookieValue: string | undefined | null): boolean {
  if (!cookieValue) return false;
  try {
    const expected = createDemoAdminSessionToken(getDemoAdminEmail());
    const actual = Buffer.from(cookieValue);
    const reference = Buffer.from(expected);
    if (actual.length !== reference.length) return false;
    return timingSafeEqual(actual, reference);
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
