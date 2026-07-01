import type { NextConfig } from "next";

/**
 * Security headers (CSP with per-request nonce in production) are applied in `src/middleware.ts`.
 * See `src/lib/content-security-policy.ts` and docs/CONSUMER_SECURITY_REQUIREMENTS.md.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@tgoliveira/vault-core"],
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
