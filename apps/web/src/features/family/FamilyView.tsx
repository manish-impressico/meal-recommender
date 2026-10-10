'use client';
import { useState } from 'react';
import { vocab } from '@/content';
import { run } from '@/data/store';
import { Chip, Loading, PageHeader, Badge } from '@/ui';
import { MemberAvatar, TasteChipEditor, explicitTastes } from '@/components';
import { useHousehold } from '../useHousehold';

export function FamilyView() {
  const { data, proj } = useHousehold();
  const [open, setOpen] = useState<string | null>(null);
  if (!data || !proj) return <Loading />;
  const top = (id: string) => [...(proj.profiles.get(id)?.affinity ?? [])].filter(([, a]) => a > 0.2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => vocab.tag(t)?.label ?? t);
  return (
    <div className="d-flex flex-column gap-3" style={{ maxWidth: 720 }}>
      <PageHeader eyebrow="Family" title="Family and tastes" />
      <div className="mr-card d-flex flex-column gap-2">
        <div className="fw-bold">House rules for every plan</div>
        <div className="small text-secondary">Hard rules never break. Tastes below only nudge the picks.</div>
        <div className="d-flex flex-wrap gap-2"><Badge tone="ok">Vegetarian + eggs</Badge><Badge tone="ok">Prep up to {data.settings.maxPrepMinutes} min</Badge><Badge tone="warn">Mild base, heat on the side</Badge></div>
      </div>
      {data.members.map((m) => {
        const ex = explicitTastes(data.events, m.id);
        const dislikes = Object.entries(ex).filter(([, v]) => v === 'dislike').map(([t]) => vocab.tag(t)?.label ?? t);
        return (
          <div key={m.id} className="mr-card d-flex flex-column gap-2">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2 fw-bold"><MemberAvatar m={m} />{m.name}</div>
              <Chip state={open === m.id ? 'on' : 'off'} label={open === m.id ? 'Done' : 'Edit tastes'} onClick={() => setOpen(open === m.id ? null : m.id)} />
            </div>
            <div className="small"><span className="text-secondary">Likes (learned + set): </span>{top(m.id).join(', ') || '—'}</div>
            <div className="small"><span className="text-secondary">Won’t eat: </span>{dislikes.join(', ') || '—'}</div>
            {open === m.id && <TasteChipEditor state={ex} onChange={(tagId, value) => run({ type: 'setTaste', memberId: m.id, tagId, value })} />}
          </div>
        );
      })}
    </div>
  );
}
