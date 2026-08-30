import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Unit tests for the XP sim-unlock server action (Design/xp-sim-unlock-spec.md §6).
 *
 * The repo has no existing action test to copy a Supabase-mock style from (all
 * current tests are pure `lib/**` units), so we build a minimal chainable query
 * builder here: intermediate methods (`select`/`eq`/`gte`/`insert`/`update`/
 * `delete`) return the builder, terminal reads resolve via `.single()` or by
 * awaiting the thenable builder. Each `from(table)` call resolves a scripted
 * result keyed by table + operation, and every call is recorded so we can assert
 * that (e.g.) no insert/update happened.
 *
 * `@/content` is mocked so `sim-email` carries its REAL prerequisites
 * (l1..l5 + rf1). The live content file ships `unlockAfter: []` TEMP-LOCAL-TEST
 * scaffolding, which would make `isUnlocked` vacuously true for every sim and
 * collapse every case to `already_open`; the mock restores a deterministic gate
 * while keeping the real `isUnlocked` logic under test.
 */

vi.mock("@/content", () => ({
  L1_SPINE: [
    { id: "l1", kind: "lesson", title: "l1", unlockAfter: [], playable: true },
    {
      id: "sim-email",
      kind: "sim",
      title: "Sim: Inbox Tamer",
      glyph: "📧",
      unlockAfter: ["l1", "l2", "l3", "l4", "l5", "rf1"],
      playable: true,
    },
  ],
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/analytics/server", () => ({ captureServer: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { unlockSimWithXp } from "./sim-unlock";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/analytics/server";
import { revalidatePath } from "next/cache";
import { EVENTS } from "@/lib/analytics/events";

const USER = { id: "user-1" };
const SIM = "sim-email";
const PRICE = 120; // priceFor("sim-email")
const ALL_PREREQS = ["l1", "l2", "l3", "l4", "l5", "rf1"].map((id) => ({ lesson_id: id }));

type ScriptOpts = {
  user?: { id: string } | null;
  profile?: { xp: number } | null;
  lessonRows?: { lesson_id: string }[];
  insertResult?: { error: { code?: string } | null };
  updateResult?: { data: { id: string }[] | null };
};

/** Build a scripted, chainable Supabase stub + a record of the writes it saw. */
function makeSupabase(opts: ScriptOpts) {
  const calls = {
    inserts: [] as { table: string; payload: unknown }[],
    updates: [] as { table: string; payload: unknown }[],
    deletes: [] as { table: string }[],
  };
  const insertResult = opts.insertResult ?? { error: null };
  const updateResult = opts.updateResult ?? { data: [{ id: "unlock-row-1" }] };

  function builder(table: string) {
    const state = { insertCalled: false, updateCalled: false, deleteCalled: false };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      gte: vi.fn(() => b),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insert: vi.fn((payload: any) => {
        state.insertCalled = true;
        calls.inserts.push({ table, payload });
        return b;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: vi.fn((payload: any) => {
        state.updateCalled = true;
        calls.updates.push({ table, payload });
        return b;
      }),
      delete: vi.fn(() => {
        state.deleteCalled = true;
        calls.deletes.push({ table });
        return b;
      }),
      // profiles.select(...).single() → the profile read
      single: vi.fn(() => Promise.resolve({ data: opts.profile ?? null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
      // Awaiting the builder resolves the scripted result for this table+op.
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        let result: unknown;
        if (state.insertCalled) result = insertResult;
        else if (state.updateCalled) result = updateResult;
        else if (state.deleteCalled) result = { error: null };
        else if (table === "lesson_progress") result = { data: opts.lessonRows ?? [] };
        else result = { data: null };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return b;
  }

  // The user-scoped client handles auth + reads (profile, lesson_progress).
  const userClient = {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: opts.user ?? USER } })) },
    from: vi.fn((table: string) => builder(table)),
    _calls: calls,
  };
  // Writes go through the service-role admin client (sim_unlocks is RLS
  // SELECT-only). It shares the same call recorder + scripted results so the
  // existing insert/update/delete assertions still hold regardless of client.
  const adminClient = {
    from: vi.fn((table: string) => builder(table)),
    _calls: calls,
  };
  return { userClient, adminClient, _calls: calls };
}

function useSupabase(opts: ScriptOpts) {
  const env = makeSupabase(opts);
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(env.userClient);
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(env.adminClient);
  return env;
}

describe("unlockSimWithXp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) returns insufficient_xp when xp < price — no insert, no profiles.update", async () => {
    const supabase = useSupabase({
      profile: { xp: PRICE - 20 }, // 100 < 120
      lessonRows: [], // path has NOT unlocked it → gate passes to the xp check
    });

    const result = await unlockSimWithXp(SIM);

    expect(result).toEqual({ ok: false, error: "insufficient_xp" });
    expect(supabase._calls.inserts).toHaveLength(0);
    expect(supabase._calls.updates).toHaveLength(0);
    expect(captureServer).not.toHaveBeenCalled();
  });

  it("(b) returns already_open when the spine node is path-unlocked", async () => {
    const supabase = useSupabase({
      profile: { xp: 1000 }, // could easily afford — but it's free via the path
      lessonRows: ALL_PREREQS, // l1..l5 + rf1 done → isUnlocked(sim-email) === true
    });

    const result = await unlockSimWithXp(SIM);

    expect(result).toEqual({ ok: false, error: "already_open" });
    expect(supabase._calls.inserts).toHaveLength(0);
    expect(supabase._calls.updates).toHaveLength(0);
  });

  it("(c) returns already_unlocked when the sim_unlocks insert hits 23505", async () => {
    const supabase = useSupabase({
      profile: { xp: 500 },
      lessonRows: [],
      insertResult: { error: { code: "23505" } }, // unique violation → row exists
    });

    const result = await unlockSimWithXp(SIM);

    expect(result).toEqual({ ok: false, error: "already_unlocked" });
    expect(supabase._calls.inserts).toHaveLength(1); // it tried the insert-first lock
    expect(supabase._calls.updates).toHaveLength(0); // but never deducted XP
    expect(captureServer).not.toHaveBeenCalled();
  });

  it("(d) happy path: ok, newXp = xp - price, fires SIM_UNLOCKED_VIA_XP ahead_of_path", async () => {
    const supabase = useSupabase({
      profile: { xp: 500 },
      lessonRows: [],
      insertResult: { error: null },
      updateResult: { data: [{ id: "unlock-row-1" }] }, // conditional deduct hit a row
    });

    const result = await unlockSimWithXp(SIM);

    expect(result).toEqual({
      ok: true,
      simId: SIM,
      xpSpent: PRICE,
      newXp: 500 - PRICE, // 380
      newLevel: 3, // levelFromXp(380): L3 spans 300..599
    });

    // insert-first lock carried ahead_of_path: true
    expect(supabase._calls.inserts).toHaveLength(1);
    expect(supabase._calls.inserts[0].payload).toMatchObject({
      user_id: USER.id,
      sim_id: SIM,
      xp_spent: PRICE,
      ahead_of_path: true,
    });

    // headline metric fired with the right shape
    expect(captureServer).toHaveBeenCalledWith(USER.id, EVENTS.SIM_UNLOCKED_VIA_XP, {
      sim_id: SIM,
      xp_spent: PRICE,
      ahead_of_path: true,
    });

    // no compensating delete on the happy path
    expect(supabase._calls.deletes).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith("/sims");
  });

  it("(e) race-compensation: conditional deduct hits 0 rows → deletes the row, insufficient_xp", async () => {
    const supabase = useSupabase({
      profile: { xp: 500 },
      lessonRows: [],
      insertResult: { error: null },
      updateResult: { data: [] }, // .gte('xp', price) matched nothing → concurrent spend
    });

    const result = await unlockSimWithXp(SIM);

    expect(result).toEqual({ ok: false, error: "insufficient_xp" });
    expect(supabase._calls.inserts).toHaveLength(1); // it inserted the lock
    expect(supabase._calls.updates).toHaveLength(1); // it attempted the conditional deduct
    expect(supabase._calls.deletes).toHaveLength(1); // then compensated by deleting the row
    expect(supabase._calls.deletes[0].table).toBe("sim_unlocks");
    expect(captureServer).not.toHaveBeenCalled(); // never celebrated a failed unlock
  });
});
