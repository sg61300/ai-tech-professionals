// Applies supabase/seed-reels.sql against DATABASE_URL (loads .env.local).
// Idempotent via the youtube_id unique index (migration 0003). Safe to re-run.
// Usage: node scripts/seed-reels.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

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

const sql = readFileSync(join(root, "supabase", "seed-reels.sql"), "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(sql);
const { rows } = await client.query(
  "select count(*)::int as n from public.reels where status='approved'",
);
await client.end();
console.log(`seed applied — ${rows[0].n} approved reels`);
