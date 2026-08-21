/**
 * XP + level math. Pure and deterministic so it can be TDD'd and called from
 * both Server Actions (on completion) and the dashboard (to render the bar).
 *
 * Curve: cumulative XP required to *reach* level n is 50 * n * (n - 1).
 *   L1 = 0, L2 = 100, L3 = 300, L4 = 600 ...  (per-level cost grows 100, 200, 300)
 * Gentle ramp — rewarding early, never punishing (ADR-002 "no punishment").
 */

/** Cumulative XP needed to reach the start of `level` (level is 1-indexed). */
export function cumXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (cumXpForLevel(level + 1) <= safe) level++;
  return level;
}

export type LevelProgress = {
  level: number;
  /** XP accumulated inside the current level. */
  xpIntoLevel: number;
  /** Total XP the current level spans. */
  xpForThisLevel: number;
  /** 0..1 fill for the XP bar. */
  progress: number;
};

export function levelProgress(xp: number): LevelProgress {
  const safe = Math.max(0, Math.floor(xp));
  const level = levelFromXp(safe);
  const start = cumXpForLevel(level);
  const next = cumXpForLevel(level + 1);
  const xpForThisLevel = next - start;
  const xpIntoLevel = safe - start;
  return {
    level,
    xpIntoLevel,
    xpForThisLevel,
    progress: xpForThisLevel === 0 ? 0 : xpIntoLevel / xpForThisLevel,
  };
}

export type XpApplication = {
  xp: number;
  level: number;
  fromLevel: number;
  leveledUp: boolean;
};

/** Apply an XP delta; report whether it crossed a level boundary. */
export function applyXp(currentXp: number, delta: number): XpApplication {
  const fromLevel = levelFromXp(currentXp);
  const xp = Math.max(0, Math.floor(currentXp) + Math.floor(delta));
  const level = levelFromXp(xp);
  return { xp, level, fromLevel, leveledUp: level > fromLevel };
}
