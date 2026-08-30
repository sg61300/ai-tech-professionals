import { describe, it, expect } from "vitest";
import { priceFor, canAfford, blurbFor, SIM_META } from "./index";

describe("simunlock pricing", () => {
  it("prices scale by position (taste < email < system < bias)", () => {
    expect(priceFor("taste-sim")).toBe(50);
    expect(priceFor("sim-email")).toBe(120);
    expect(priceFor("sim-system")).toBe(200);
    expect(priceFor("sim-bias")).toBe(350);
  });
  it("returns null for a non-priced / unknown id", () => {
    expect(priceFor("l1")).toBeNull();
    expect(priceFor("nope")).toBeNull();
    expect(blurbFor("nope")).toBeNull();
  });
  it("canAfford compares earned xp against the price", () => {
    expect(canAfford(350, "sim-bias")).toBe(true);
    expect(canAfford(349, "sim-bias")).toBe(false);
    expect(canAfford(1000, "unknown")).toBe(false); // unknown is never affordable
  });
  it("every priced sim has a non-empty blurb", () => {
    for (const meta of Object.values(SIM_META)) {
      expect(meta.blurb.length).toBeGreaterThan(0);
    }
  });
});
