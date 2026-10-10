'use client';
// Domain-aware shared components (design §9.2): used across features, never feature-specific.
import type { Meal, Member, Suggestion } from '@meal/core';
import type { ReactNode } from 'react';
import { Badge, Chip, ChipGroup, type ChipState } from '@/ui';
import { vocab } from '@/content';

const SPICE = ['Mild', 'Mild', 'Medium', 'Hot'];

export function MemberAvatar({ m }: { m: Member }) {
  return <span className="mr-avatar" style={{ background: m.color }} aria-hidden="true">{m.name.charAt(0).toUpperCase()}</span>;
}

export function MealMeta({ meal }: { meal: Meal }) {
  return <div className="small text-secondary">{meal.minutes} min · ~{meal.kcal} kcal · {SPICE[meal.spice]}</div>;
}

const VERDICT_TEXT = { likes: 'likes it', okay: 'okay', dislikes: "won't like it" } as const;
export function VerdictChips({ s, members }: { s: Suggestion; members: Member[] }) {
  return (
    <div className="d-grid gap-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
      {members.filter((m) => m.active).map((m) => {
        const v = s.verdicts[m.id] ?? 'okay';
        return <span key={m.id} className={`mr-pill ${v}`}><MemberAvatar m={m} />{m.name}: {VERDICT_TEXT[v]}</span>;
      })}
    </div>
  );
}

/** One meal card, three placements: hero (Today), compact (Week), option (Swap). */
export function MealCard({ meal, eyebrow, variant, suggestion, members, source, actions }: {
  meal: Meal; eyebrow: string; variant: 'hero' | 'compact' | 'option'; suggestion?: Suggestion; members?: Member[]; source?: 'ai' | 'rules' | 'manual'; actions?: ReactNode;
}) {
  return (
    <section className="mr-card d-flex flex-column gap-1" style={variant === 'hero' ? undefined : { borderRadius: 16, padding: 14 }}>
      <div className="d-flex align-items-center justify-content-between gap-2">
        <span className="mr-eyebrow">{eyebrow}</span>
        {source === 'rules' && variant !== 'option' && <Badge>Rule-based pick</Badge>}
        {source === 'ai' && variant === 'hero' && <Badge tone="ok">AI ranked</Badge>}
      </div>
      <h2 className={variant === 'hero' ? 'fs-4 fw-bold m-0' : 'fs-6 fw-bold m-0'}>{meal.name}</h2>
      <MealMeta meal={meal} />
      {suggestion?.reason && <div className={variant === 'hero' ? 'mt-1' : 'small text-secondary'}>{suggestion.reason}</div>}
      {variant === 'hero' && suggestion && members && <div className="mt-2"><VerdictChips s={suggestion} members={members} /></div>}
      {actions && <div className="d-flex gap-2 mt-2">{actions}</div>}
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
