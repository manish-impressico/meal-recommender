import { agree, listNames, type VerdictSummary } from '@meal/core';

const names = (ms: { name: string }[]) => ms.map((m) => m.name);

/** One readable line for the card; dislikes returned separately so the UI can colour them. */
export function verdictSentence(s: VerdictSummary): { text: string; warn?: string } {
  const total = s.likes.length + s.okay.length + s.dislikes.length;
  const parts: string[] = [];
  if (s.likes.length === total && total > 0) parts.push('Everyone loves it');
  else if (s.okay.length === total) parts.push('Everyone is okay with it');
  else {
    if (s.likes.length) parts.push(`${listNames(names(s.likes))} ${agree(names(s.likes), 'loves', 'love')} it`);
    if (s.okay.length) parts.push(`${listNames(names(s.okay))} ${agree(names(s.okay), 'is', 'are')} okay`);
  }
  const out: { text: string; warn?: string } = { text: parts.join(' · ') };
  if (s.dislikes.length) out.warn = `${listNames(names(s.dislikes))} won't like it`;
  return out;
}
