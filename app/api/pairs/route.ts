// app/api/pairs/route.ts
import { NextResponse } from "next/server";
import { dbQuery, hasDb } from "@/lib/db";

const DEFAULT_PAIRS = ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30"];

type PairRow = {
  id: number;
  symbol: string;
  sort_order: number;
};

function rowsToJson(rows: PairRow[]) {
  return rows
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map((row) => ({
      id: row.id,
      symbol: row.symbol,
      sortOrder: row.sort_order,
    }));
}

// Ensure table exists
async function ensureTable() {
  await dbQuery`
    CREATE TABLE IF NOT EXISTS pairs (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `;
}

// Seed default pairs if table is empty
async function seedDefaultsIfEmpty(): Promise<PairRow[]> {
  await ensureTable();

  const { rows } = await dbQuery<PairRow>`
    SELECT id, symbol, sort_order FROM pairs ORDER BY sort_order, id;
  `;

  if (rows.length > 0) {
    return rows;
  }

  // Table empty → insert defaults
  for (let i = 0; i < DEFAULT_PAIRS.length; i++) {
    const symbol = DEFAULT_PAIRS[i];
    await dbQuery`
      INSERT INTO pairs (symbol, sort_order)
      VALUES (${symbol}, ${i})
      ON CONFLICT (symbol) DO NOTHING;
    `;
  }

  const { rows: seeded } = await dbQuery<PairRow>`
    SELECT id, symbol, sort_order FROM pairs ORDER BY sort_order, id;
  `;
  return seeded;
}

// GET: return current pairs, seeding defaults if needed
export async function GET() {
  try {
    // If there is no DB at all, just return in-memory defaults
    if (!hasDb()) {
      const fallback = DEFAULT_PAIRS.map((symbol, index) => ({
        id: index + 1,
        symbol,
        sortOrder: index,
      }));
      return NextResponse.json(fallback, { status: 200 });
    }

    const rows = await seedDefaultsIfEmpty();
    return NextResponse.json(rowsToJson(rows), { status: 200 });
  } catch (err: any) {
    console.error("[/api/pairs GET] error:", err);
    // Fallback: still give the user something
    const fallback = DEFAULT_PAIRS.map((symbol, index) => ({
      id: index + 1,
      symbol,
      sortOrder: index,
      error: "DB error – using fallback list",
    }));
    return NextResponse.json(fallback, { status: 200 });
  }
}

// POST: replace pairs with new list from the client
// Expected body: { pairs: string[] }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pairs: string[] = Array.isArray(body?.pairs) ? body.pairs : [];

    if (!hasDb()) {
      // No DB → nothing to save, but respond OK so UI doesn't break
      return NextResponse.json(
        { ok: false, message: "No database configured; pairs not persisted." },
        { status: 200 }
      );
    }

    await ensureTable();

    // Simple strategy: clear table, then insert fresh list
    await dbQuery`DELETE FROM pairs;`;

    for (let i = 0; i < pairs.length; i++) {
      const symbol = pairs[i];
      await dbQuery`
        INSERT INTO pairs (symbol, sort_order)
        VALUES (${symbol}, ${i})
        ON CONFLICT (symbol) DO NOTHING;
      `;
    }

    const { rows } = await dbQuery<PairRow>`
      SELECT id, symbol, sort_order FROM pairs ORDER BY sort_order, id;
    `;

    return NextResponse.json(
      { ok: true, pairs: rowsToJson(rows) },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/pairs POST] error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
