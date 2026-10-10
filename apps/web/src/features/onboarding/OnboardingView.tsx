'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import type { Member } from '@meal/core';
import { run, useAppData } from '@/data/store';
import { Chip, Loading, PageHeader } from '@/ui';
import { MemberAvatar, TasteChipEditor, explicitTastes } from '@/components';

const COLORS = ['#1f7a4d', '#5b6b61', '#7a4a00', '#8c1d18', '#2f5d8a', '#6b4c9a'];

export function OnboardingView() {
  const data = useAppData();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [names, setNames] = useState(['You', 'Wife', 'Son', 'Daughter']);
  const [who, setWho] = useState(0);
  if (!data) return <Loading />;

  const saveMembers = () => {
    const members: Member[] = names.filter((n) => n.trim()).map((n, i) => ({ id: data.members[i]?.id ?? nanoid(8), name: n.trim(), color: COLORS[i % COLORS.length], active: true }));
    run(...members.map((member) => ({ type: 'upsertMember' as const, member })));
    setStep(2);
  };
  const members = data.members;
  const current = members[who];

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <PageHeader eyebrow={`Step ${step} of 3`} title={step === 1 ? 'Who eats at home?' : step === 2 ? `What does ${current?.name ?? ''} eat?` : 'All set'} />
      {step === 1 && (
        <div className="mr-card d-flex flex-column gap-2">
          <div className="small text-secondary">House rule: vegetarian + eggs. Edit names, clear one to remove.</div>
          {names.map((n, i) => (
            <Form.Control key={i} aria-label={`Member ${i + 1}`} value={n} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          <Button variant="link" className="align-self-start p-0" onClick={() => setNames([...names, ''])}>+ Add member</Button>
          <Button size="lg" onClick={saveMembers}>Next: tastes</Button>
        </div>
      )}
      {step === 2 && current && (
        <div className="d-flex flex-column gap-3">
          <div className="d-flex flex-wrap gap-2">
            {members.map((m, i) => <Chip key={m.id} state={i === who ? 'on' : 'off'} onClick={() => setWho(i)} label={<span className="d-inline-flex align-items-center gap-2"><MemberAvatar m={m} />{m.name}</span>} />)}
          </div>
          <div className="mr-card">
            <TasteChipEditor state={explicitTastes(data.events, current.id)} onChange={(tagId, value) => run({ type: 'setTaste', memberId: current.id, tagId, value })} />
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={() => setStep(1)}>Back</Button>
            {who < members.length - 1
              ? <Button className="flex-fill" onClick={() => setWho(who + 1)}>Next: {members[who + 1].name}</Button>
              : <Button className="flex-fill" onClick={() => setStep(3)}>Done</Button>}
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="mr-card d-flex flex-column gap-3">
          <p className="m-0">Picks will lean on these tastes and learn from every “Cook this” and “Not this”.</p>
          <Button size="lg" onClick={() => { run({ type: 'updateSettings', patch: { onboarded: true } }); router.replace('/'); }}>See my first pick</Button>
        </div>
      )}
    </div>
  );
}
