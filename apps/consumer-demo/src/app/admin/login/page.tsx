import { Suspense } from "react";
import { AdminLoginForm } from "./admin-login-form";

function getDemoAdminEmailHint(): string | null {
  const email = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

export default function AdminLoginPage() {
  const emailHint = getDemoAdminEmailHint();

  return (
    <Suspense fallback={<p className="p-8 text-sm text-[var(--muted)]">Loading…</p>}>
      <AdminLoginForm emailHint={emailHint} />
    </Suspense>
  );
}
