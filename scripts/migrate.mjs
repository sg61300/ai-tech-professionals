// Applies supabase/migrations/*.sql in order against DATABASE_URL.
// Tracks applied files in a _migrations table so re-runs are idempotent.
// Usage: node scripts/migrate.mjs   (reads .env.local)
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// minimal .env.local loader (no dep)
try {
  const env = readFileSync(join(root, ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const url = process.env.DATABASE_URL;
if (!url || url.includes("[YOUR-PASSWORD]")) {
  console.error("DATABASE_URL is missing or still has the [YOUR-PASSWORD] placeholder.");
  process.exit(1);
}

const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(
  "create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())",
);
// Deny-all RLS so PostgREST never exposes this internal table to the API.
await client.query("alter table public._migrations enable row level security");
const { rows } = await client.query("select name from public._migrations");
const done = new Set(rows.map((r) => r.name));

for (const f of files) {
  if (done.has(f)) {
    console.log(`skip  ${f} (already applied)`);
    continue;
  }
  const sql = readFileSync(join(dir, f), "utf8");
  console.log(`apply ${f} …`);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into public._migrations(name) values ($1)", [f]);
    await client.query("commit");
    console.log(`  ok`);
  } catch (e) {
    await client.query("rollback");
    console.error(`  FAILED: ${e.message}`);
    await client.end();
    process.exit(1);
  }
}
await client.end();
console.log("migrations complete");
