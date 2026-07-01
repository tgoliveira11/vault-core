import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tgoliveira/vault-core"],
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
