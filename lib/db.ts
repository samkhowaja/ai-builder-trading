// lib/db.ts
import { createClient } from "@vercel/postgres";

// Get whichever connection string is available
function getConnectionString() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    ""
  );
}

export function hasDb() {
  return !!getConnectionString();
}

// Always talk to the DB through a dedicated client
export async function dbQuery<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<{ rows: T[] }> {
  const conn = getConnectionString();

  if (!conn) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[DB] No POSTGRES_URL / POSTGRES_URL_NON_POOLING / DATABASE_URL – running in fallback mode (no persistence)."
      );
    }
    return { rows: [] as T[] };
  }

  const client = createClient({ connectionString: conn });

  try {
    await client.connect();
    const result = await client.sql(strings, ...values);
    return { rows: result.rows as T[] };
  } finally {
    await client.end();
  }
}
