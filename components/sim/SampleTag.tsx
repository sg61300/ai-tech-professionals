"use client";

import "./sample-tag.css";

/**
 * SampleTag — the honest fallback pill (spec §3.4). Rendered whenever an AI
 * result came back as a scripted `source === "fallback"`, so a sample is never
 * passed off as live. The Retry re-fires the call. Never blocks progress.
 * House rule: no em dashes in learner-facing copy.
 */
export function SampleTag({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="sample-tag" role="status">
      <span className="sample-tag-txt">{"⚡ Showing a sample. AI's busy right now."}</span>
      <button type="button" className="sample-tag-retry" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
