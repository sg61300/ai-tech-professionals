"use client";

// TEMP local visual-QA harness for the Reels feed (no auth, stubbed writes).
// Sample videos are placeholders for layout only — real reels are curated into
// the `reels` table. Delete this route + the /dev-preview middleware allowance.
import { ReelsFeed, type Reel } from "@/components/reels/ReelsFeed";

const SAMPLE: Reel[] = [
  { id: 1, youtubeId: "aircAruvnKk", title: "What a neural network actually is", channel: "@3blue1brown", topic: "AI basics" },
  { id: 2, youtubeId: "kCc8FmEb1nY", title: "Build intuition for how LLMs predict", channel: "@karpathy", topic: "Prompting" },
  { id: 3, youtubeId: "X48VuDVv0do", title: "AI in the hiring workflow, explained", channel: "@hrtech", topic: "AI in HR" },
];

export default function ReelsPreview() {
  async function toggle() {
    return { ok: true, active: true };
  }
  async function watch() {
    return { ok: true, xpAwarded: 2 };
  }
  return (
    <div className="lh">
      <ReelsFeed
        reels={SAMPLE}
        initialLiked={[]}
        initialSaved={[]}
        watchedIds={[]}
        onToggle={toggle}
        onWatch={watch}
      />
    </div>
  );
}
