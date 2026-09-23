import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// Document persistence. With DATABASE_URL (e.g. a free Neon Postgres), each document is a
// JSONB row, so data survives restarts on free hosts whose disks are wiped. Without it,
// documents are plain JSON files in DATA_DIR (local development).

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "data");
const url = process.env.DATABASE_URL;
const pool = url ? new pg.Pool({ connectionString: url, max: 3, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } }) : null;

export const persistLabel = () => (pool ? "postgres" : `files (${DATA_DIR})`);

let ready: Promise<void> | null = null;
function ensureTable() {
  ready ??= pool!.query("CREATE TABLE IF NOT EXISTS theo_docs (name text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())").then(() => undefined);
  return ready;
}

export async function loadDoc<T>(name: string, fallback: T): Promise<T> {
  if (pool) {
    await ensureTable();
    const r = await pool.query("SELECT data FROM theo_docs WHERE name = $1", [name]);
    return (r.rows[0]?.data as T) ?? fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), "utf-8")) as T;
  } catch {
    return fallback;
  }
}

const timers = new Map<string, NodeJS.Timeout>();

/** Debounced write of the whole document. */
export function saveDoc(name: string, data: unknown) {
  if (timers.has(name)) return;
  timers.set(name, setTimeout(() => {
    timers.delete(name);
    const json = JSON.stringify(data);
    if (pool) {
      ensureTable()
        .then(() => pool.query("INSERT INTO theo_docs (name, data, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, updated_at = now()", [name, json]))
        .catch((err) => console.error(`[persist] saving ${name} failed:`, err.message));
      return;
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const file = path.join(DATA_DIR, `${name}.json`);
    fs.writeFileSync(`${file}.tmp`, json);
    fs.renameSync(`${file}.tmp`, file);
  }, 300));
}
