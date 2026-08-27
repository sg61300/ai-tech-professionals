"use client";

import { useState } from "react";
import { deleteArtifact } from "@/app/(app)/profile/actions";

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
 * The "second brain" viewer (PRD/16 §2). Lists everything the user has produced
 * or saved, each with copy + delete. Saved reels render as compact single-line
 * rows (icon + title link, no bulky URL) so a big collection stays light, and
 * the whole list collapses to the first few with a "Show all" toggle. Delete is
 * optimistic against a server action; copy uses the clipboard with a flash.
 */
export function SavedArtifacts({ items }: { items: Artifact[] }) {
  const [list, setList] = useState(items);
  const [copiedId, setCopiedId] = useState<number | null>(null);
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
    setList((l) => l.filter((a) => a.id !== id));
    await deleteArtifact(id);
  };

  if (list.length === 0) {
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
      <ul className="pf-arts">
        {shown.map((a) => {
          const isReel = a.source_sim === "reel";

          // Compact reel row: icon + title link only (no raw URL).
          if (isReel) {
            return (
              <li key={a.id} className="pf-art pf-art-reel">
                <a className="pf-reel-main" href={a.body} target="_blank" rel="noopener noreferrer">
                  <span className="pf-reel-ico" aria-hidden>▶</span>
                  <span className="pf-reel-title">{a.title}</span>
                </a>
                <div className="pf-art-actions">
                  <button
                    type="button"
                    className="pf-art-del"
                    onClick={() => remove(a.id)}
                    aria-label="Delete"
                  >
                    🗑
                  </button>
                </div>
              </li>
            );
          }

          // Full artifact card: the user's own output, worth a preview.
          return (
            <li key={a.id} className="pf-art">
              <div className="pf-art-main">
                <span className="pf-art-src">{SOURCE_LABEL[a.source_sim ?? ""] ?? "Saved"}</span>
                <span className="pf-art-title">{a.title}</span>
                <span className="pf-art-body">{a.body}</span>
              </div>
              <div className="pf-art-actions">
                <button type="button" onClick={() => copy(a)} aria-label="Copy">
                  {copiedId === a.id ? "✓" : "📋"}
                </button>
                <button
                  type="button"
                  className="pf-art-del"
                  onClick={() => remove(a.id)}
                  aria-label="Delete"
                >
                  🗑
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {list.length > VISIBLE && (
        <button type="button" className="pf-art-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : `Show all ${list.length}`}
        </button>
      )}
    </>
  );
}
