// Look up / reset a user by email using the service-role admin API.
// Usage:
//   node scripts/reset-user.mjs <email>            # read-only: show the account + row counts
//   node scripts/reset-user.mjs <email> --delete   # DELETE the auth user (cascades all data)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (KEY=VALUE lines).
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];
const doDelete = process.argv.includes("--delete");
if (!url || !key) throw new Error("missing SUPABASE_URL / SERVICE_ROLE_KEY");
if (!email) throw new Error("usage: node scripts/reset-user.mjs <email> [--delete]");

const admin = createClient(url, key, { auth: { persistSession: false } });

// Find the auth user by email (paginate through the admin list).
async function findUser(targetEmail) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === targetEmail.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

const user = await findUser(email);
if (!user) {
  console.log(`No auth user found for ${email}`);
  process.exit(0);
}
console.log(`auth.users: id=${user.id}  email=${user.email}  created=${user.created_at}`);

// Row counts across every per-user table (both referral roles).
const tables = [
  ["profiles", "id"],
  ["lesson_progress", "user_id"],
  ["sim_completions", "user_id"],
  ["saved_artifacts", "user_id"],
  ["daily_activity", "user_id"],
  ["reel_interactions", "user_id"],
  ["streak_saves", "user_id"],
  ["referral_rewards", "invitee_id"],
  ["referral_rewards", "referrer_id"],
];
for (const [t, col] of tables) {
  const { count, error } = await admin.from(t).select("*", { count: "exact", head: true }).eq(col, user.id);
  console.log(`  ${t}.${col.padEnd(12)} = ${error ? "ERR " + error.message : count}`);
}
const { data: prof } = await admin
  .from("profiles")
  .select("name, avatar_name, xp, streak_count, onboarding_complete, referral_code, referred_by")
  .eq("id", user.id)
  .maybeSingle();
console.log("  profile:", JSON.stringify(prof));

if (doDelete) {
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;
  console.log(`\nDELETED auth user ${user.id} — all per-user rows cascade-removed.`);
} else {
  console.log("\n(read-only — re-run with --delete to remove this user)");
}
