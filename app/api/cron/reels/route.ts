import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel Hobby caps a function at 60s. The 12 search calls run in parallel (not
// serially), so the real wall-time is a few seconds, but claim the max headroom.
export const maxDuration = 60;

/**
 * Daily reel auto-pull (PRD/14). Triggered by Vercel Cron (see vercel.json).
 * Runs ONCE a day (Hobby-plan cron limit) and therefore sweeps EVERY query at
 * the YouTube page-size max (50) to extract the maximum fresh videos per pass,
 * then applies STRICT relevance guardrails before auto-approving (Session 14/17):
 *   - the VIDEO must carry an AI signal AND an HR signal across title+description+tags
 *   - the CHANNEL (author) must also read as HR/AI focused (title+description)
 *   - must be embeddable + public, and not in an off-topic category (games/music/sports)
 * Anything failing the guardrails is dropped (never published). Deduped on the
 * unique youtube_id so existing curation/status is preserved.
 *
 * Guards: only the CRON_SECRET holder may run it; no-ops if YOUTUBE_API_KEY unset.
 * REELS_AUTOAPPROVE=false routes survivors to the 'queued' lane instead of live.
 */
// 12 diverse HR+AI search queries. Each search.list costs 100 quota units, so a
// daily run spends 12*100 = 1200 units (~12% of the default 10,000/day quota) —
// well within budget, and casts the widest net for fresh videos in one pass.
const QUERIES = [
  "AI tools for HR professionals",
  "ChatGPT for recruiters",
  "AI in human resources",
  "prompt engineering for HR teams",
  "AI recruiting automation",
  "people analytics with AI",
  "AI for talent acquisition",
  "generative AI HR use cases",
  "AI employee onboarding",
  "AI performance management HR",
  "HR chatbot automation",
  "AI for learning and development",
];

const AI_RE =
  /\b(a\.?i\.?|artificial intelligence|chat\s?gpt|gpt-?\d?|llm|large language model|gemini|copilot|claude|prompt(s|ing)?|machine learning|automat(e|ed|ion)|genai|generative)\b/i;
const HR_RE =
  /\b(hr|human resource(s)?|recruit(er|ing|ment)?|hiring|talent|onboard(ing)?|offboard(ing)?|payroll|people\s?(ops|team|analytics)|workforce|employee(s)?|attrition|l&d|learning and development|hrms|hris)\b/i;
// Hard off-topic categories: Music(10) Sports(17) Gaming(20) Trailers(44) etc.
const DENY_CATEGORIES = new Set(["10", "17", "20", "23", "44"]);

type SearchItem = { id?: { videoId?: string }; snippet?: { channelId?: string } };
type VideoItem = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    categoryId?: string;
    tags?: string[];
  };
  status?: { embeddable?: boolean; privacyStatus?: string };
};
type ChannelItem = { id?: string; snippet?: { title?: string; description?: string } };

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`youtube ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** YouTube videos.list / channels.list accept at most 50 ids per call. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: true, skipped: "no YOUTUBE_API_KEY set" });

  const autoApprove = process.env.REELS_AUTOAPPROVE !== "false";

  try {
    // 1) Sweep EVERY query for fresh short videos, at the page-size max, and pool
    //    the unique video ids (a daily run has one shot, so cast the widest net).
    //    Searches run in PARALLEL (fast, stays under the function timeout); a
    //    single failed query is tolerated rather than aborting the whole sweep.
    const searches = await Promise.allSettled(
      QUERIES.map((q) =>
        yt<{ items?: SearchItem[] }>("search", {
          key: apiKey,
          part: "snippet",
          q,
          type: "video",
          videoDuration: "short",
          videoEmbeddable: "true",
          safeSearch: "strict",
          relevanceLanguage: "en",
          order: "date",
          maxResults: "50",
        }),
      ),
    );
    const idSet = new Set<string>();
    for (const s of searches) {
      if (s.status !== "fulfilled") continue;
      for (const i of s.value.items ?? []) if (i.id?.videoId) idSet.add(i.id.videoId);
    }
    const ids = [...idSet];
    if (ids.length === 0) return NextResponse.json({ ok: true, queries: QUERIES.length, fetched: 0, accepted: 0 });

    // 2) Full video metadata (description, tags, category, embeddable, status),
    //    batched at 50 ids/call (the videos.list limit).
    const videos: VideoItem[] = [];
    for (const batch of chunk(ids, 50)) {
      const vids = await yt<{ items?: VideoItem[] }>("videos", {
        key: apiKey,
        part: "snippet,status",
        id: batch.join(","),
      });
      videos.push(...(vids.items ?? []));
    }

    // 3) Channel (author) metadata — is this author actually an HR/AI creator? —
    //    also batched at 50 ids/call.
    const channelIds = [...new Set(videos.map((v) => v.snippet?.channelId).filter(Boolean))] as string[];
    const chanById = new Map<string | undefined, ChannelItem>();
    for (const batch of chunk(channelIds, 50)) {
      const chans = await yt<{ items?: ChannelItem[] }>("channels", {
        key: apiKey,
        part: "snippet",
        id: batch.join(","),
      });
      for (const c of chans.items ?? []) chanById.set(c.id, c);
    }

    // 4) Guardrails.
    const accepted = videos.filter((v) => {
      const s = v.snippet;
      if (!v.id || !s) return false;
      if (v.status?.embeddable === false || v.status?.privacyStatus !== "public") return false;
      if (s.categoryId && DENY_CATEGORIES.has(s.categoryId)) return false;
      const title = s.title ?? "";
      const tags = (s.tags ?? []).join(" ");
      const vHay = `${title} ${s.description ?? ""} ${tags}`;
      const c = chanById.get(s.channelId ?? "");
      const cHay = `${s.channelTitle ?? ""} ${c?.snippet?.title ?? ""} ${c?.snippet?.description ?? ""}`;
      // Strict: the AI intent must be in the TITLE or TAGS (a boilerplate mention
      // in the description isn't enough — that let Excel tutorials through). HR
      // may appear anywhere on the video or the author's channel.
      const hasAI = AI_RE.test(title) || AI_RE.test(tags);
      const hasHR = HR_RE.test(vHay) || HR_RE.test(cHay);
      return hasAI && hasHR;
    });

    if (accepted.length === 0) {
      return NextResponse.json({ ok: true, queries: QUERIES.length, fetched: videos.length, accepted: 0 });
    }

    const rows = accepted.map((v) => ({
      youtube_id: v.id!,
      title: v.snippet?.title ?? null,
      channel: v.snippet?.channelTitle ?? null,
      topic: "AI for HR",
      published_at: v.snippet?.publishedAt ?? null,
      status: autoApprove ? "approved" : "queued",
      tags: ["hr", "ai"],
    }));

    const supabase = createAdminClient();
    const { error, count } = await supabase
      .from("reels")
      .upsert(rows, { onConflict: "youtube_id", ignoreDuplicates: true, count: "exact" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      queries: QUERIES.length,
      fetched: videos.length,
      accepted: accepted.length,
      inserted: count ?? null,
      autoApprove,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
