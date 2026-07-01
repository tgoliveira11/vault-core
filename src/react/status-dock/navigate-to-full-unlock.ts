/** Navigates to the full vault unlock route (SPA callback or hard navigation). */
export function navigateToVaultFullUnlock(
  href: string,
  onNavigate?: (href: string) => void
): void {
  if (onNavigate) {
    onNavigate(href);
    return;
  }
  if (typeof window !== "undefined") {
    window.location.assign(href);
  }
}
