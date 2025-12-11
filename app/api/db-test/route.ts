// app/api/db-test/route.ts
import { NextResponse } from "next/server";
import { hasDb, dbQuery } from "@/lib/db";

export async function GET() {
  if (!hasDb()) {
    return NextResponse.json(
      {
        ok: false,
        hasDb: false,
        message:
          "No POSTGRES_URL or DATABASE_URL found in env. App is running in fallback mode.",
      },
      { status: 200 }
    );
  }

  try {
    // Simple test query
    const { rows } = await dbQuery<{ now: string }>`
      SELECT NOW() as now;
    `;
    return NextResponse.json(
      {
        ok: true,
        hasDb: true,
        now: rows[0]?.now,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        hasDb: true,
        error: String(err),
      },
      { status: 500 }
    );
  }
}
