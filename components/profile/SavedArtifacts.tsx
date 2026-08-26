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

/**
 * The "second brain" viewer (PRD/16 §2). Lists everything the user has produced
 * or saved, each with copy + delete. Delete is optimistic against a server
 * action; copy uses the clipboard with a "Copied ✓" flash.
 */
export function SavedArtifacts({ items }: { items: Artifact[] }) {
  const [list, setList] = useState(items);
  const [copiedId, setCopiedId] = useState<number | null>(null);

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

  return (
    <ul className="pf-arts">
      {list.map((a) => {
        const isReel = a.source_sim === "reel";
        return (
          <li key={a.id} className="pf-art">
            <div className="pf-art-main">
              <span className="pf-art-src">{SOURCE_LABEL[a.source_sim ?? ""] ?? "Saved"}</span>
              <span className="pf-art-title">{a.title}</span>
              {!isReel && <span className="pf-art-body">{a.body}</span>}
              {isReel && (
                <a className="pf-art-link" href={a.body} target="_blank" rel="noopener noreferrer">
                  {a.body}
                </a>
              )}
            </div>
            <div className="pf-art-actions">
              {!isReel && (
                <button type="button" onClick={() => copy(a)} aria-label="Copy">
                  {copiedId === a.id ? "✓" : "📋"}
                </button>
              )}
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
  );
}
