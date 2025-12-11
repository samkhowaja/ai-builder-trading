// lib/db.ts
import { sql } from "@vercel/postgres";

// Returns true if we have a connection string (Vercel Postgres configured)
export function hasDb() {
  return !!process.env.POSTGRES_URL;
}

// Safe wrapper around the sql tag.
// If there is no DB, we return an empty result instead of throwing.
export async function dbQuery<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<{ rows: T[] }> {
  if (!hasDb()) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[DB] POSTGRES_URL not set – running in fallback mode (no persistence)."
      );
    }
    return { rows: [] as T[] };
  }

  const result = await sql<T>(strings, ...values);
  return { rows: result.rows as T[] };
}
