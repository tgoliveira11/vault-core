import { NextResponse } from "next/server";
import {
  buildVaultRateLimitHttpResponse,
  consumeVaultApiRateLimit,
  createVaultApiRateLimiter,
} from "@tgoliveira/vault-core";

export const DEMO_ADMIN_COOKIE = "vault-demo-admin-session";

export const DEMO_ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

const DEMO_AUTH_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
} as const;

let demoAuthRateLimiter: ReturnType<typeof createVaultApiRateLimiter> | null = null;

export function getDemoAuthRateLimiter() {
  if (!demoAuthRateLimiter) {
    demoAuthRateLimiter = createVaultApiRateLimiter(DEMO_AUTH_RATE_LIMIT);
  }
  return demoAuthRateLimiter;
}

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

function buildDemoAdminSessionPayload(email: string, expiresAt: number): string {
  return `${email.trim().toLowerCase()}:${expiresAt}`;
}

export function isDemoAdminEmailAuthorized(email: string): boolean {
  return email.trim().toLowerCase() === getDemoAdminEmail();
}

export async function createDemoAdminSessionToken(email: string): Promise<string> {
  const expiresAt = Date.now() + DEMO_ADMIN_COOKIE_MAX_AGE_SECONDS * 1000;
  const key = await importDemoAdminHmacKey(getDemoAdminSessionSecret());
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(buildDemoAdminSessionPayload(email, expiresAt))
  );
  return `${expiresAt}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function hasValidDemoAdminSession(
  cookieValue: string | undefined | null
): Promise<boolean> {
  if (!cookieValue) return false;

  const separator = cookieValue.indexOf(".");
  if (separator <= 0) return false;

  const expiresAt = Number(cookieValue.slice(0, separator));
  const signature = cookieValue.slice(separator + 1);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !signature) {
    return false;
  }

  try {
    const key = await importDemoAdminHmacKey(getDemoAdminSessionSecret());
    const expected = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(buildDemoAdminSessionPayload(getDemoAdminEmail(), expiresAt))
    );
    return timingSafeEqualStrings(signature, base64UrlEncode(new Uint8Array(expected)));
  } catch {
    return false;
  }
}

export function readDemoAdminSessionCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${DEMO_ADMIN_COOKIE}=`)) {
      return decodeURIComponent(trimmed.slice(DEMO_ADMIN_COOKIE.length + 1));
    }
  }

  return undefined;
}

export async function requireDemoAdminSession(request: Request): Promise<NextResponse | null> {
  if (await hasValidDemoAdminSession(readDemoAdminSessionCookie(request))) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function enforceDemoAuthRateLimit(request: Request): NextResponse | null {
  const decision = consumeVaultApiRateLimit(
    getDemoAuthRateLimiter(),
    "demo-admin-login",
    resolveDemoAuthClientKey(request)
  );
  if (decision.allowed) return null;
  const limited = buildVaultRateLimitHttpResponse(decision);
  return NextResponse.json(limited.body, {
    status: limited.status,
    headers: limited.headers,
  });
}

/**
 * Derives a rate-limit key from multiple request signals. Do not trust X-Forwarded-For alone
 * without a trusted reverse proxy that sets corroborating headers.
 */
export function resolveDemoAuthClientKey(request: Request): string {
  return resolveDemoVaultApiClientKey(request);
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

/**
 * Derives a rate-limit key from multiple request signals. Do not trust X-Forwarded-For alone
 * without a trusted reverse proxy that sets corroborating headers.
 */
export function resolveDemoVaultApiClientKey(request: Request): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) {
    return `cf:${cfConnectingIp}`;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();

  if (realIp && firstForwarded) {
    if (realIp === firstForwarded) {
      return `fwd:${realIp}`;
    }
    return `mix:${realIp}:${firstForwarded}`;
  }

  if (firstForwarded) {
    return `xff:${firstForwarded}`;
  }

  if (realIp) {
    return `real:${realIp}`;
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 64) ?? "unknown";
  return `anon:${userAgent}`;
}
