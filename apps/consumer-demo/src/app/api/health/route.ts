import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await checkDatabaseConnection();
  return NextResponse.json({
    status: db.ok ? "ok" : "degraded",
    database: db,
    app: {
      name: process.env.APP_NAME ?? "Vault Core Demo",
      url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3013",
    },
  }, { status: db.ok ? 200 : 503 });
}
