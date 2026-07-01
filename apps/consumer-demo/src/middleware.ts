import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEMO_ADMIN_COOKIE, hasValidDemoAdminSession } from "@/lib/demo-admin-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(DEMO_ADMIN_COOKIE)?.value;

  if (pathname.startsWith("/api/vault")) {
    if (await hasValidDemoAdminSession(session)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (pathname.startsWith("/admin/vault")) {
    if (await hasValidDemoAdminSession(session)) {
      return NextResponse.next();
    }
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/vault/:path*", "/api/vault/:path*"],
};
