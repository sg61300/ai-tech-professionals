import { describe, it, expect } from "vitest";
import { youtubeIdFromReelUrl, reelThumbUrl, reelWatchUrl } from "./thumb";

describe("youtubeIdFromReelUrl", () => {
  it("extracts the id from a shorts URL (the format we actually save)", () => {
    expect(youtubeIdFromReelUrl("https://www.youtube.com/shorts/VYhWPrBnY-0")).toBe("VYhWPrBnY-0");
  });
  it("accepts classic watch and youtu.be URLs defensively", () => {
    expect(youtubeIdFromReelUrl("https://www.youtube.com/watch?v=8vTPFuI3A4c")).toBe("8vTPFuI3A4c");
    expect(youtubeIdFromReelUrl("https://youtu.be/2peXHPtkl1U")).toBe("2peXHPtkl1U");
  });
  it("returns null for the reel:<id> fallback body", () => {
    expect(youtubeIdFromReelUrl("reel:42")).toBeNull();
  });
  it("returns null for junk / empty", () => {
    expect(youtubeIdFromReelUrl("")).toBeNull();
    expect(youtubeIdFromReelUrl(null)).toBeNull();
    expect(youtubeIdFromReelUrl("not a url")).toBeNull();
  });
});

describe("reelThumbUrl", () => {
  it("builds the hqdefault thumbnail for a real id", () => {
    expect(reelThumbUrl("https://www.youtube.com/shorts/VYhWPrBnY-0")).toBe(
      "https://img.youtube.com/vi/VYhWPrBnY-0/hqdefault.jpg",
    );
  });
  it("is null when there's no id (fallback tile path)", () => {
    expect(reelThumbUrl("reel:42")).toBeNull();
    expect(reelThumbUrl(null)).toBeNull();
  });
});

describe("reelWatchUrl", () => {
  it("passes through an http(s) URL", () => {
    expect(reelWatchUrl("https://www.youtube.com/shorts/abc123")).toBe(
      "https://www.youtube.com/shorts/abc123",
    );
  });
  it("is null for a non-openable fallback body", () => {
    expect(reelWatchUrl("reel:42")).toBeNull();
    expect(reelWatchUrl(null)).toBeNull();
  });
});
