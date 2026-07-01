import { NextResponse } from "next/server";
import { DEMO_ADMIN_COOKIE } from "@/lib/demo-admin-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_ADMIN_COOKIE, "", { ...{ httpOnly: true, path: "/" }, maxAge: 0 });
  return response;
}
