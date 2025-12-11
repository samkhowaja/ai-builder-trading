// lib/db.ts
import { sql, createClient } from "@vercel/postgres";

// We consider DB available if *either* pooled or non-pooled url exists
export function hasDb() {
  return !!process.env.POSTGRES_URL || !!process.env.POSTGRES_URL_NON_POOLING;
}

// Helper that chooses the right way to talk to the DB
export async function dbQuery<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<{ rows: T[] }> {
  if (!hasDb()) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[DB] No POSTGRES_URL / POSTGRES_URL_NON_POOLING – running in fallback mode (no persistence)."
      );
    }
    return { rows: [] as T[] };
  }

  // 1) Preferred: pooled connection using sql + POSTGRES_URL
  if (process.env.POSTGRES_URL) {
    const result = await sql(strings, ...values);
    return { rows: result.rows as T[] };
  }

  // 2) Fallback: direct connection using a client + POSTGRES_URL_NON_POOLING
  const client = createClient({
    connectionString: process.env.POSTGRES_URL_NON_POOLING,
  });

  try {
    await client.connect();
    const result = await client.sql(strings, ...values);
    return { rows: result.rows as T[] };
  } finally {
    await client.end();
  }
}
