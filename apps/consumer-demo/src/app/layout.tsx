import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { getVaultAutoLockMinutesAsync } from "@/lib/env/vault-from-env";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vault Core Consumer Demo",
  description:
    "Local reference app for @tgoliveira/vault-core integration (not published to npm).",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const autoLockMinutes = await getVaultAutoLockMinutesAsync();

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers autoLockMinutes={autoLockMinutes}>{children}</Providers>
      </body>
    </html>
  );
}
