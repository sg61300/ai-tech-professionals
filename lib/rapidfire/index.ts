/**
 * Rapid-fire scoring engine (PRD/11). Pure and deterministic so the whole
 * combo/speed/pass mechanic is TDD'd here and the runner (client) + the
 * completion action (server) share one source of truth. No IO, no timers —
 * timers live in the UI and feed elapsed ms into these functions.
 *
 * Mechanic (config-driven, tune after MVP):
 *  - +BASE_XP per correct answer.
 *  - +SPEED_BONUS if answered under SPEED_THRESHOLD_MS.
 *  - combo multiplier ×1.5 on a 3-streak, ×2 on a 5-streak (resets on a miss).
 *  - a timeout counts as a miss (no penalty beyond the combo reset).
 *  - pass = PASS_THRESHOLD correct out of the bank.
 */

export const RF_CONFIG = {
  BASE_XP: 10,
  SPEED_BONUS: 5,
  SPEED_THRESHOLD_MS: 7000,
  TIMER_MS: 15000,
  COMBO_3_AT: 3,
  COMBO_5_AT: 5,
  COMBO_3_MULT: 1.5,
  COMBO_5_MULT: 2,
  PASS_THRESHOLD: 6,
} as const;

export type RfAnswer = {
  correct: boolean;
  /** Time taken to answer, in ms. A timeout passes TIMER_MS with correct=false. */
  elapsedMs: number;
};

export type RfState = {
  /** Number answered correctly so far. */
  correct: number;
  /** Current unbroken correct streak (drives the multiplier). */
  combo: number;
  /** Highest combo reached this round (for the celebration tally). */
  bestCombo: number;
  /** Running XP tally (cosmetic — server awards a fixed amount on pass). */
  score: number;
};

export const rfInitial: RfState = { correct: 0, combo: 0, bestCombo: 0, score: 0 };

/** Multiplier for a given (post-increment) combo length. */
export function comboMultiplier(combo: number): number {
  if (combo >= RF_CONFIG.COMBO_5_AT) return RF_CONFIG.COMBO_5_MULT;
  if (combo >= RF_CONFIG.COMBO_3_AT) return RF_CONFIG.COMBO_3_MULT;
  return 1;
}

/** XP earned for a single answer at a given combo length (0 on a miss). */
export function answerXp(a: RfAnswer, comboAfter: number): number {
  if (!a.correct) return 0;
  const speed = a.elapsedMs < RF_CONFIG.SPEED_THRESHOLD_MS ? RF_CONFIG.SPEED_BONUS : 0;
  return Math.round((RF_CONFIG.BASE_XP + speed) * comboMultiplier(comboAfter));
}

/** Fold one answer into the running state. A miss resets the combo, earns 0. */
export function applyAnswer(s: RfState, a: RfAnswer): RfState {
  if (!a.correct) return { ...s, combo: 0 };
  const combo = s.combo + 1;
  return {
    correct: s.correct + 1,
    combo,
    bestCombo: Math.max(s.bestCombo, combo),
    score: s.score + answerXp(a, combo),
  };
}

/** Reduce a whole sequence of answers to a final state. */
export function scoreRound(answers: RfAnswer[]): RfState {
  return answers.reduce(applyAnswer, rfInitial);
}

export function isPassed(correct: number, threshold: number = RF_CONFIG.PASS_THRESHOLD): boolean {
  return correct >= threshold;
}
