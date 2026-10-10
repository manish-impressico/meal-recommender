// The only server route (SESE boundary). Contract enforced by the same zod schema the client uses.
import { RecommendRequest, recommend, rulesRanker } from '@meal/core';
import { meals, vocab } from '@/content';
import { createAnthropicRanker } from '@/server/anthropicRanker';

const ranker = createAnthropicRanker() ?? rulesRanker;

export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 256_000) return Response.json({ error: 'too_large' }, { status: 413 });
  const parsed = RecommendRequest.safeParse(JSON.parse(body || '{}'));
  if (!parsed.success) return Response.json({ error: 'invalid_request', issues: parsed.error.issues.slice(0, 3) }, { status: 400 });
  const started = Date.now();
  const res = await recommend(parsed.data, { meals, vocab, ranker }); // never throws on LLM failure — falls back inside
  console.log(`[recommend] targets=${parsed.data.targets.length} source=${res.results[0]?.source} ms=${Date.now() - started}`);
  return Response.json(res);
}
