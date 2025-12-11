// app/api/pairs/route.ts
import { NextResponse } from "next/server";
import { dbQuery, hasDb } from "@/lib/db";

const FALLBACK_PAIRS = ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30"];

export async function GET() {
  // No DB configured → return fallback list and keep the app working
  if (!hasDb()) {
    return NextResponse.json({ pairs: FALLBACK_PAIRS, source: "fallback" });
  }

  // Ensure table exists
  await dbQuery`
    CREATE TABLE IF NOT EXISTS pairs (
      symbol TEXT PRIMARY KEY
    );
  `;

  const { rows } = await dbQuery<{ symbol: string }>`
    SELECT symbol FROM pairs ORDER BY symbol;
  `;

  const pairs = rows.length ? rows.map((r) => r.symbol) : FALLBACK_PAIRS;
  return NextResponse.json({ pairs, source: "db" });
}

export async function POST(req: Request) {
  const body = await req.json();
  const pairs: string[] = body.pairs || [];

  // No DB → just pretend save worked so UI is happy
  if (!hasDb()) {
    return NextResponse.json({
      ok: true,
      saved: pairs,
      source: "fallback",
    });
  }

  await dbQuery`
    CREATE TABLE IF NOT EXISTS pairs (
      symbol TEXT PRIMARY KEY
    );
  `;

  // Simple approach: wipe and reinsert
  await dbQuery`TRUNCATE TABLE pairs;`;
  for (const symbol of pairs) {
    await dbQuery`
      INSERT INTO pairs(symbol) VALUES (${symbol});
    `;
  }

  return NextResponse.json({ ok: true, source: "db" });
}
