import { NextResponse } from "next/server";
import { dbQuery, hasDb } from "@/lib/db";

export async function GET() {
  if (!hasDb()) {
    return NextResponse.json(
      {
        ok: false,
        hasDb: false,
        message:
          "No POSTGRES_URL / POSTGRES_URL_NON_POOLING in env. Running in fallback mode.",
      },
      { status: 200 }
    );
  }

  try {
    const { rows } = await dbQuery<{ ok: number }>`SELECT 1 as ok`;
    return NextResponse.json({ ok: true, hasDb: true, rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, hasDb: true, error: String(err) },
      { status: 500 }
    );
  }
}
