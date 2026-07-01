import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEMO_ADMIN_COOKIE, hasValidDemoAdminSession } from "@/lib/demo-admin-auth";
import {
  applyResponseSecurityHeaders,
  forwardRequestNonce,
} from "@/lib/content-security-policy";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(DEMO_ADMIN_COOKIE)?.value;
  const requestHeaders = forwardRequestNonce(request);

  if (pathname.startsWith("/api/vault")) {
    if (!(await hasValidDemoAdminSession(session))) {
      const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      applyResponseSecurityHeaders(unauthorized, requestHeaders);
      return unauthorized;
    }
  }

  if (pathname.startsWith("/admin/vault")) {
    if (!(await hasValidDemoAdminSession(session))) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      const redirect = NextResponse.redirect(loginUrl);
      applyResponseSecurityHeaders(redirect, requestHeaders);
      return redirect;
    }
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applyResponseSecurityHeaders(response, requestHeaders);
  return response;
}

export const config = {
  matcher: [
    "/admin/vault/:path*",
    "/api/vault/:path*",
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
