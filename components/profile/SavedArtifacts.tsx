"use client";

import { useState } from "react";
import { deleteArtifact } from "@/app/(app)/profile/actions";
import { SavedReelsCarousel, type ReelItem } from "./SavedReelsCarousel";

export type Artifact = {
  id: number;
  title: string;
  source_sim: string | null;
  body: string;
  created_at: string;
};

const SOURCE_LABEL: Record<string, string> = {
  "taste-sim": "Taste sim",
  "sim-email": "Inbox Tamer",
  "sim-system": "System X-Ray",
  reel: "Saved reel",
};

/** Collapse the list to this many by default so a large second brain stays light. */
const VISIBLE = 4;

/**
 * The "second brain" viewer (PRD/16 §2). Saved reels are pulled out into a 3D
 * coverflow launcher (view-only — un-save happens back in the /reels feed); the
 * user's own outputs (taste/email/system artifacts) render as cards below it,
 * each with copy + delete. Delete is optimistic against a server action; copy
 * uses the clipboard with a flash. The list collapses to the first few.
 */
export function SavedArtifacts({ items }: { items: Artifact[] }) {
  const reels: ReelItem[] = items
    .filter((a) => a.source_sim === "reel")
    .map((a) => ({ id: a.id, title: a.title, url: a.body }));

  const [list, setList] = useState(items.filter((a) => a.source_sim !== "reel"));
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const copy = async (a: Artifact) => {
    try {
      await navigator.clipboard.writeText(a.body);
      setCopiedId(a.id);
      setTimeout(() => setCopiedId((c) => (c === a.id ? null : c)), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const remove = async (id: number) => {
    setConfirmingId(null);
    setList((l) => l.filter((a) => a.id !== id));
    await deleteArtifact(id);
  };

  if (reels.length === 0 && list.length === 0) {
    return (
      <div className="pf-empty">
        <span aria-hidden>🧠</span>
        <p>Nothing saved yet. Finish a simulation or save a reel, and your greatest hits land here.</p>
      </div>
    );
  }

  const shown = expanded ? list : list.slice(0, VISIBLE);

  return (
    <>
      <SavedReelsCarousel reels={reels} />

      {list.length > 0 && (
        <ul className="pf-arts">
          {shown.map((a) => (
            <li key={a.id} className="pf-art">
              <div className="pf-art-main">
                <span className="pf-art-src">{SOURCE_LABEL[a.source_sim ?? ""] ?? "Saved"}</span>
                <span className="pf-art-title">{a.title}</span>
                <span className="pf-art-body">{a.body}</span>
              </div>
              <div className="pf-art-actions">
                {confirmingId === a.id ? (
                  <div className="pf-art-confirm" role="group" aria-label="Confirm delete">
                    <span className="pf-art-confirm-q">Delete?</span>
                    <button
                      type="button"
                      className="pf-art-confirm-yes"
                      onClick={() => remove(a.id)}
                      aria-label="Confirm delete"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="pf-art-confirm-no"
                      onClick={() => setConfirmingId(null)}
                      aria-label="Cancel delete"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => copy(a)} aria-label="Copy">
                      {copiedId === a.id ? "✓" : "📋"}
                    </button>
                    <button
                      type="button"
                      className="pf-art-del"
                      onClick={() => setConfirmingId(a.id)}
                      aria-label="Delete"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {list.length > VISIBLE && (
        <button type="button" className="pf-art-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : `Show all ${list.length}`}
        </button>
      )}
    </>
  );
}
