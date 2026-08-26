import { describe, it, expect } from "vitest";
import { flavorFor, isSeniority } from "./index";
import type { Flavor } from "@/content/schema";

const full: Flavor = { entry: "entry eg", mid: "mid eg", senior: "senior eg" };

describe("isSeniority", () => {
  it("accepts the three valid values", () => {
    expect(isSeniority("entry")).toBe(true);
    expect(isSeniority("mid")).toBe(true);
    expect(isSeniority("senior")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isSeniority(null)).toBe(false);
    expect(isSeniority(undefined)).toBe(false);
    expect(isSeniority("")).toBe(false);
    expect(isSeniority("lead")).toBe(false);
  });
});

describe("flavorFor", () => {
  it("returns the matching level's line", () => {
    expect(flavorFor(full, "entry")).toBe("entry eg");
    expect(flavorFor(full, "senior")).toBe("senior eg");
  });
  it("returns null when the lesson has no flavor", () => {
    expect(flavorFor(undefined, "entry")).toBeNull();
  });
  it("returns null when seniority is unknown/unset (no fallback)", () => {
    expect(flavorFor(full, null)).toBeNull();
    expect(flavorFor(full, undefined)).toBeNull();
    expect(flavorFor(full, "principal")).toBeNull();
  });
  it("returns null when that specific level was not authored (partial flavor)", () => {
    const partial: Flavor = { senior: "only senior" };
    expect(flavorFor(partial, "entry")).toBeNull();
    expect(flavorFor(partial, "senior")).toBe("only senior");
  });
});
