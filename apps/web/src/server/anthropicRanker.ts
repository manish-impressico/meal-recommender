import 'server-only';
// Ranker adapter (design §6.3). Claude may only reorder the shortlist it is given; output is validated by core.
import Anthropic from '@anthropic-ai/sdk';
import type { Ranker, RankInput } from '@meal/core';

const SYSTEM = `You rank home-cooked meal options for an Indian vegetarian (+eggs) family.
For each target, reorder ONLY the candidate ids given, best first, and write one short warm reason (max 18 words) per id.
Use: member verdicts (likes/okay/dislikes), score (higher = better fit by rules), variety across the day, time and heaviness.
Never invent ids. Reply with JSON only: {"targets":[{"key":"...","order":["id",...],"reasons":{"id":"reason"}}]}`;

export function createAnthropicRanker(): Ranker | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null; // no key → route uses the rules ranker
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
  return {
    name: 'ai',
    async rank(input: RankInput, { signal }) {
      // Egress minimum: names, tags, numbers, verdicts. No history, no events.
      const compact = {
        members: input.members,
        targets: input.targets.map((t) => ({
          key: t.key, slot: t.slot, date: t.date,
          candidates: t.candidates.map(({ id, name, tags, minutes, kcal, spice, score, verdicts }) => ({ id, name, tags, minutes, kcal, spice, score, verdicts })),
        })),
      };
      const msg = await client.messages.create(
        { model, max_tokens: 400 + 350 * input.targets.length, system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(compact) }] },
        { signal },
      );
      const text = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      return JSON.parse(json); // unknown shape — core validateRank() decides what survives
    },
  };
}
