import { describe, expect, it } from 'vitest';
import { agree, listNames, summarizeVerdicts, HouseholdSettings, type Member } from '../src';

const m = (id: string, name: string, active = true): Member => ({ id, name, color: '#000000', active });
const fam = [m('a', 'You'), m('b', 'Wife'), m('c', 'Son'), m('d', 'Daughter')];

describe('listNames / agree', () => {
  it('joins names naturally', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['You'])).toBe('You');
    expect(listNames(['You', 'Wife'])).toBe('You and Wife');
    expect(listNames(['You', 'Wife', 'Son'])).toBe('You, Wife and Son');
  });
  it('agrees the verb with the subject', () => {
    expect(agree(['Wife'], 'likes', 'like')).toBe('likes');
    expect(agree(['You'], 'likes', 'like')).toBe('like');
    expect(agree(['you'], 'likes', 'like')).toBe('like');
    expect(agree(['Son', 'Daughter'], 'likes', 'like')).toBe('like');
  });
});

describe('summarizeVerdicts', () => {
  it('groups active members and treats missing verdicts as okay', () => {
    const s = summarizeVerdicts({ a: 'likes', b: 'likes', c: 'okay' }, fam);
    expect(s.likes.map((x) => x.id)).toEqual(['a', 'b']);
    expect(s.okay.map((x) => x.id)).toEqual(['c', 'd']);
    expect(s.dislikes).toEqual([]);
    expect(s.everyoneHappy).toBe(true);
  });
  it('is not everyone-happy with a dislike or fewer than two likes', () => {
    expect(summarizeVerdicts({ a: 'likes', b: 'likes', d: 'dislikes' }, fam).everyoneHappy).toBe(false);
    expect(summarizeVerdicts({ a: 'likes' }, fam).everyoneHappy).toBe(false);
  });
  it('ignores inactive members', () => {
    const s = summarizeVerdicts({ a: 'dislikes', b: 'likes' }, [m('a', 'You', false), m('b', 'Wife')]);
    expect(s.dislikes).toEqual([]);
    expect(s.likes.map((x) => x.id)).toEqual(['b']);
  });
});

describe('settings', () => {
  it('defaults showDebug to false', () => expect(HouseholdSettings.parse({}).showDebug).toBe(false));
});
