import { describe, it, expect } from "vitest";
import { shouldPreloadNext } from "./preload";

describe("shouldPreloadNext", () => {
  it("allows preload when there's no Network Information API (e.g. desktop)", () => {
    expect(shouldPreloadNext(null)).toBe(true);
    expect(shouldPreloadNext(undefined)).toBe(true);
  });
  it("allows preload on fast connections", () => {
    expect(shouldPreloadNext({ effectiveType: "4g" })).toBe(true);
    expect(shouldPreloadNext({ effectiveType: "3g" })).toBe(true);
  });
  it("skips preload on slow connections", () => {
    expect(shouldPreloadNext({ effectiveType: "2g" })).toBe(false);
    expect(shouldPreloadNext({ effectiveType: "slow-2g" })).toBe(false);
  });
  it("skips preload when Data Saver is on, regardless of speed", () => {
    expect(shouldPreloadNext({ saveData: true, effectiveType: "4g" })).toBe(false);
  });
});
