import { NextResponse } from "next/server";
import {
  DEMO_ADMIN_COOKIE,
  createDemoAdminSessionToken,
  enforceDemoAuthRateLimit,
  getDemoAdminCookieOptions,
  isDemoAdminEmailAuthorized,
} from "@/lib/demo-admin-auth";

export async function POST(request: Request) {
  try {
    const rateLimited = enforceDemoAuthRateLimit(request);
    if (rateLimited) return rateLimited;

    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    if (!isDemoAdminEmailAuthorized(email)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      DEMO_ADMIN_COOKIE,
      await createDemoAdminSessionToken(email),
      getDemoAdminCookieOptions()
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
