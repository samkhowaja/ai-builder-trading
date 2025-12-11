// app/api/pairs/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

const defaultPairs = ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30"];

async function ensurePairsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS pairs (
      symbol text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;
}

export async function GET() {
  try {
    await ensurePairsTable();

    const { rows } = await sql`
      SELECT symbol FROM pairs ORDER BY symbol ASC;
    `;

    if (rows.length === 0) {
      // Seed defaults
      for (const sym of defaultPairs) {
        // ignore duplicates if any
        // deno-lint-ignore no-await-in-loop
        await sql`
          INSERT INTO pairs (symbol)
          VALUES (${sym})
          ON CONFLICT (symbol) DO NOTHING;
        `;
      }
      const seeded = await sql`SELECT symbol FROM pairs ORDER BY symbol ASC;`;
      return NextResponse.json({
        pairs: seeded.rows.map((r) => r.symbol as string),
      });
    }

    return NextResponse.json({
      pairs: rows.map((r) => r.symbol as string),
    });
  } catch (err: any) {
    console.error("pairs GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load pairs." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensurePairsTable();
    const body = await request.json();
    const incoming: string[] = Array.isArray(body?.pairs) ? body.pairs : [];

    const cleaned = Array.from(
      new Set(
        incoming
          .map((s) => String(s || "").trim().toUpperCase())
          .filter(Boolean),
      ),
    );

    // reset table (simple global watchlist that everyone shares)
    await sql`DELETE FROM pairs;`;

    for (const sym of cleaned) {
      // deno-lint-ignore no-await-in-loop
      await sql`
        INSERT INTO pairs (symbol)
        VALUES (${sym})
        ON CONFLICT (symbol) DO NOTHING;
      `;
    }

    return NextResponse.json({ pairs: cleaned });
  } catch (err: any) {
    console.error("pairs POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to save pairs." },
      { status: 500 },
    );
  }
}
