import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/stellar_analytics";

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("[db] unexpected error on idle client", err);
  process.exit(-1);
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log("[db] executed query", { text, duration, rows: res.rowCount });
  return res;
}
