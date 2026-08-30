/**
 * XP sim-unlock pricing — pure + testable (see Design/xp-sim-unlock-spec.md §5).
 * Prices scale by position in the L1 spine so the curve preserves order and a
 * fresh user cannot afford the capstone. Tunable constants. No IO.
 */
export const SIM_META: Record<string, { price: number; blurb: string }> = {
  "taste-sim": { price: 50, blurb: "Feel the difference a great prompt makes." },
  "sim-email": { price: 120, blurb: "Tame a messy HR inbox with smart rules." },
  "sim-system": { price: 200, blurb: "Map a real HR system and find its risks." },
  "sim-bias": { price: 350, blurb: "Audit an AI shortlist for hidden bias." },
};

export function priceFor(simId: string): number | null {
  return SIM_META[simId]?.price ?? null;
}
export function blurbFor(simId: string): string | null {
  return SIM_META[simId]?.blurb ?? null;
}
export function canAfford(xp: number, simId: string): boolean {
  const price = priceFor(simId);
  return price !== null && xp >= price;
}
