'use client';
// One function, two paths, same core: server (Claude) first, local rules ranker if AI is off or the server fails.
import { recommend, rulesRanker, type RecommendRequest, type RecommendResponse } from '@meal/core';
import { meals, vocab } from '@/content';

const local = (req: RecommendRequest) => recommend(req, { meals, vocab, ranker: rulesRanker });

export async function getRecommendations(req: RecommendRequest): Promise<RecommendResponse> {
  if (!req.context.settings.aiEnabled) return local(req); // AI off: zero network calls
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 30_000);
    const res = await fetch('/api/recommend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req), signal: ac.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as RecommendResponse;
  } catch {
    return local(req);
  }
}
