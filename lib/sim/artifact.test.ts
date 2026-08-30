import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSimArtifact } from "./artifact";

/** Chainable mock of the saved_artifacts query used by ensureSimArtifact:
 *  select().eq().eq().limit().maybeSingle()  and  insert().select().maybeSingle(). */
function mockDb(existing: { id: number } | null, inserted: { id: number } | null) {
  const insert = vi.fn(() => ({
    select: () => ({ maybeSingle: async () => ({ data: inserted }) }),
  }));
  const selectChain = {
    eq: () => selectChain,
    limit: () => ({ maybeSingle: async () => ({ data: existing }) }),
  };
  const from = vi.fn(() => ({ select: () => selectChain, insert }));
  return { db: { from } as unknown as SupabaseClient, insert };
}

describe("ensureSimArtifact", () => {
  it("returns the existing artifact id without inserting a duplicate", async () => {
    const { db, insert } = mockDb({ id: 7 }, { id: 99 });
    const id = await ensureSimArtifact(db, "u1", { simId: "sim-email", title: "T", body: "B" });
    expect(id).toBe(7);
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts and returns the new id when none exists (first write / backfill)", async () => {
    const { db, insert } = mockDb(null, { id: 42 });
    const id = await ensureSimArtifact(db, "u1", { simId: "taste-sim", title: "T", body: "B" });
    expect(id).toBe(42);
    expect(insert).toHaveBeenCalledOnce();
  });

  it("returns null if the insert produced no row", async () => {
    const { db } = mockDb(null, null);
    const id = await ensureSimArtifact(db, "u1", { simId: "sim-system", title: "T", body: "B" });
    expect(id).toBeNull();
  });
});
