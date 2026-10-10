import { describe, expect, it } from 'vitest';
import { summarizeVerdicts, type Member } from '@meal/core';
import { verdictSentence } from './verdictText';

const m = (id: string, name: string): Member => ({ id, name, color: '#000000', active: true });
const fam = [m('a', 'You'), m('b', 'Wife'), m('c', 'Son'), m('d', 'Daughter')];
const say = (v: Record<string, 'likes' | 'okay' | 'dislikes'>) => verdictSentence(summarizeVerdicts(v, fam));

describe('verdictSentence', () => {
  it('names fans and the rest', () => expect(say({ a: 'likes', b: 'likes' })).toEqual({ text: 'You and Wife love it · Son and Daughter are okay' }));
  it('uses singular agreement', () => expect(say({ b: 'likes' }).text).toBe('Wife loves it · You, Son and Daughter are okay'));
  it('handles everyone', () => expect(say({ a: 'likes', b: 'likes', c: 'likes', d: 'likes' }).text).toBe('Everyone loves it'));
  it('handles nobody keen', () => expect(say({}).text).toBe('Everyone is okay with it'));
  it('calls out dislikes separately', () => expect(say({ a: 'likes', d: 'dislikes' })).toEqual({ text: 'You love it · Wife and Son are okay', warn: "Daughter won't like it" }));
});
