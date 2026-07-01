import type { NextRequest, NextResponse } from "next/server";

/** Request header forwarded to Next.js so framework scripts receive the CSP nonce. */
export const CSP_NONCE_HEADER = "x-nonce";

export function createCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * Builds Content-Security-Policy for the consumer demo.
 * Production uses per-request nonces (no `unsafe-inline` / `unsafe-eval` on scripts).
 * Development keeps relaxed script-src for Next.js dev tooling.
 */
export function buildContentSecurityPolicy(
  nonce: string,
  options?: { production?: boolean }
): string {
  const isProduction = options?.production ?? process.env.NODE_ENV === "production";

  const shared = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
  ];

  if (isProduction) {
    return [
      ...shared,
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      // Tailwind and Next style injection; tighten with hashed styles if your build supports it.
      "style-src 'self' 'unsafe-inline'",
      "upgrade-insecure-requests",
    ].join("; ");
  }

  return [
    ...shared,
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
  ].join("; ");
}

/** Attaches a fresh nonce to the incoming request for Next.js script tagging. */
export function forwardRequestNonce(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.set(CSP_NONCE_HEADER, createCspNonce());
  return headers;
}

export function applyResponseSecurityHeaders(
  response: NextResponse,
  requestHeaders: Headers
): void {
  const nonce = requestHeaders.get(CSP_NONCE_HEADER);
  if (!nonce) return;

  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
}
