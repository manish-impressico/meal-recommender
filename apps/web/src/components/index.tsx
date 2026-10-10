'use client';
// Domain-aware shared components (design §9.2): used across features, never feature-specific.
import { summarizeVerdicts, type Meal, type Member, type Suggestion } from '@meal/core';
import type { ReactNode } from 'react';
import { Badge, Chip, ChipGroup, type ChipState } from '@/ui';
import { vocab } from '@/content';
import { MealImage } from './MealImage';
import { verdictSentence } from './verdictText';

const SPICE = ['Mild', 'Mild', 'Medium', 'Hot'];

export function MemberAvatar({ m }: { m: Member }) {
  return <span className="mr-avatar" style={{ background: m.color }} aria-hidden="true">{m.name.charAt(0).toUpperCase()}</span>;
}

export function MealMeta({ meal }: { meal: Meal }) {
  return <div className="small text-secondary" style={{ fontWeight: 600 }}>{meal.minutes} min · {SPICE[meal.spice].toLowerCase()} spice · ~{meal.kcal} kcal</div>;
}

export function VerdictSummary({ s, members }: { s: Suggestion; members: Member[] }) {
  const sum = summarizeVerdicts(s.verdicts, members);
  const line = verdictSentence(sum);
  const ordered = [...sum.likes, ...sum.okay, ...sum.dislikes];
  return (
    <div className="d-flex align-items-center gap-2" style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--mr-soft)' }}>
      <div className="mr-avatars">{ordered.map((m) => <MemberAvatar key={m.id} m={m} />)}</div>
      <div className="d-flex flex-column" style={{ minWidth: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
        <span>{line.text}</span>
        {line.warn && <span style={{ color: 'var(--mr-danger)', fontWeight: 700 }}>{line.warn}</span>}
      </div>
    </div>
  );
}

/** One meal card, three placements: hero (Today), compact (Week), option (Swap). */
export function MealCard({ meal, eyebrow, variant, suggestion, members, source, actions, showSource = false, badge }: {
  meal: Meal; eyebrow: string; variant: 'hero' | 'compact' | 'option'; suggestion?: Suggestion; members?: Member[];
  source?: 'ai' | 'rules' | 'manual'; actions?: ReactNode; showSource?: boolean; badge?: ReactNode;
}) {
  // Source is debug info only (Settings › Show debug info); always kept as a data attribute for tests.
  const debug = showSource && source ? <Badge>{source === 'ai' ? 'AI ranked' : source === 'rules' ? 'Rule-based' : 'Manual'}</Badge> : null;
  if (variant === 'hero') {
    return (
      <section className="mr-hero" data-source={source}>
        <div style={{ position: 'relative' }}>
          <MealImage meal={meal} height={200} />
          {badge && <div style={{ position: 'absolute', top: 12, left: 12 }}>{badge}</div>}
        </div>
        <div className="mr-hero-body">
          <div className="d-flex justify-content-between align-items-center gap-2"><span className="mr-eyebrow">{eyebrow}</span>{debug}</div>
          <h2 className="m-0" style={{ fontSize: 24 }}>{meal.name}</h2>
          <MealMeta meal={meal} />
          {suggestion?.reason && <p className="m-0">{suggestion.reason}</p>}
          {suggestion && members && <VerdictSummary s={suggestion} members={members} />}
          {actions && <div className="d-flex gap-2 align-items-center">{actions}</div>}
        </div>
      </section>
    );
  }
  const thumb = variant === 'compact' ? 72 : 56;
  return (
    <section className="d-flex align-items-center gap-3 mr-card" style={{ padding: 12, borderRadius: 20 }} data-source={source}>
      <MealImage meal={meal} height={thumb} width={thumb} rounded={14} />
      <div className="flex-fill d-flex flex-column" style={{ minWidth: 0 }}>
        <span className="mr-eyebrow text-capitalize">{eyebrow}</span>
        <span className="fw-bold" style={{ fontSize: 16, lineHeight: 1.25 }}>{meal.name}</span>
        <MealMeta meal={meal} />
        {variant === 'option' && suggestion?.reason && <span className="small text-secondary">{suggestion.reason}</span>}
        {debug && <span>{debug}</span>}
      </div>
      {actions}
    </section>
  );
}

/** Tri-state taste chips (like / won't eat / no opinion). Shared by onboarding and Family — same command. */
export function TasteChipEditor({ state, onChange }: { state: Record<string, 'like' | 'dislike'>; onChange: (tagId: string, v: 'like' | 'dislike' | 'none') => void }) {
  const next = (s?: 'like' | 'dislike') => (s === undefined ? 'like' : s === 'like' ? 'dislike' : 'none');
  const groups = [
    { label: 'Dishes', kinds: ['dish', 'trait'] },
    { label: 'Ingredients', kinds: ['ingredient'] },
  ];
  return (
    <div className="d-flex flex-column gap-3">
      <div className="small text-secondary">Tap once = likes · twice = won’t eat · three times = no opinion</div>
      {groups.map((g) => (
        <ChipGroup key={g.label} label={g.label}>
          {vocab.chipTags().filter((t) => g.kinds.includes(t.kind)).map((t) => {
            const s = state[t.id];
            const cs: ChipState = s ?? 'off';
            return <Chip key={t.id} label={(s === 'dislike' ? '✕ ' : s === 'like' ? '✓ ' : '') + t.label} state={cs} onClick={() => onChange(t.id, next(s))} />;
          })}
        </ChipGroup>
      ))}
    </div>
  );
}

/** Current explicit taste state per member, folded from events (display only; scoring uses the projection). */
export function explicitTastes(events: { type: string; memberId?: string; tagId?: string; value?: string }[], memberId: string) {
  const out: Record<string, 'like' | 'dislike'> = {};
  for (const e of events) if (e.type === 'taste.set' && e.memberId === memberId && e.tagId) {
    if (e.value === 'none') delete out[e.tagId]; else out[e.tagId] = e.value as 'like' | 'dislike';
  }
  return out;
}
