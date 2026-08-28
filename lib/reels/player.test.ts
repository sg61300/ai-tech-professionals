import { describe, it, expect } from "vitest";
import { parseYouTubePlayerState, YT_STATE_PLAYING } from "./player";

describe("parseYouTubePlayerState", () => {
  it("reads playerState from an infoDelivery message (the common shape)", () => {
    const data = JSON.stringify({ event: "infoDelivery", info: { playerState: 1, currentTime: 0.5 } });
    expect(parseYouTubePlayerState(data)).toBe(1);
  });
  it("reads info from an onStateChange message (the older shape)", () => {
    expect(parseYouTubePlayerState(JSON.stringify({ event: "onStateChange", info: 3 }))).toBe(3);
  });
  it("returns the playing code for a playing message", () => {
    const data = JSON.stringify({ event: "infoDelivery", info: { playerState: YT_STATE_PLAYING } });
    expect(parseYouTubePlayerState(data)).toBe(YT_STATE_PLAYING);
  });
  it("ignores unrelated player messages", () => {
    expect(parseYouTubePlayerState(JSON.stringify({ event: "infoDelivery", info: { volume: 100 } }))).toBeNull();
    expect(parseYouTubePlayerState(JSON.stringify({ event: "apiInfoDelivery", info: {} }))).toBeNull();
  });
  it("is null-safe for non-string / non-JSON / junk", () => {
    expect(parseYouTubePlayerState(null)).toBeNull();
    expect(parseYouTubePlayerState(undefined)).toBeNull();
    expect(parseYouTubePlayerState(42)).toBeNull();
    expect(parseYouTubePlayerState("not json")).toBeNull();
    expect(parseYouTubePlayerState(JSON.stringify({ event: "onStateChange" }))).toBeNull();
  });
});
