import { describe, it, expect } from "vitest";
import {
  RF_CONFIG,
  comboMultiplier,
  answerXp,
  applyAnswer,
  scoreRound,
  isPassed,
  rfInitial,
  type RfAnswer,
} from "./index";

const fast = (correct: boolean): RfAnswer => ({ correct, elapsedMs: 2000 });
const slow = (correct: boolean): RfAnswer => ({ correct, elapsedMs: 9000 });
const timeout: RfAnswer = { correct: false, elapsedMs: RF_CONFIG.TIMER_MS };

describe("comboMultiplier", () => {
  it("is 1x below a 3-streak", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(2)).toBe(1);
  });
  it("is 1.5x from a 3-streak, 2x from a 5-streak", () => {
    expect(comboMultiplier(3)).toBe(1.5);
    expect(comboMultiplier(4)).toBe(1.5);
    expect(comboMultiplier(5)).toBe(2);
    expect(comboMultiplier(8)).toBe(2);
  });
});

describe("answerXp", () => {
  it("earns 0 on a miss regardless of speed", () => {
    expect(answerXp(fast(false), 1)).toBe(0);
    expect(answerXp(timeout, 1)).toBe(0);
  });
  it("adds the speed bonus only under the threshold", () => {
    expect(answerXp(fast(true), 1)).toBe(15); // 10 + 5
    expect(answerXp(slow(true), 1)).toBe(10); // no speed bonus
  });
  it("applies the combo multiplier", () => {
    expect(answerXp(fast(true), 3)).toBe(Math.round(15 * 1.5)); // 23
    expect(answerXp(fast(true), 5)).toBe(30); // 15 * 2
    expect(answerXp(slow(true), 5)).toBe(20); // 10 * 2
  });
});

describe("applyAnswer", () => {
  it("increments combo + correct on a hit", () => {
    const s = applyAnswer(rfInitial, fast(true));
    expect(s.correct).toBe(1);
    expect(s.combo).toBe(1);
    expect(s.bestCombo).toBe(1);
    expect(s.score).toBe(15);
  });
  it("resets combo but keeps correct/score on a miss", () => {
    const hit = applyAnswer(rfInitial, fast(true));
    const miss = applyAnswer(hit, fast(false));
    expect(miss.combo).toBe(0);
    expect(miss.correct).toBe(1);
    expect(miss.score).toBe(15);
    expect(miss.bestCombo).toBe(1);
  });
});

describe("scoreRound", () => {
  it("tracks the best combo across a mixed round", () => {
    // 3 hits (combo→3), miss (reset), 2 hits
    const s = scoreRound([fast(true), fast(true), fast(true), fast(false), fast(true), fast(true)]);
    expect(s.correct).toBe(5);
    expect(s.bestCombo).toBe(3);
    expect(s.combo).toBe(2); // current streak after the two trailing hits
    // 15 + 15 + round(15*1.5)=23 + 0 + 15 + 15 = 83
    expect(s.score).toBe(83);
  });
  it("an all-timeout round scores zero", () => {
    const s = scoreRound(Array(8).fill(timeout));
    expect(s.correct).toBe(0);
    expect(s.score).toBe(0);
    expect(s.bestCombo).toBe(0);
  });
});

describe("isPassed", () => {
  it("passes at the default 6/8 threshold", () => {
    expect(isPassed(6)).toBe(true);
    expect(isPassed(5)).toBe(false);
    expect(isPassed(8)).toBe(true);
  });
  it("respects a custom threshold", () => {
    expect(isPassed(4, 4)).toBe(true);
    expect(isPassed(3, 4)).toBe(false);
  });
});
